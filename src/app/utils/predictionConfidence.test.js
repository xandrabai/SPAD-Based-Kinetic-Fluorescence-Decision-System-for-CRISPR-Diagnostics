import { describe, expect, it } from 'vitest';
import { alphaForLook, evaluateSequentialConfidence } from './predictionConfidence';

describe('alpha-spent sequential confidence', () => {
  it('spends no more than alpha across an unbounded run', () => {
    const spent = Array.from({ length: 100_000 }, (_, index) => alphaForLook(index + 1))
      .reduce((sum, value) => sum + value, 0);
    expect(spent).toBeLessThan(0.05);
    expect(spent).toBeGreaterThan(0.049999);
  });

  it('publishes nothing before ten blocks', () => {
    expect(evaluateSequentialConfidence([40, 41, 42], 0).status).toBe('insufficient');
  });

  it('does not manufacture confidence for zero variance', () => {
    expect(evaluateSequentialConfidence(Array(10).fill(50), 1).status).toBe('zero_variance');
  });

  it('returns a positive lower bound for variable high data', () => {
    const result = evaluateSequentialConfidence([49, 50, 51, 50, 49, 51, 50, 49, 51, 50], 1);
    expect(result.status).toBe('valid');
    expect(result.alphaAtLook).toBe(0.025);
    expect(result.lowerBound).toBeGreaterThan(30);
    expect(result.isPositive).toBe(true);
  });

  it('keeps threshold-centered evidence negative', () => {
    const result = evaluateSequentialConfidence([29, 30, 31, 29, 30, 31, 29, 30, 31, 30], 1);
    expect(result.isPositive).toBe(false);
    expect(result.lowerBound).toBeLessThan(30);
  });
});
