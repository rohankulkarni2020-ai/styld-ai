import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { outfitJobsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  generateOutfitStructures,
  generatePortalProducts,
  generateOutfitImage,
  buildImagePrompt,
  type OutfitOptions,
} from "../lib/outfitAI.js";

const router: IRouter = Router();

const DEFAULT_PORTALS = ["Myntra", "Amazon Fashion"];
const ALL_VALID_PORTALS = ["Myntra", "Amazon Fashion", "Ajio", "Flipkart", "Nykaa Fashion", "Meesho", "H&M", "Zara"];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function hasImage(outfit: Record<string, unknown>): boolean {
  return typeof outfit.outfitImage === "string" && (outfit.outfitImage as string).length > 0;
}

function stripImages(outfits: unknown[]): unknown[] {
  return outfits.map((o) => {
    const outfit = o as Record<string, unknown>;
    const { outfitImage: _img, ...rest } = outfit;
    return rest;
  });
}

// Phase 2b: Generate images in background after products are saved.
// Does NOT block the main job — fire and forget.
// userPrompt is the original search query — it carries location, occasion, and season context
// that drives the background/setting of the generated image.
async function generateImagesBackground(
  jobId: string,
  outfits: Record<string, unknown>[],
  userPrompt: string,
): Promise<void> {
  console.log(`[Job ${jobId}] Phase 2b: Starting background image generation for ${outfits.length} outfit(s)…`);
  try {
    await Promise.all(
      outfits.map(async (outfit, idx) => {
        const imgPrompt = buildImagePrompt(outfit, userPrompt);
        console.log(`[Job ${jobId}] Image ${idx} prompt (first 120): "${imgPrompt.slice(0, 120)}…"`);
        const imgData = await generateOutfitImage(imgPrompt);
        if (!imgData) {
          console.warn(`[Job ${jobId}] Image ${idx} generation returned null.`);
          return;
        }
        // Read latest outfits from DB (products may have been merged since we started)
        const current = await db.select().from(outfitJobsTable).where(eq(outfitJobsTable.jobId, jobId)).limit(1);
        const stored = (current[0]?.outfits ?? []) as Record<string, unknown>[];
        stored[idx] = { ...(stored[idx] ?? {}), outfitImage: imgData };
        await db.update(outfitJobsTable).set({ outfits: stored as unknown[] }).where(eq(outfitJobsTable.jobId, jobId));
        console.log(`[Job ${jobId}] Image ${idx} saved.`);
      })
    );
  } catch (err) {
    console.error(`[Job ${jobId}] Image background error:`, err);
  }
}

