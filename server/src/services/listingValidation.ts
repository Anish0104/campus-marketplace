import { LISTING_CONDITIONS, LISTING_LIMITS } from "../models/Listing";

export function listingValidationError(input: Record<string, unknown>): string | null {
  const { title, description, price, category, condition } = input;
  for (const [field, value, limit] of [
    ["title", title, LISTING_LIMITS.title],
    ["description", description, LISTING_LIMITS.description],
    ["category", category, LISTING_LIMITS.category],
  ] as const) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > limit) {
      return `${field} is required and must be at most ${limit} characters.`;
    }
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return "price must be a finite number greater than or equal to 0.";
  }
  if (typeof condition !== "string" || !LISTING_CONDITIONS.some((value) => value === condition)) {
    return "condition must be new, like_new, good, or fair.";
  }
  return null;
}
