// Helper func to round results to 3 decimal places
export const round = (n: number, places = 3) =>
  Math.round(n * 10 ** places) / 10 ** places;

// Length conversions
export const cmToIn = (cm: number) => cm / 2.54;
export const inToCm = (inch: number) => inch * 2.54;

// Weight conversions
export const kgToLb = (kg: number) => kg * 2.2046226218;
export const lbToKg = (lb: number) => lb / 2.2046226218;

// Volume conversions (US gallon)
export const lToGal = (liters: number) => liters * 0.2641720524;
export const galToL = (gal: number) => gal / 0.2641720524;
