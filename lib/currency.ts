// Currency formatting utilities for MainCourse
// Prices are stored in GEL in the database

/**
 * Format a GEL amount using Georgian locale formatting
 */
export function formatGel(gelAmount: number): string {
  return new Intl.NumberFormat('ka-GE', {
    style: 'currency',
    currency: 'GEL',
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
