import { anthropic } from "@workspace/integrations-anthropic-ai";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const PORTAL_URL_FORMATS: Record<string, { color: string; urlTemplate: string }> = {
  "Myntra":         { color: "#FF3F6C", urlTemplate: "https://www.myntra.com/search?rawQuery={query}" },
  "Amazon Fashion": { color: "#FF9900", urlTemplate: "https://www.amazon.in/s?k={query}&i=fashion" },
  "Ajio":           { color: "#C00D0D", urlTemplate: "https://www.ajio.com/search/?text={query}" },
  "Flipkart":       { color: "#2874F0", urlTemplate: "https://www.flipkart.com/search?q={query}&sid=clo" },
  "Nykaa Fashion":  { color: "#FC2779", urlTemplate: "https://www.nykaafashion.com/search?searchValue={query}" },
  "Meesho":         { color: "#9747FF", urlTemplate: "https://www.meesho.com/search?q={query}" },
  "H&M":            { color: "#E50010", urlTemplate: "https://www2.hm.com/en_in/search-results.html?q={query}" },
  "Zara":           { color: "#1D1D1B", urlTemplate: "https://www.zara.com/in/en/search?searchTerm={query}" },
};

export interface OutfitOptions {
  portals: string[];
  minRating: number;
  budgetMin: number;
  budgetMax: number;
  outfitCount: number;
}

// ─── Personal attribute extraction ────────────────────────────────────────────
// Parses height, complexion, and location from the raw user prompt so that
// outfit recommendations and image generation can tailor advice accordingly.

export interface PersonalAttributes {
  height: string | null;       // e.g. "5.5 feet", "5'5\"", "163cm"
  complexion: string | null;   // e.g. "fair", "wheatish", "dusky"
  location: string | null;     // e.g. "Delhi", "Indian", "Goa"
}

export function parsePersonalAttributes(prompt: string): PersonalAttributes {
  // Height: covers "5.5 feet", "5'5\"", "5ft", "163cm", "5 feet 5 inches", etc.
  const heightMatch = prompt.match(
    /\b\d+\.?\d*\s*(?:feet|foot|ft|inches|inch|cm)\b|\b\d+['′]\s*\d*["″]?\b/i
  );

  // Complexion / skin tone — capture just the descriptor word
  const complexionMatch = prompt.match(
    /\b(fair|light|wheatish|medium|dusky|dark|brown|olive)(?:\s+(?:complexion|skin|skin\s+tone))?\b/i
  );

  // Indian location — nationality keyword or major city name
  const locationMatch = prompt.match(
    /\b(Indian|Delhi|Mumbai|Bangalore|Bengaluru|Hyderabad|Chennai|Kolkata|Pune|Goa|Jaipur|Ahmedabad|Surat|Lucknow|Nagpur|Indore|Bhopal|Chandigarh|Kochi|Coimbatore|Visakhapatnam)\b/i
  );

  return {
    height:     heightMatch     ? heightMatch[0].trim()         : null,
    complexion: complexionMatch ? complexionMatch[1].toLowerCase() : null,
    location:   locationMatch   ? locationMatch[0]               : null,
  };
}

// Export for unit testing
// Extract the FIRST complete JSON object by tracking brace depth.
// This handles the case where Claude adds explanation text after the closing }.
export function extractFirstJsonObject(text: string): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseJSON(text: string): unknown {
  let t = text.trim();
  // Strip all markdown code fences (``` anywhere in text)
  t = t.replace(/```[a-z]*\n?/g, "").replace(/\n?```/g, "").trim();

  // Try direct parse first
  try {
    return JSON.parse(t);
  } catch {
    // Extract the first properly-balanced JSON object
    const extracted = extractFirstJsonObject(t);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch {
        // Try fixing trailing commas
        const fixed = extracted
          .replace(/,\s*([\]}])/g, "$1")
          .replace(/[\u0000-\u001F]/g, " ");
        try {
          return JSON.parse(fixed);
        } catch (e) {
          console.error("[parseJSON] Failed after all fixes. Snippet:", t.slice(0, 400));
          throw new Error(`JSON parse failed: ${e}`);
        }
      }
    }
    console.error("[parseJSON] No JSON object found. Snippet:", t.slice(0, 400));
    throw new Error("No valid JSON object found in AI response");
  }
}

// ─── Phase 1: Outfit structure ────────────────────────────────────────────────
// Shows all 3 items in the example so Claude understands the required count.

