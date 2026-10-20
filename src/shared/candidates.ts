import type { CandidatePackage, NegotiationTemplate } from './types.js';
import { hashObject } from './encoding.js';

const MAX_CANDIDATES = 1_000;

export function validateTemplateUniqueness(template: NegotiationTemplate): void {
  const issueIds = new Set<string>();
  for (const issue of template.issues) {
    if (issueIds.has(issue.id)) throw new Error(`Duplicate issue id: ${issue.id}`);
    issueIds.add(issue.id);

    const optionIds = new Set<string>();
    for (const option of issue.options) {
      if (optionIds.has(option.id)) {
        throw new Error(`Duplicate option id ${option.id} in ${issue.id}`);
      }
      optionIds.add(option.id);
    }
  }
}

export function generateCandidates(template: NegotiationTemplate): CandidatePackage[] {
  validateTemplateUniqueness(template);
  const total = template.issues.reduce((count, issue) => count * issue.options.length, 1);
  if (total > MAX_CANDIDATES) {
    throw new Error(
      `Template produces ${total.toLocaleString()} packages; the protocol limit is ${MAX_CANDIDATES.toLocaleString()}.`,
    );
  }

  let selections: Array<Record<string, string>> = [{}];
  for (const issue of template.issues) {
    selections = selections.flatMap((existing) =>
      issue.options.map((option) => ({
        ...existing,
        [issue.id]: option.id,
      })),
    );
  }

  return selections.map((selection) => ({
    id: `pkg-${hashObject(selection).slice(0, 24)}`,
    selections: selection,
  }));
}

export function renderCandidate(
  template: NegotiationTemplate,
  candidate: CandidatePackage,
): {
  title: string;
  terms: Array<{ issue: string; option: string; clause: string }>;
  agreement: string;
} {
  const terms = template.issues.map((issue) => {
    const optionId = candidate.selections[issue.id];
    const option = issue.options.find((item) => item.id === optionId);
    if (!option) throw new Error(`Candidate references unknown option ${issue.id}:${optionId}`);
    return {
      issue: issue.label,
      option: option.label,
      clause: option.clause,
    };
  });

  return {
    title: template.name,
    terms,
    agreement: [template.preamble, ...terms.map((term) => term.clause)].join('\n\n'),
  };
}
