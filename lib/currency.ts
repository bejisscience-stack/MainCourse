// Currency conversion utilities for MainCourse
// Prices are stored in USD in the database; convert at display time

// Fixed exchange rate: 1 USD = 2.5 GEL
const USD_TO_GEL_RATE = 2.5;

/**
 * Convert USD amount to GEL
 */
export function convertUsdToGel(usdAmount: number): number {
  return usdAmount * USD_TO_GEL_RATE;
}

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
 * Convert USD to GEL and format for display
 * This is the main function to use for displaying prices
 */
export function formatPriceInGel(usdAmount: number): string {
  const gelAmount = convertUsdToGel(usdAmount);
  return formatGel(gelAmount);
}

/**
 * Get the exchange rate (for display purposes if needed)
 */
export function getExchangeRate(): number {
  return USD_TO_GEL_RATE;
}
