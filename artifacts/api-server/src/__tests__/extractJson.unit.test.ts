import { describe, it, expect } from "vitest";
import { extractFirstJsonObject } from "../lib/outfitAI.js";

describe("extractFirstJsonObject — unit tests", () => {
  it("returns a simple JSON object as-is", () => {
    const input = '{"key":"value"}';
    expect(extractFirstJsonObject(input)).toBe('{"key":"value"}');
  });

  it("stops at the correct closing brace when Claude appends trailing text", () => {
    const input = '{"key":"value"} Note: This outfit is ideal for summer.';
    expect(extractFirstJsonObject(input)).toBe('{"key":"value"}');
  });

  it("handles deeply nested objects", () => {
    const input = '{"outer":{"inner":{"deep":"yes"}}} extra text here';
    const result = extractFirstJsonObject(input);
    expect(result).toBe('{"outer":{"inner":{"deep":"yes"}}}');
    expect(() => JSON.parse(result!)).not.toThrow();
  });

  it("handles braces INSIDE strings without breaking depth tracking", () => {
    const input = '{"desc":"wear this {for} fun"} trailing';
    expect(extractFirstJsonObject(input)).toBe('{"desc":"wear this {for} fun"}');
  });

  it("handles escaped quotes inside strings", () => {
    const input = '{"note":"she said \\"hello\\" to me"} extra';
    expect(extractFirstJsonObject(input)).toBe('{"note":"she said \\"hello\\" to me"}');
  });

  it("returns null for empty string", () => {
    expect(extractFirstJsonObject("")).toBeNull();
  });

  it("returns null for text with no JSON object", () => {
    expect(extractFirstJsonObject("Here is your outfit recommendation!")).toBeNull();
  });

  it("returns null for an unclosed JSON object", () => {
    expect(extractFirstJsonObject('{"key":"value"')).toBeNull();
  });

  it("extracts the first object from within an array", () => {
    const input = '[{"id":1},{"id":2}]';
    const result = extractFirstJsonObject(input);
    expect(result).toBe('{"id":1}');
  });

  it("handles JSON wrapped in markdown code fences after extraction", () => {
    const input = "```json\n{\"key\":\"val\"}\n```";
    const jsonPart = input.replace(/```[a-z]*\n?/g, "").replace(/\n?```/g, "").trim();
    const result = extractFirstJsonObject(jsonPart);
    expect(result).toBe('{"key":"val"}');
  });

  it("handles real Claude outfit JSON structure", () => {
    const input = `{"outfitTitle":"Mountain Adventure Look","styleDescription":"Comfortable outfit for trekking.","occasion":"Hill station trip","targetProfile":"16-year-old Indian girl","totalBudgetMin":2000,"totalBudgetMax":8000,"items":[{"id":"top","category":"Top","description":"Warm fleece jacket","color":"navy","whyRecommended":"Keeps warm","portalProducts":[]},{"id":"bottom","category":"Bottom","description":"Trekking trousers","color":"grey","whyRecommended":"Durable","portalProducts":[]},{"id":"footwear","category":"Footwear","description":"Hiking boots","color":"brown","whyRecommended":"Grip","portalProducts":[]}]} Note: Accessories like hats would complement this look.`;
    const result = extractFirstJsonObject(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.outfitTitle).toBe("Mountain Adventure Look");
    expect(parsed.items).toHaveLength(3);
    expect(parsed.targetProfile).toBe("16-year-old Indian girl");
  });

  it("handles JSON with arrays of objects at root level", () => {
    const input = '{"outfits":[{"outfitTitle":"Look 1"},{"outfitTitle":"Look 2"}]} Done.';
    const result = extractFirstJsonObject(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.outfits).toHaveLength(2);
  });
});
