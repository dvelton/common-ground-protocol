import type {
  CandidatePackage,
  MandateConstraint,
  NegotiationTemplate,
  PrivateMandate,
} from './types.js';

export interface Evaluation {
  accepted: boolean;
  score: number;
  reasons: string[];
}

function conditionMatches(
  candidate: CandidatePackage,
  condition: { issueId: string; optionId: string },
): boolean {
  return candidate.selections[condition.issueId] === condition.optionId;
}

function constraintPasses(candidate: CandidatePackage, constraint: MandateConstraint): boolean {
  if (!conditionMatches(candidate, constraint.when)) return true;
  const targetMatches = conditionMatches(candidate, constraint.target);
  return constraint.kind === 'requires' ? targetMatches : !targetMatches;
}

export function evaluateCandidate(
  template: NegotiationTemplate,
  candidate: CandidatePackage,
  mandate: PrivateMandate,
): Evaluation {
  const reasons: string[] = [];
  let weightedScore = 0;
  let totalWeight = 0;

  for (const issue of template.issues) {
    const optionId = candidate.selections[issue.id];
    const score = mandate.optionScores[issue.id]?.[optionId];
    if (score === undefined || score < 0) {
      reasons.push(`${issue.label} is outside the mandate.`);
      return { accepted: false, score: 0, reasons };
    }
    weightedScore += score * issue.weight;
    totalWeight += issue.weight;
  }

  for (const constraint of mandate.constraints) {
    if (!constraintPasses(candidate, constraint)) {
      reasons.push(constraint.note || `Constraint ${constraint.id} is not satisfied.`);
      return { accepted: false, score: 0, reasons };
    }
  }

  const score = totalWeight === 0 ? 0 : Math.round((weightedScore / totalWeight) * 100) / 100;
  if (score < mandate.minimumScore) {
    reasons.push(`Package score ${score} is below the mandate threshold ${mandate.minimumScore}.`);
    return { accepted: false, score, reasons };
  }

  return { accepted: true, score, reasons };
}

export function acceptableCandidateIds(
  template: NegotiationTemplate,
  candidates: CandidatePackage[],
  mandate: PrivateMandate,
): Set<string> {
  return new Set(
    candidates
      .filter((candidate) => evaluateCandidate(template, candidate, mandate).accepted)
      .map((candidate) => candidate.id),
  );
}

export function defaultMandate(template: NegotiationTemplate, label: string): PrivateMandate {
  const supportedScores = [100, 75, 50, 25, -1] as const;
  return {
    label,
    minimumScore: 50,
    optionScores: Object.fromEntries(
      template.issues.map((issue) => [
        issue.id,
        Object.fromEntries(
          issue.options.map((option, index) => [option.id, supportedScores[index] ?? -1]),
        ),
      ]),
    ),
    constraints: [],
  };
}
