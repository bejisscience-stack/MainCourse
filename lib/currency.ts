// Currency formatting utilities for MainCourse
// Prices are stored in GEL in the database (base price set by lecturer)
// Students pay base price + platform commission

/** Platform commission percentage added on top of lecturer's base price */
export const PLATFORM_COMMISSION_PERCENT = 3;

/**
 * Calculate the student-facing price (base price + platform commission)
 */
export function calculateStudentPrice(
  basePrice: number,
  commissionPercent: number = PLATFORM_COMMISSION_PERCENT,
): number {
  return Math.round(basePrice * (1 + commissionPercent / 100) * 100) / 100;
}

/**
 * Format a GEL amount using Georgian locale formatting
 */
export function formatGel(gelAmount: number): string {
  return new Intl.NumberFormat("ka-GE", {
    style: "currency",
    currency: "GEL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(gelAmount);
}

/**
 * Format price for display (in GEL)
 * This is the main function to use for displaying prices
 */
export function formatPriceInGel(gelAmount: number): string {
  return formatGel(gelAmount);
}
