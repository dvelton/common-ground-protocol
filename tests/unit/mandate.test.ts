import { describe, expect, it } from 'vitest';
import { generateCandidates } from '../../src/shared/candidates.js';
import { defaultMandate, evaluateCandidate } from '../../src/shared/mandate.js';
import { settlementTemplate } from '../../src/shared/templates.js';
import type { NegotiationTemplate } from '../../src/shared/types.js';

describe('mandate evaluation', () => {
  it('rejects prohibited terms and enforces cross-issue constraints', () => {
    const candidates = generateCandidates(settlementTemplate);
    const mandate = defaultMandate(settlementTemplate, 'Party A');
    mandate.optionScores.payment['500k'] = -1;
    mandate.constraints.push({
      id: 'fast-high-payment',
      when: { issueId: 'payment', optionId: '800k' },
      kind: 'requires',
      target: { issueId: 'payment-timing', optionId: '60-days' },
      note: 'The highest payment requires additional time.',
    });

    const prohibited = candidates.find((candidate) => candidate.selections.payment === '500k')!;
    const constrained = candidates.find(
      (candidate) =>
        candidate.selections.payment === '800k' &&
        candidate.selections['payment-timing'] === '10-days',
    )!;

    expect(evaluateCandidate(settlementTemplate, prohibited, mandate).accepted).toBe(false);
    expect(evaluateCandidate(settlementTemplate, constrained, mandate).accepted).toBe(false);
  });

  it('never authorizes an option displayed as rejected in a five-option template', () => {
    const template: NegotiationTemplate = {
      id: 'five-option-template',
      name: 'Five option template',
      summary: 'Tests default mandate values.',
      preamble: 'Synthetic.',
      issues: [
        {
          id: 'issue',
          label: 'Issue',
          description: '',
          weight: 1,
          options: Array.from({ length: 5 }, (_value, index) => ({
            id: `option-${index + 1}`,
            label: `Option ${index + 1}`,
            description: '',
            clause: `Option ${index + 1}.`,
          })),
        },
      ],
    };
    const mandate = defaultMandate(template, 'Party');
    const candidate = generateCandidates(template).find(
      (item) => item.selections.issue === 'option-5',
    );
    if (!candidate) throw new Error('Expected candidate was not generated.');

    expect(mandate.optionScores.issue['option-5']).toBe(-1);
    expect(evaluateCandidate(template, candidate, mandate).accepted).toBe(false);
  });
});
