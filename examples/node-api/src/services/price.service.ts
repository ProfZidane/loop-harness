const VAT_RATE = 0.2;

export const withVat = (amountExcludingVat: number): number => amountExcludingVat * (1 + VAT_RATE);
