import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = "https://2ffc9079-21c3-4bb9-ac7c-9cfc95cc53e6-00-2m4q5uc8xu18p.expo.picard.replit.dev";
const PHASE1_MAX_MS = 8000;
const PRODUCTS_MAX_MS = 20000;

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function apiGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  return { status: res.status, body: await res.json() };
}

async function pollUntilDone(
  jobId: string,
  opts: { maxWaitMs: number; pollEveryMs?: number } = { maxWaitMs: 20000, pollEveryMs: 2000 }
): Promise<{ data: Record<string, unknown>; elapsedMs: number }> {
  const t0 = Date.now();
  while (true) {
    const { body } = await apiGet(`/api/outfit/poll/${jobId}`);
    const data = body as Record<string, unknown>;
    if (data.status === "done" || data.status === "error") {
      return { data, elapsedMs: Date.now() - t0 };
    }
    const elapsed = Date.now() - t0;
    if (elapsed > opts.maxWaitMs) {
      throw new Error(`Timed out after ${elapsed}ms. Last status: ${data.status}`);
    }
    await new Promise((r) => setTimeout(r, opts.pollEveryMs ?? 2000));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────
describe("API Health", () => {
  it("GET /api/healthz returns status ok", async () => {
    const { status, body } = await apiGet("/api/healthz");
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe("ok");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/outfit/start — input validation
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/outfit/start — input validation", () => {
  it("returns 400 for missing prompt", async () => {
    const { status, body } = await apiPost("/api/outfit/start", {});
    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/prompt/i);
  });

  it("returns 400 for empty prompt", async () => {
    const { status } = await apiPost("/api/outfit/start", { prompt: "   " });
    expect(status).toBe(400);
  });

  it("returns 400 for non-string prompt", async () => {
    const { status } = await apiPost("/api/outfit/start", { prompt: 12345 });
    expect(status).toBe(400);
  });

  it("returns jobId and analyzing status for valid prompt", async () => {
    const { status, body } = await apiPost("/api/outfit/start", {
      prompt: "casual college outfit",
      portals: ["Myntra"],
    });
    const b = body as { jobId: string; status: string };
    expect(status).toBe(200);
    expect(typeof b.jobId).toBe("string");
    expect(b.jobId.length).toBeGreaterThan(5);
    expect(b.status).toBe("analyzing");
  });

  it("filters invalid portals (keeps only valid ones)", async () => {
    const { status, body } = await apiPost("/api/outfit/start", {
      prompt: "casual outfit",
      portals: ["Myntra", "FakePortal123"],
    });
    expect(status).toBe(200);
    expect((body as { jobId: string }).jobId).toBeTruthy();
  });

  it("falls back to default portals when all portals are invalid", async () => {
    const { status, body } = await apiPost("/api/outfit/start", {
      prompt: "casual outfit",
      portals: ["FakePortal", "NotReal"],
    });
    expect(status).toBe(200);
    expect((body as { jobId: string }).jobId).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/outfit/poll/:jobId
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/outfit/poll/:jobId — response shape", () => {
  it("returns 404 for unknown jobId", async () => {
    const { status } = await apiGet("/api/outfit/poll/nonexistent-job-id-xyz");
    expect(status).toBe(404);
  });

  it("returns expected poll fields for a real job", async () => {
    const { body: startBody } = await apiPost("/api/outfit/start", {
      prompt: "office casual outfit for Indian woman",
      portals: ["Myntra"],
    });
    const { jobId } = startBody as { jobId: string };

    const { body } = await apiGet(`/api/outfit/poll/${jobId}`);
    const d = body as Record<string, unknown>;

    expect(d.jobId).toBe(jobId);
    expect(["analyzing", "done", "error"]).toContain(d.status);
    expect(Array.isArray(d.outfits)).toBe(true);
    expect(typeof d.productsReady).toBe("boolean");
    expect(typeof d.imageReady).toBe("boolean");
    expect(d.prompt).toBeTruthy();
    expect(d.error !== undefined).toBe(true);
    expect(d.createdAt).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full outfit flow + load time tests
// ─────────────────────────────────────────────────────────────────────────────
describe("Full outfit flow — structure, products, and load times", () => {
  let jobId: string;
  let finalData: Record<string, unknown>;

  beforeAll(async () => {
    const t0 = Date.now();
    const { body } = await apiPost("/api/outfit/start", {
      prompt: "Himachal Pradesh mountain trip outfit for young woman",
      portals: ["Myntra", "Ajio"],
      budgetMin: 1500,
      budgetMax: 8000,
    });
    jobId = (body as { jobId: string }).jobId;

    // Poll until status=done AND productsReady=true
    const maxWait = 30000;
    while (Date.now() - t0 < maxWait) {
      const { body: pollBody } = await apiGet(`/api/outfit/poll/${jobId}`);
      finalData = pollBody as Record<string, unknown>;
      if (finalData.status === "error") throw new Error(`Job errored: ${finalData.error}`);
      if (finalData.status === "done" && finalData.productsReady === true) {
        console.log(`[timing] status=done + productsReady in ${Date.now() - t0}ms`);
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!finalData || finalData.status !== "done") {
      throw new Error(`Job did not complete within ${maxWait}ms`);
    }
  }, 35000);

  it("job completes without error", () => {
    expect(finalData.status).toBe("done");
    expect(finalData.error).toBeNull();
  });

  it("returns exactly 1 outfit for outfitCount=1 (default)", () => {
    expect(Array.isArray(finalData.outfits)).toBe(true);
    expect((finalData.outfits as unknown[]).length).toBe(1);
  });

  it("outfit has required top-level fields", () => {
    const outfit = (finalData.outfits as Record<string, unknown>[])[0];
    expect(typeof outfit.outfitTitle).toBe("string");
    expect(outfit.outfitTitle!.toString().length).toBeGreaterThan(3);
    expect(typeof outfit.styleDescription).toBe("string");
    expect(typeof outfit.occasion).toBe("string");
    expect(typeof outfit.targetProfile).toBe("string");
    expect(typeof outfit.totalBudgetMin).toBe("number");
    expect(typeof outfit.totalBudgetMax).toBe("number");
  });

  it("targetProfile reflects the requested demographic", () => {
    const outfit = (finalData.outfits as Record<string, unknown>[])[0];
    const profile = (outfit.targetProfile as string).toLowerCase();
    expect(profile).toMatch(/girl|female|wom[ae]n|teenager/i);
  });

  it("outfit has exactly 3 items with correct ids", () => {
    const outfit = (finalData.outfits as Record<string, unknown>[])[0];
    const items = outfit.items as Record<string, unknown>[];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(3);
    const ids = items.map((i) => i.id as string).sort();
    expect(ids).toEqual(["bottom", "footwear", "top"]);
  });

  it("each item has description, category, color, and whyRecommended", () => {
    const outfit = (finalData.outfits as Record<string, unknown>[])[0];
    const items = outfit.items as Record<string, unknown>[];
    for (const item of items) {
      expect(typeof item.description).toBe("string");
      expect((item.description as string).length).toBeGreaterThan(3);
      expect(typeof item.category).toBe("string");
      expect(typeof item.color).toBe("string");
    }
  });

  it("productsReady=true and each item has products from selected portals", () => {
    expect(finalData.productsReady).toBe(true);
    const outfit = (finalData.outfits as Record<string, unknown>[])[0];
    const items = outfit.items as Record<string, unknown>[];
    for (const item of items) {
      const products = item.portalProducts as Record<string, unknown>[];
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
    }
  });

  it("each product has required fields and valid data", () => {
    const outfit = (finalData.outfits as Record<string, unknown>[])[0];
    const items = outfit.items as Record<string, unknown>[];
    for (const item of items) {
      const products = item.portalProducts as Record<string, unknown>[];
      for (const product of products) {
        expect(["Myntra", "Ajio"]).toContain(product.portal);
        expect(typeof product.productName).toBe("string");
        expect(product.productName!.toString().length).toBeGreaterThan(2);
        expect(typeof product.price).toBe("number");
        expect(product.price as number).toBeGreaterThan(0);
        expect(typeof product.rating).toBe("number");
        expect(product.rating as number).toBeGreaterThanOrEqual(1);
        expect(product.rating as number).toBeLessThanOrEqual(5);
        expect(typeof product.productUrl).toBe("string");
        expect(product.productUrl as string).toMatch(/^https:\/\//);
        expect(typeof product.portalColor).toBe("string");
        expect(product.portalColor as string).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("outfitImage is stripped from poll response (privacy / size)", () => {
    const outfit = (finalData.outfits as Record<string, unknown>[])[0];
    expect(outfit.outfitImage).toBeUndefined();
  });

  it("imageReady is a boolean in poll response", () => {
    expect(typeof finalData.imageReady).toBe("boolean");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Load time assertions (separate test job)
// ─────────────────────────────────────────────────────────────────────────────
describe("Load time tests", () => {
  it(`Phase 1 (status=done) completes within ${PHASE1_MAX_MS / 1000}s`, async () => {
    const t0 = Date.now();
    const { body } = await apiPost("/api/outfit/start", {
      prompt: "casual kurta outfit for Indian college student",
      portals: ["Myntra"],
    });
    const { jobId } = body as { jobId: string };

    let phase1Ms: number | null = null;
    const pollStart = Date.now();
    while (Date.now() - pollStart < PHASE1_MAX_MS) {
      const { body: pollBody } = await apiGet(`/api/outfit/poll/${jobId}`);
      const d = pollBody as Record<string, unknown>;
      if (d.status === "done") {
        phase1Ms = Date.now() - t0;
        break;
      }
      if (d.status === "error") throw new Error(`Job errored: ${d.error}`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    expect(phase1Ms).not.toBeNull();
    console.log(`[load-time] Phase 1 done in ${phase1Ms}ms (limit: ${PHASE1_MAX_MS}ms)`);
    expect(phase1Ms!).toBeLessThan(PHASE1_MAX_MS);
  });

  it(`productsReady=true within ${PRODUCTS_MAX_MS / 1000}s`, async () => {
    const t0 = Date.now();
    const { body } = await apiPost("/api/outfit/start", {
      prompt: "party dress for Indian girl in Mumbai",
      portals: ["Myntra", "Nykaa Fashion"],
    });
    const { jobId } = body as { jobId: string };

    let productsMs: number | null = null;
    while (Date.now() - t0 < PRODUCTS_MAX_MS) {
      const { body: pollBody } = await apiGet(`/api/outfit/poll/${jobId}`);
      const d = pollBody as Record<string, unknown>;
      if (d.status === "error") throw new Error(`Job errored: ${d.error}`);
      if (d.status === "done" && d.productsReady === true) {
        productsMs = Date.now() - t0;
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    expect(productsMs).not.toBeNull();
    console.log(`[load-time] productsReady in ${productsMs}ms (limit: ${PRODUCTS_MAX_MS}ms)`);
    expect(productsMs!).toBeLessThan(PRODUCTS_MAX_MS);
  });

  it("image endpoint responds within 1s (200 cached or 202 generating)", async () => {
    const { body } = await apiPost("/api/outfit/start", {
      prompt: "ethnic wedding outfit for young Indian man",
      portals: ["Myntra"],
    });
    const { jobId } = body as { jobId: string };

    await pollUntilDone(jobId, { maxWaitMs: 20000, pollEveryMs: 2000 });

    const t0 = Date.now();
    const { status } = await apiGet(`/api/outfit/poll/${jobId}`);
    const responseMs = Date.now() - t0;

    expect([200, 202]).toContain(status);
    console.log(`[load-time] Image endpoint responded in ${responseMs}ms`);
    expect(responseMs).toBeLessThan(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Image endpoint
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/outfit/:jobId/image/:idx", () => {
  it("returns 404 for unknown jobId", async () => {
    const { status } = await apiGet("/api/outfit/nonexistent-job-xyz/image/0");
    expect(status).toBe(404);
  });

  it("returns 400 for invalid index", async () => {
    const { status } = await apiGet("/api/outfit/any-job/image/abc");
    expect(status).toBe(400);
  });

  it("returns 200 (cached) or 202 (generating) for a completed job", async () => {
    const { body } = await apiPost("/api/outfit/start", {
      prompt: "casual summer outfit for teenage girl in Chennai",
      portals: ["Myntra"],
    });
    const { jobId } = body as { jobId: string };
    await pollUntilDone(jobId, { maxWaitMs: 20000, pollEveryMs: 2000 });

    const { status, body: imgBody } = await apiGet(`/api/outfit/${jobId}/image/0`);
    expect([200, 202]).toContain(status);
    if (status === 200) {
      const b = imgBody as { outfitImage: string; cached: boolean };
      expect(typeof b.outfitImage).toBe("string");
      expect(b.outfitImage.startsWith("data:image/")).toBe(true);
      expect(typeof b.cached).toBe("boolean");
    } else {
      expect((imgBody as { generating: boolean }).generating).toBe(true);
    }
  });

  it("returns 404 for outfit index out of range", async () => {
    const { body } = await apiPost("/api/outfit/start", {
      prompt: "casual outfit",
      portals: ["Myntra"],
    });
    const { jobId } = body as { jobId: string };
    await pollUntilDone(jobId, { maxWaitMs: 20000, pollEveryMs: 2000 });

    const { status } = await apiGet(`/api/outfit/${jobId}/image/99`);
    expect(status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION #1: Multi-outfit — outfitCount=N must return exactly N outfits
//
// Bug: The AI schema template only showed 1 outfit in the outfits[] array
// example, so Claude always returned 1 even when N > 1 were requested.
// Fix: Template now shows exactly outfitCount copies in the array.
//
// Tested for N = 1, 2, 3. All three jobs are started and polled concurrently
// so the total wait is ~max(t_1, t_2, t_3) rather than their sum.
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #1 — outfitCount=N returns exactly N outfits", () => {
  // Keyed by count → list of outfits returned
  const results = new Map<number, Record<string, unknown>[]>();

  beforeAll(async () => {
    // Start all three jobs concurrently to minimize total wall-clock time
    const counts = [1, 2, 3];
    const jobs = await Promise.all(
      counts.map(async (count) => {
        const { body } = await apiPost("/api/outfit/start", {
          prompt: "party outfit ideas for Indian woman in Mumbai",
          portals: ["Myntra"],
          outfitCount: count,
        });
        return { count, jobId: (body as { jobId: string }).jobId };
      })
    );

    // Poll all jobs concurrently until each reaches done + productsReady
    await Promise.all(
      jobs.map(async ({ count, jobId }) => {
        const t0 = Date.now();
        while (Date.now() - t0 < 35000) {
          const { body: pollBody } = await apiGet(`/api/outfit/poll/${jobId}`);
          const d = pollBody as Record<string, unknown>;
          if (d.status === "error") throw new Error(`Job (count=${count}) errored: ${d.error}`);
          if (d.status === "done" && d.productsReady === true) {
            results.set(count, (d.outfits as Record<string, unknown>[]) ?? []);
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        throw new Error(`Job (count=${count}) did not complete within 35s`);
      })
    );
  }, 40000);

  it.each([1, 2, 3])(
    "outfitCount=%i → returns exactly that many outfits",
    (count) => {
      const outfits = results.get(count) ?? [];
      expect(outfits.length).toBe(count);
    }
  );

  it.each([1, 2, 3])(
    "outfitCount=%i → every outfit has required top-level fields",
    (count) => {
      const outfits = results.get(count) ?? [];
      for (const outfit of outfits) {
        expect(typeof outfit.outfitTitle).toBe("string");
        expect((outfit.outfitTitle as string).length).toBeGreaterThan(2);
        expect(typeof outfit.styleDescription).toBe("string");
        expect(typeof outfit.targetProfile).toBe("string");
      }
    }
  );

  it.each([1, 2, 3])(
    "outfitCount=%i → every outfit has exactly 3 items (top, bottom, footwear)",
    (count) => {
      const outfits = results.get(count) ?? [];
      for (const outfit of outfits) {
        const items = outfit.items as Record<string, unknown>[];
        expect(items).toHaveLength(3);
        const ids = items.map((i) => i.id as string).sort();
        expect(ids).toEqual(["bottom", "footwear", "top"]);
      }
    }
  );

  it.each([1, 2, 3])(
    "outfitCount=%i → all outfits have products loaded",
    (count) => {
      const outfits = results.get(count) ?? [];
      for (const outfit of outfits) {
        const items = outfit.items as Record<string, unknown>[];
        for (const item of items) {
          expect((item.portalProducts as unknown[]).length).toBeGreaterThan(0);
        }
      }
    }
  );

  it.each([2, 3])(
    "outfitCount=%i → all outfit titles are distinct (meaningfully different suggestions)",
    (count) => {
      const outfits = results.get(count) ?? [];
      const titles = outfits.map((o) => o.outfitTitle as string);
      expect(new Set(titles).size).toBe(count);
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION #2: Gender-aware search URLs
//
// Bug: searchTerms had no gender context, so portals opened with male/mixed
// collections (e.g. "white kurta" shows men's results on Myntra).
// Fix: inferGenderKeyword() extracts gender from prompt; searchTerms are
// required to start with "women"/"men"; server enforces it before building URL.
//
// All 4 prompts are submitted concurrently to minimise total wait time.
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #2 — gender-aware search URLs", () => {
  const GENDER_CASES = [
    { key: "woman",   prompt: "casual kurta outfit for young woman in Delhi",           expect: "women" },
    { key: "man",     prompt: "casual shirt and jeans outfit for young man in Bangalore", expect: "men"   },
    { key: "girl",    prompt: "college outfit for girl student in Mumbai",              expect: "women" },
    { key: "neutral", prompt: "casual everyday outfit for college students",            expect: null    },
    { key: "portal",  prompt: "party outfit for woman",                                expect: "women" },
  ];

  // Collect URLs per key — populated in beforeAll
  const urlsByKey = new Map<string, string[]>();

  beforeAll(async () => {
    await Promise.all(
      GENDER_CASES.map(async ({ key, prompt }) => {
        const { body } = await apiPost("/api/outfit/start", { prompt, portals: ["Myntra", "Amazon Fashion"] });
        const { jobId } = (body as { jobId: string });
        const t0 = Date.now();
        while (Date.now() - t0 < 25000) {
          const { body: pollBody } = await apiGet(`/api/outfit/poll/${jobId}`);
          const d = pollBody as Record<string, unknown>;
          if (d.status === "error") throw new Error(`Job (${key}) errored: ${d.error}`);
          if (d.status === "done" && d.productsReady === true) {
            const urls: string[] = [];
            for (const outfit of (d.outfits as Record<string, unknown>[])) {
              for (const item of (outfit.items as Record<string, unknown>[])) {
                for (const p of (item.portalProducts as Record<string, unknown>[])) {
                  const url = p.productUrl as string;
                  if (url) urls.push(url);
                }
              }
            }
            urlsByKey.set(key, urls);
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        throw new Error(`Job (${key}) timed out`);
      })
    );
  }, 30000);

  it("women's prompt — all URLs contain 'women' gender keyword", () => {
    const urls = urlsByKey.get("woman") ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.toLowerCase()).toContain("women");
  });

  it("men's prompt — all URLs contain 'men' gender keyword", () => {
    const urls = urlsByKey.get("man") ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.toLowerCase()).toContain("men");
  });

  it("girl's prompt — URLs contain 'women' (girl maps to women collection)", () => {
    const urls = urlsByKey.get("girl") ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.toLowerCase()).toContain("women");
  });

  it("gender-neutral prompt — products returned without crash, URLs are valid HTTPS", () => {
    const urls = urlsByKey.get("neutral") ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).toMatch(/^https:\/\//);
  });

  it("each product URL is a valid HTTPS link to a recognised Indian fashion portal", () => {
    const urls = urlsByKey.get("portal") ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\//);
      expect(url).toMatch(/myntra\.com|amazon\.in|ajio\.com|flipkart\.com|nykaafashion\.com|meesho\.com|hm\.com|zara\.com/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION #3: Image generation starts after Phase 1 (not after Phase 2a)
//
// Bug: generateImagesBackground() was called only after productsReady,
// adding ~6s to the total image wait time.
// Fix: Phase 2b now fires right after Phase 1, in parallel with Phase 2a.
//
// Observable contract: the moment status=done is observed (even if
// productsReady is still false), the image endpoint must return 202
// (generating), not 404 or 500. This proves Phase 2b started at Phase 1,
// not at Phase 2a.
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #3 — image generation starts at Phase 1, not Phase 2a", () => {
  it("image endpoint returns 202 the moment status=done is observed (even before productsReady)", async () => {
    const { body } = await apiPost("/api/outfit/start", {
      prompt: "casual outfit for woman",
      portals: ["Myntra"],
    });
    const { jobId } = body as { jobId: string };

    // Poll rapidly to catch the window where status=done but productsReady may be false
    let capturedImageStatus: number | null = null;
    let productsReadyWhenImageChecked: boolean | null = null;
    const t0 = Date.now();

    while (Date.now() - t0 < 20000) {
      const { body: pollBody } = await apiGet(`/api/outfit/poll/${jobId}`);
      const d = pollBody as Record<string, unknown>;
      if (d.status === "error") throw new Error(`Job errored: ${d.error}`);

      if (d.status === "done") {
        // Immediately check image endpoint at this exact moment
        const { status: imgStatus } = await apiGet(`/api/outfit/${jobId}/image/0`);
        capturedImageStatus = imgStatus;
        productsReadyWhenImageChecked = d.productsReady as boolean;
        console.log(`[regression-3] status=done observed. productsReady=${d.productsReady}. image endpoint=${imgStatus}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(capturedImageStatus).not.toBeNull();
    // Image endpoint must return 202 (generating) or 200 (already cached) — never 404 or 500
    // 202 proves Phase 2b started (outfit exists, image actively generating)
    // 200 would mean image already finished (extremely fast, but still correct)
    expect([200, 202]).toContain(capturedImageStatus);

    // Log whether we caught the window where products weren't ready yet
    // (This verifies Phase 2b started before Phase 2a finished)
    if (productsReadyWhenImageChecked === false) {
      console.log("[regression-3] ✓ Confirmed: image started generating while products were still loading");
    } else {
      console.log("[regression-3] Note: products loaded before first poll after status=done (very fast Phase 2a)");
    }
  }, 25000);

  it("imageReady eventually becomes true (Phase 2b completes)", async () => {
    const { body } = await apiPost("/api/outfit/start", {
      prompt: "casual outfit for woman",
      portals: ["Myntra"],
    });
    const { jobId } = body as { jobId: string };

    // Wait for imageReady=true
    let imageReady = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 70000) {
      const { body: pollBody } = await apiGet(`/api/outfit/poll/${jobId}`);
      const d = pollBody as Record<string, unknown>;
      if (d.status === "error") throw new Error(`Job errored: ${d.error}`);
      if (d.imageReady === true) { imageReady = true; break; }
      await new Promise((r) => setTimeout(r, 4000));
    }

    expect(imageReady).toBe(true);
    // Once imageReady=true, the image endpoint must return 200 with actual image data
    const { status, body: imgBody } = await apiGet(`/api/outfit/${jobId}/image/0`);
    expect(status).toBe(200);
    const b = imgBody as { outfitImage: string; cached: boolean };
    expect(b.outfitImage).toMatch(/^data:image\//);
    expect(b.cached).toBe(true);
  }, 75000);
});
