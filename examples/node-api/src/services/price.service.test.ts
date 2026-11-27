import { describe, expect, it } from 'vitest';
import { withVat } from './price.service';

describe('withVat', () => {
  it('adds 20 percent VAT', () => {
    expect(withVat(100)).toBeCloseTo(120);
  });
});