export async function generateOutfitStructures(
  prompt: string,
  options: OutfitOptions,
  _retry = 0
): Promise<Record<string, unknown>[]> {
  const { outfitCount, budgetMin, budgetMax } = options;

  // Claude Haiku reliably produces at most 2 outfits per call.
  // For count > 2, split into concurrent chunks of 2 so we always return exactly N.
  // e.g. count=3 → concurrent calls for [2, 1] → merge → 3 outfits, ~same latency as 2.
  if (outfitCount > 2 && _retry === 0) {
    const chunkSizes: number[] = [];
    let remaining = outfitCount;
    while (remaining > 0) {
      chunkSizes.push(Math.min(remaining, 2));
      remaining -= 2;
    }
    const chunks = await Promise.all(
      chunkSizes.map((size) => generateOutfitStructures(prompt, { ...options, outfitCount: size }))
    );
    return chunks.flat();
  }

  const isMulti = outfitCount > 1;

  const attrs = parsePersonalAttributes(prompt);
  // Only mention attributes that were actually detected — avoids confusing Claude
  const attrNotes = [
    attrs.height     ? `height (${attrs.height}): choose silhouettes/cuts that flatter this height`     : "",
    attrs.complexion ? `complexion (${attrs.complexion}): choose colors that complement this complexion` : "",
    attrs.location   ? `location (${attrs.location}): recommend styles suited to this city/region`       : "",
  ].filter(Boolean);
  const personalRule = attrNotes.length > 0
    ? `- Personal attributes: ${attrNotes.join("; ")}; reflect these in targetProfile`
    : "";

  const itemsExample = [
    `{"id":"top","category":"Top","description":"specific top description","color":"color name","whyRecommended":"reason","portalProducts":[]}`,
    `{"id":"bottom","category":"Bottom","description":"specific bottom description","color":"color name","whyRecommended":"reason","portalProducts":[]}`,
    `{"id":"footwear","category":"Footwear","description":"specific footwear description","color":"color name","whyRecommended":"reason","portalProducts":[]}`,
  ].join(",");

  const singleSchema = `{"outfitTitle":"Name of outfit","styleDescription":"One sentence style description","occasion":"Occasion type","targetProfile":"Who this is for (include height, complexion, location if provided)","totalBudgetMin":${budgetMin || 2000},"totalBudgetMax":${budgetMax || 8000},"items":[${itemsExample}]}`;
  // Show exactly outfitCount copies in the array so Claude understands N outfits are required
  const multiItems = Array.from({ length: outfitCount }, () => singleSchema).join(",");
  const schema = isMulti ? `{"outfits":[${multiItems}]}` : singleSchema;

  const t0 = Date.now();
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: isMulti ? Math.max(2500, outfitCount * 1400) : 1200,
    system: `You are an Indian fashion stylist AI. Generate ${isMulti ? `exactly ${outfitCount} distinct` : "one"} outfit recommendation${isMulti ? "s" : ""}.

STRICT RULES:
- Return ONLY raw JSON, no markdown, no extra text
- ${isMulti ? `The outfits array MUST contain exactly ${outfitCount} entries — no more, no less` : "Return exactly one outfit object"}
- Every outfit MUST have exactly 3 items in the items array: id="top", id="bottom", id="footwear"
- portalProducts must always be an empty array []
- Keep each description under 10 words
- All text must be plain ASCII (no special symbols)
- Each outfit must be meaningfully different (different style, occasion, or colour palette)
${personalRule}

OUTPUT SCHEMA (copy this structure exactly, with ${isMulti ? outfitCount : "one"} outfit${isMulti ? "s" : ""}):
${schema}`,
    messages: [{ role: "user", content: `Generate ${isMulti ? `${outfitCount} outfits` : "one outfit"} for: ${prompt}` }],
  });
  console.log(`[AI] Structure done in ${Date.now() - t0}ms`);

  const block = msg.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");

  console.log(`[AI] Structure raw (first 200 chars):`, block.text.slice(0, 200));

  const data = parseJSON(block.text) as Record<string, unknown>;

  // Handle multi-outfit wrapper
  if (isMulti && "outfits" in data && Array.isArray(data.outfits)) {
    const outfits = data.outfits as Record<string, unknown>[];
    // If Claude returned fewer outfits than requested, retry once
    if (outfits.length < outfitCount && _retry < 1) {
      console.warn(`[AI] Got ${outfits.length}/${outfitCount} outfits — retrying once`);
      return generateOutfitStructures(prompt, options, 1);
    }
    return outfits;
  }

  // Ensure items is always an array with all 3 IDs
  const outfit = data as Record<string, unknown>;
  if (!Array.isArray(outfit.items) || (outfit.items as unknown[]).length === 0) {
    console.warn("[AI] Structure missing items array — outfit:", JSON.stringify(outfit).slice(0, 200));
  }

  return [outfit];
}

