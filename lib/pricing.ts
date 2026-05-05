// Welcome-discount pricing utilities.
//
// Pricing model:
//   - courses.original_price: regular price shown to everyone outside the welcome window.
//   - courses.price: discounted price offered for the user's first WELCOME_DISCOUNT_HOURS.
//   - If original_price is null (or <= price), the course has no welcome offer
//     and `price` is shown unchanged for everyone.

export const WELCOME_DISCOUNT_HOURS = 12;

export interface PriceFields {
  price: number;
  original_price: number | null | undefined;
}

export function hasWelcomeDiscount(p: PriceFields): boolean {
  return (
    p.original_price != null &&
    p.original_price > 0 &&
    p.original_price > p.price
  );
}

export function isWelcomeWindowActive(
  expiresAt: string | Date | null | undefined,
): boolean {
  if (!expiresAt) return false;
  const t =
    typeof expiresAt === "string" ? Date.parse(expiresAt) : expiresAt.getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

/**
 * Decide what to charge given the course's price fields and whether the user's
 * welcome window is currently open. Server is authoritative — clients render
 * but never decide.
 */
export function resolveChargeAmount(
  p: PriceFields,
  windowActive: boolean,
): { amount: number; isDiscounted: boolean } {
  if (hasWelcomeDiscount(p) && windowActive) {
    return { amount: p.price, isDiscounted: true };
  }
  // No discount available, OR window expired → regular price.
  // For courses without an original_price, fall back to price as-is.
  return {
    amount:
      p.original_price && p.original_price > 0 ? p.original_price : p.price,
    isDiscounted: false,
  };
}
