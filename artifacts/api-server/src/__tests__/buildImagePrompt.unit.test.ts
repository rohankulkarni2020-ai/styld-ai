import { describe, it, expect } from "vitest";
import { buildImagePrompt, parsePersonalAttributes } from "../lib/outfitAI.js";

const SAMPLE_OUTFIT = {
  outfitTitle: "Mountain Adventure Look",
  styleDescription: "Comfortable and practical outfit for trekking.",
  occasion: "Hill station trip",
  targetProfile: "16-year-old Indian girl",
  totalBudgetMin: 2000,
  totalBudgetMax: 8000,
  items: [
    { id: "top", category: "Top", description: "Warm navy fleece jacket", color: "navy", whyRecommended: "Keeps warm", portalProducts: [] },
    { id: "bottom", category: "Bottom", description: "Grey trekking trousers", color: "grey", whyRecommended: "Durable", portalProducts: [] },
    { id: "footwear", category: "Footwear", description: "Brown leather hiking boots", color: "brown", whyRecommended: "Good grip", portalProducts: [] },
  ],
};

describe("buildImagePrompt — unit tests", () => {
  it("includes sanitized targetProfile (age/demographic) in prompt", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "Himachal Pradesh trip for young woman");
    // "16-year-old" → "young", "girl" → "woman" after sanitization
    expect(prompt.toLowerCase()).toContain("young indian woman");
    expect(prompt.toLowerCase()).not.toContain("16-year-old");
    expect(prompt.toLowerCase()).not.toContain("teenage");
  });

  it("includes the full user prompt context (location/occasion)", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "Himachal Pradesh trekking outfit for teenage girl");
    expect(prompt).toContain("Himachal Pradesh trekking outfit for teenage girl");
  });

  it("includes all three clothing item descriptions", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "any prompt");
    expect(prompt).toContain("Warm navy fleece jacket");
    expect(prompt).toContain("Grey trekking trousers");
    expect(prompt).toContain("Brown leather hiking boots");
  });

  it("includes the occasion", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "any prompt");
    expect(prompt).toContain("Hill station trip");
  });

  it("includes the styleDescription", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "any prompt");
    expect(prompt).toContain("Comfortable and practical outfit for trekking");
  });

  it("directs the AI to use context-appropriate setting (NOT hardcoded white background)", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "any prompt");
    expect(prompt.toLowerCase()).not.toContain("white background");
    expect(prompt.toLowerCase()).toContain("background");
  });

  it("different user prompts produce different prompts (location matters)", () => {
    const mountainPrompt = buildImagePrompt(SAMPLE_OUTFIT, "Himachal Pradesh mountain trip");
    const beachPrompt = buildImagePrompt(SAMPLE_OUTFIT, "Goa beach party outfit");
    expect(mountainPrompt).not.toBe(beachPrompt);
    expect(mountainPrompt).toContain("Himachal Pradesh mountain trip");
    expect(beachPrompt).toContain("Goa beach party outfit");
  });

  it("handles missing optional fields gracefully", () => {
    const minimalOutfit = {};
    expect(() => buildImagePrompt(minimalOutfit, "casual outfit for Delhi")).not.toThrow();
    const prompt = buildImagePrompt(minimalOutfit, "casual outfit for Delhi");
    expect(prompt).toContain("young Indian person");
    expect(prompt).toContain("casual outfit for Delhi");
  });

  it("handles outfit with no items — falls back to outfitTitle", () => {
    const outfitNoItems = { ...SAMPLE_OUTFIT, items: [] };
    const prompt = buildImagePrompt(outfitNoItems, "any");
    expect(prompt).toContain("Mountain Adventure Look");
  });

  it("handles outfit with partial items (only top)", () => {
    const outfitPartial = {
      ...SAMPLE_OUTFIT,
      items: [{ id: "top", description: "White kurta", color: "white" }],
    };
    const prompt = buildImagePrompt(outfitPartial, "any");
    expect(prompt).toContain("White kurta");
  });

  it("returns a non-empty string", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "any");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(50);
  });

  it("includes editorial photography keywords for image quality", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "any");
    expect(prompt.toLowerCase()).toMatch(/fashion|editorial|photograph/);
  });

  it("includes complexion in the subject when userPrompt mentions it", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "casual outfit for fair complexion Indian girl in Delhi");
    expect(prompt.toLowerCase()).toContain("fair complexion");
  });

  it("includes height in the subject when userPrompt mentions it", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "outfit for 5.5 feet tall woman");
    expect(prompt.toLowerCase()).toContain("5.5 feet tall");
  });

  it("includes both height and complexion when both are present", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "teenage Indian girl, 5.5 feet, fair complexion in Mumbai");
    expect(prompt.toLowerCase()).toContain("fair complexion");
    expect(prompt.toLowerCase()).toContain("5.5 feet tall");
  });

  it("does not include physical descriptor when prompt has none", () => {
    const prompt = buildImagePrompt(SAMPLE_OUTFIT, "casual outfit for woman");
    // no "complexion" or "feet tall" in subject line (only in the context string)
    const subjectMatch = prompt.match(/Subject: ([^.]+)/);
    expect(subjectMatch).not.toBeNull();
    const subject = subjectMatch![1].toLowerCase();
    expect(subject).not.toContain("complexion");
    expect(subject).not.toContain("feet tall");
  });

  it("different complexions produce different subjects", () => {
    const fairPrompt  = buildImagePrompt(SAMPLE_OUTFIT, "outfit for fair complexion woman");
    const duskyPrompt = buildImagePrompt(SAMPLE_OUTFIT, "outfit for dusky complexion woman");
    expect(fairPrompt.toLowerCase()).toContain("fair complexion");
    expect(duskyPrompt.toLowerCase()).toContain("dusky complexion");
    expect(fairPrompt).not.toBe(duskyPrompt);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parsePersonalAttributes — unit tests
// Verifies that height, complexion, and location are correctly extracted
// from a wide variety of user prompt formats.
// ─────────────────────────────────────────────────────────────────────────────
describe("parsePersonalAttributes — unit tests", () => {
  it("extracts feet-based height from '5.5 feet'", () => {
    const { height } = parsePersonalAttributes("casual outfit for 5.5 feet tall woman");
    expect(height).not.toBeNull();
    expect(height!.toLowerCase()).toContain("feet");
  });

  it("extracts cm-based height from '163cm'", () => {
    const { height } = parsePersonalAttributes("outfit for woman 163cm");
    expect(height).not.toBeNull();
    expect(height!.toLowerCase()).toContain("cm");
  });

  it("extracts feet-and-inches format '5'5\"'", () => {
    const { height } = parsePersonalAttributes("I am 5'5\" and need a party outfit");
    expect(height).not.toBeNull();
  });

  it("returns null height when no height is mentioned", () => {
    const { height } = parsePersonalAttributes("casual outfit for woman in Delhi");
    expect(height).toBeNull();
  });

  it("extracts 'fair' complexion", () => {
    const { complexion } = parsePersonalAttributes("outfit for fair complexion Indian girl");
    expect(complexion).toBe("fair");
  });

  it("extracts 'wheatish' complexion", () => {
    const { complexion } = parsePersonalAttributes("saree look for wheatish skin tone woman");
    expect(complexion).toBe("wheatish");
  });

  it("extracts 'dusky' complexion", () => {
    const { complexion } = parsePersonalAttributes("best colors for dusky complexion girl in Mumbai");
    expect(complexion).toBe("dusky");
  });

  it("extracts complexion without the word 'complexion' after it", () => {
    const { complexion } = parsePersonalAttributes("outfits for fair Indian woman");
    expect(complexion).toBe("fair");
  });

  it("returns null complexion when none mentioned", () => {
    const { complexion } = parsePersonalAttributes("casual outfit for woman");
    expect(complexion).toBeNull();
  });

  it("extracts 'Delhi' as location", () => {
    const { location } = parsePersonalAttributes("party outfit for girl in Delhi");
    expect(location?.toLowerCase()).toBe("delhi");
  });

  it("extracts 'Indian' as location", () => {
    const { location } = parsePersonalAttributes("traditional Indian woman outfit");
    expect(location?.toLowerCase()).toBe("indian");
  });

  it("extracts 'Goa' as location", () => {
    const { location } = parsePersonalAttributes("beach outfit for Goa vacation");
    expect(location?.toLowerCase()).toBe("goa");
  });

  it("returns null location when no Indian city or 'Indian' keyword", () => {
    const { location } = parsePersonalAttributes("casual party outfit for woman");
    expect(location).toBeNull();
  });

  it("extracts all three attributes simultaneously", () => {
    const attrs = parsePersonalAttributes("teenage Indian girl, 5.5 feet, fair complexion in Mumbai");
    expect(attrs.height).not.toBeNull();
    expect(attrs.complexion).toBe("fair");
    expect(attrs.location).not.toBeNull();
  });

  it("returns all nulls for a prompt with no personal attributes", () => {
    const attrs = parsePersonalAttributes("suggest a casual outfit");
    expect(attrs.height).toBeNull();
    expect(attrs.complexion).toBeNull();
    expect(attrs.location).toBeNull();
  });

  it("is case-insensitive for complexion keywords", () => {
    const { complexion } = parsePersonalAttributes("outfit for FAIR COMPLEXION woman");
    expect(complexion).toBe("fair");
  });

  it("is case-insensitive for location names", () => {
    const { location } = parsePersonalAttributes("outfit for woman in DELHI");
    expect(location?.toLowerCase()).toBe("delhi");
  });
});