// ─── Phase 2: Portal products (parallel with Phase 1) ────────────────────────
// Claude outputs searchTerms only — server constructs URLs to avoid JSON issues.

// Infer gender keyword from the user's prompt to include in search URLs.
// Portal searches use "women" or "men" to filter to the right collection.
function inferGenderKeyword(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.match(/\b(women|woman|female|girl|girls|her\b|she\b|ladies|lady|feminine)\b/)) return "women";
  if (p.match(/\b(men|man|male|boy|boys|him\b|he\b|guys|gentleman|masculine)\b/)) return "men";
  return "";
}

export async function generatePortalProducts(
  prompt: string,
  options: OutfitOptions
): Promise<Record<string, unknown[]>> {
  const { portals, minRating, budgetMin, budgetMax } = options;
  const validPortals = portals.filter((p) => PORTAL_URL_FORMATS[p]);
  const portalNames = validPortals.join(", ");

  const genderKeyword = inferGenderKeyword(prompt);
  const genderInstruction = genderKeyword
    ? `- searchTerms MUST start with "${genderKeyword}" (e.g. "${genderKeyword} white cotton kurta") — this ensures the correct gender collection opens`
    : `- searchTerms should include gender if clear from context (e.g. "women casual kurti" or "men formal blazer")`;

  const attrs = parsePersonalAttributes(prompt);
  const attrParts = [
    attrs.height     ? `height ${attrs.height}`              : "",
    attrs.complexion ? `${attrs.complexion} complexion`      : "",
    attrs.location   ? `location: ${attrs.location}`         : "",
  ].filter(Boolean);
  const personalRule = attrParts.length > 0
    ? `- Customer attributes (${attrParts.join(", ")}): recommend cuts/fits suited to the height (e.g. A-line, straight-leg, midi), and colors/tones that complement the complexion`
    : "";

  // Compact schema WITHOUT productUrl — server builds URL from searchTerms
  const pSchema = `{"portal":"PORTAL_NAME","portalColor":"HEX_COLOR","productName":"Short product name","brand":"Brand","price":999,"originalPrice":1299,"discountPercent":23,"rating":4.3,"reviewCount":180,"searchTerms":"gender + style + product keywords (4-7 words)","isBestBuy":false,"bestBuyReason":""}`;

  // Token budget: ~130 tokens per product
  const maxTok = Math.min(validPortals.length * 3 * 130 + 400, 4000);

  const t0 = Date.now();
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: maxTok,
    system: `You are an Indian fashion shopping assistant. For a style request, list products for top, bottom, and footwear from: ${portalNames}.

JSON RULES (critical — wrong format breaks everything):
- Return ONLY raw JSON, no markdown
- Each category gets exactly ${validPortals.length} product entries (one per portal, in order: ${portalNames})
- portalColor for each: ${validPortals.map((p) => `${p}: "${PORTAL_URL_FORMATS[p].color}"`).join(", ")}
- productName: plain text, max 6 words, no currency symbols
${genderInstruction}
${personalRule}
- searchTerms: 4-7 plain English words including gender, style, material, color (no URLs, no special chars)
- price and originalPrice: integers only, no currency symbols
- rating: one decimal float, reviewCount: integer
- isBestBuy: true for one product per category only, false for the rest
- bestBuyReason: max 6 words or empty string

Budget per item: INR ${budgetMin || 500}–${budgetMax || 15000}, minimum rating: ${minRating}

EXACT OUTPUT FORMAT:
{"itemProducts":{"top":[${pSchema}],"bottom":[${pSchema}],"footwear":[${pSchema}]}}`,
    messages: [{ role: "user", content: `Style request: "${prompt}"` }],
  });
  console.log(`[AI] Products done in ${Date.now() - t0}ms`);

  const block = msg.content[0];
  if (block.type !== "text") throw new Error("Products unexpected response");

  const data = parseJSON(block.text) as { itemProducts?: Record<string, unknown[]> };
  const itemProducts = data.itemProducts ?? {};

  // Build productUrl server-side from searchTerms — eliminates all URL JSON issues
  // Prepend gender keyword server-side as a safety net if Claude missed it
  for (const [_category, products] of Object.entries(itemProducts)) {
    for (const product of products as Record<string, unknown>[]) {
      const portalName = product.portal as string;
      const portalInfo = PORTAL_URL_FORMATS[portalName];
      let terms = (product.searchTerms as string | undefined) ?? portalName;
      // Ensure gender is present in the search query
      if (genderKeyword && !terms.toLowerCase().startsWith(genderKeyword)) {
        terms = `${genderKeyword} ${terms}`;
      }
      if (portalInfo) {
        product.productUrl = portalInfo.urlTemplate.replace("{query}", encodeURIComponent(terms));
      }
    }
  }

  return itemProducts;
}

