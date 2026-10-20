import { describe, expect, it } from 'vitest';
import { generateCandidates } from '../../src/shared/candidates.js';
import { commercialContractTemplate } from '../../src/shared/templates.js';

describe('candidate generation', () => {
  it('generates every combination deterministically', () => {
    const first = generateCandidates(commercialContractTemplate);
    const second = generateCandidates(commercialContractTemplate);

    expect(first).toHaveLength(243);
    expect(second).toEqual(first);
    expect(new Set(first.map((candidate) => candidate.id)).size).toBe(first.length);
  });
});