async function runJob(jobId: string, prompt: string, options: OutfitOptions): Promise<void> {
  const t0 = Date.now();
  try {
    console.log(`[Job ${jobId}] Starting Phase 1 + Phase 2a in PARALLEL…`);

    const structurePromise = generateOutfitStructures(prompt, options);
    const productsPromise = generatePortalProducts(prompt, options).catch((err) => {
      console.error(`[Job ${jobId}] Products error:`, err);
      return {} as Record<string, unknown[]>;
    });

    // Phase 1 done — mark status=done immediately so client renders
    const outfits = await structurePromise;
    console.log(`[Job ${jobId}] Phase 1 done in ${Date.now() - t0}ms`);

    await db.update(outfitJobsTable)
      .set({ status: "done", outfits: outfits as unknown[] })
      .where(eq(outfitJobsTable.jobId, jobId));

    // Phase 2b: start image generation NOW — in parallel with Phase 2a products.
    // Images use outfit structure (top/bottom/footwear descriptions) from Phase 1,
    // so no need to wait for Phase 2a. Saves ~6s of wait.
    // Phase 2b reads from DB when saving, so it will include products if Phase 2a finished first.
    generateImagesBackground(jobId, outfits, prompt).catch(console.error);

    // Phase 2a: products (already running since T=0)
    const itemProducts = await productsPromise;
    console.log(`[Job ${jobId}] Phase 2a done in ${Date.now() - t0}ms`);

    if (itemProducts && Object.keys(itemProducts).length > 0) {
      // Read latest DB state to preserve any images Phase 2b may have already saved
      const current = await db.select().from(outfitJobsTable).where(eq(outfitJobsTable.jobId, jobId)).limit(1);
      const latestOutfits = (current[0]?.outfits ?? outfits) as Record<string, unknown>[];

      const finalOutfits = latestOutfits.map((outfit) => {
        const items = (outfit.items as Record<string, unknown>[]) ?? [];
        return {
          ...outfit,
          items: items.map((item) => ({
            ...item,
            portalProducts: itemProducts[item.id as string] ?? [],
          })),
        };
      });
      await db.update(outfitJobsTable)
        .set({ outfits: finalOutfits as unknown[] })
        .where(eq(outfitJobsTable.jobId, jobId));
      console.log(`[Job ${jobId}] Products saved. Total elapsed: ${Date.now() - t0}ms`);
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Job ${jobId}] Fatal error:`, errorMsg);
    await db.update(outfitJobsTable)
      .set({ status: "error", error: errorMsg })
      .where(eq(outfitJobsTable.jobId, jobId));
  }
}

// ── POST /api/outfit/start ────────────────────────────────────────────────────
router.post("/outfit/start", async (req, res) => {
  const { prompt, portals, minRating, budgetMin, budgetMax, outfitCount } = req.body as {
    prompt?: string; portals?: string[]; minRating?: number;
    budgetMin?: number; budgetMax?: number; outfitCount?: number;
  };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const validPortals = Array.isArray(portals)
    ? portals.filter((p) => ALL_VALID_PORTALS.includes(p))
    : DEFAULT_PORTALS;

  const options: OutfitOptions = {
    portals: validPortals.length > 0 ? validPortals : DEFAULT_PORTALS,
    minRating: typeof minRating === "number" ? Math.max(1, Math.min(5, minRating)) : 4,
    budgetMin: typeof budgetMin === "number" ? budgetMin : 1000,
    budgetMax: typeof budgetMax === "number" ? budgetMax : 10000,
    outfitCount: typeof outfitCount === "number" ? Math.max(1, Math.min(2, outfitCount)) : 1,
  };

  const jobId = generateId();
  await db.insert(outfitJobsTable).values({ jobId, status: "analyzing", prompt: prompt.trim(), outfits: [], error: null });

  runJob(jobId, prompt.trim(), options).catch(console.error);
  res.json({ jobId, status: "analyzing" });
});

// ── GET /api/outfit/poll/:jobId ───────────────────────────────────────────────
router.get("/outfit/poll/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const jobs = await db.select().from(outfitJobsTable).where(eq(outfitJobsTable.jobId, jobId)).limit(1);

  if (jobs.length === 0) { res.status(404).json({ error: "Job not found" }); return; }

  const job = jobs[0];
  const rawOutfits = (job.outfits ?? []) as Record<string, unknown>[];

  const productsReady =
    rawOutfits.length > 0 &&
    rawOutfits.every((o) => {
      const items = (o.items as Record<string, unknown>[]) ?? [];
      return items.every((it) => ((it.portalProducts as unknown[]) ?? []).length > 0);
    });

  const imageReady =
    rawOutfits.length > 0 && rawOutfits.every((o) => hasImage(o));

  res.json({
    jobId: job.jobId,
    status: job.status,
    prompt: job.prompt,
    outfits: stripImages(rawOutfits),
    productsReady,
    imageReady,
    error: job.error ?? null,
    createdAt: job.createdAt?.toISOString() ?? new Date().toISOString(),
  });
});

// ── GET /api/outfit/:jobId/image/:idx ────────────────────────────────────────
router.get("/outfit/:jobId/image/:idx", async (req, res) => {
  const { jobId, idx } = req.params;
  const outfitIndex = parseInt(idx, 10);

  if (isNaN(outfitIndex) || outfitIndex < 0) { res.status(400).json({ error: "Invalid index" }); return; }

  const jobs = await db.select().from(outfitJobsTable).where(eq(outfitJobsTable.jobId, jobId)).limit(1);
  if (jobs.length === 0) { res.status(404).json({ error: "Job not found" }); return; }

  const outfits = (jobs[0].outfits ?? []) as Record<string, unknown>[];
  const outfit = outfits[outfitIndex];

  if (!outfit) { res.status(404).json({ error: "Outfit not found" }); return; }

  // Return cached image
  if (hasImage(outfit)) {
    res.json({ outfitImage: outfit.outfitImage, cached: true });
    return;
  }

  // Not ready yet — 202 Accepted
  res.status(202).json({ generating: true });
});

// ── GET /api/outfit/history ───────────────────────────────────────────────────
router.get("/outfit/history", async (_req, res) => {
  const jobs = await db.select().from(outfitJobsTable)
    .where(eq(outfitJobsTable.status, "done"))
    .orderBy(desc(outfitJobsTable.createdAt))
    .limit(20);

  res.json(jobs.map((j) => ({
    jobId: j.jobId, status: j.status, prompt: j.prompt,
    outfits: stripImages((j.outfits ?? []) as unknown[]),
    error: j.error ?? null,
    createdAt: j.createdAt?.toISOString() ?? new Date().toISOString(),
  })));
});

export default router;