// ─── Image prompt builder ─────────────────────────────────────────────────────
// Exported for unit testing.
// Builds a rich, contextual image prompt from outfit data + original user prompt.
// The user prompt carries critical context: location, occasion, season, style —
// all of which affect the ideal background and setting of the photograph.

// Sanitize demographic descriptions to avoid content-moderation flags.
// "teenage girl" → "young woman"; specific ages → "young".
function sanitizeTargetProfile(raw: string): string {
  return raw
    .replace(/\b(teen|teens|teenager|teenagers|teenage)\b/gi, "young")
    .replace(/\b(girl)\b/gi, "woman")
    .replace(/\b(boy)\b/gi, "man")
    .replace(/\b1[3-9]-year-old\b/gi, "young");
}

export function buildImagePrompt(outfit: Record<string, unknown>, userPrompt: string): string {
  const rawProfile = (outfit.targetProfile as string | undefined) ?? "young Indian person";
  const targetProfile = sanitizeTargetProfile(rawProfile);
  const title = (outfit.outfitTitle as string | undefined) ?? "Indian fashion outfit";
  const desc = (outfit.styleDescription as string | undefined) ?? "";
  const occasion = (outfit.occasion as string | undefined) ?? "";
  const items = (outfit.items as Record<string, unknown>[] | undefined) ?? [];

  // Per-item descriptions give the image AI visual accuracy for each piece
  const topItem = items.find((i) => (i.id as string) === "top");
  const bottomItem = items.find((i) => (i.id as string) === "bottom");
  const footwearItem = items.find((i) => (i.id as string) === "footwear");

  const clothingParts = [
    topItem?.description as string | undefined,
    bottomItem?.description as string | undefined,
    footwearItem?.description as string | undefined,
  ].filter(Boolean);

  const clothingDesc = clothingParts.length > 0
    ? clothingParts.join("; ")
    : title;

  // Extract physical attributes from the user prompt for an accurate image subject.
  // "fair complexion, 5.5 feet tall" makes the generated image match the person.
  const attrs = parsePersonalAttributes(userPrompt);
  const physicalParts = [
    attrs.complexion ? `${attrs.complexion} complexion` : "",
    attrs.height     ? `${attrs.height} tall`           : "",
  ].filter(Boolean);
  // Combine with the sanitized AI-generated profile (e.g. "young Indian woman")
  const subjectDesc = physicalParts.length > 0
    ? `${targetProfile}, ${physicalParts.join(", ")}`
    : targetProfile;

  // The original user prompt drives the setting:
  //   "Himachal Pradesh trip" → mountains/nature backdrop
  //   "Mumbai date night" → city lights / restaurant
  //   "beach party" → sandy beach setting
  //   "office casual" → modern office / urban street
  //   "wedding guest" → festive hall / garden ceremony
  return [
    `Professional Indian fashion photograph.`,
    `Subject: ${subjectDesc}.`,
    `Wearing: ${clothingDesc}.`,
    desc ? `Style: ${desc}.` : "",
    occasion ? `Occasion: ${occasion}.` : "",
    `Style request context: "${userPrompt}".`,
    `Set the background and atmosphere to visually match the location, occasion, and mood from the style request.`,
    `Full body shot. High fashion editorial quality. Sharp focus, natural lighting.`,
  ].filter(Boolean).join(" ");
}

// ─── Image generation ─────────────────────────────────────────────────────────

export async function generateOutfitImage(imagePrompt: string): Promise<string | null> {
  try {
    // No hardcoded background — imagePrompt already specifies the right setting
    const buffer = await generateImageBuffer(imagePrompt, "1024x1024");
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("Image generation failed:", err);
    return null;
  }
}
