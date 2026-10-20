import { z } from 'zod';

export const roleSchema = z.enum(['a', 'b']);
export type Role = z.infer<typeof roleSchema>;

export const optionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  label: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  clause: z.string().min(1).max(4_000),
});
export type NegotiationOption = z.infer<typeof optionSchema>;

export const issueSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  label: z.string().min(1).max(120),
  description: z.string().max(1_000).default(''),
  weight: z.number().positive().max(100).default(1),
  options: z.array(optionSchema).min(2).max(20),
});
export type NegotiationIssue = z.infer<typeof issueSchema>;

export const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: z.string().min(1).max(160),
  summary: z.string().min(1).max(1_000),
  preamble: z.string().min(1).max(8_000),
  issues: z.array(issueSchema).min(1).max(12),
});
export type NegotiationTemplate = z.infer<typeof templateSchema>;

export const candidateSchema = z.object({
  id: z.string().regex(/^pkg-[a-f0-9]{24}$/),
  selections: z.record(z.string(), z.string()),
});
export type CandidatePackage = z.infer<typeof candidateSchema>;

export const conditionSchema = z.object({
  issueId: z.string(),
  optionId: z.string(),
});
export type PackageCondition = z.infer<typeof conditionSchema>;

export const constraintSchema = z.object({
  id: z.string(),
  when: conditionSchema,
  kind: z.enum(['requires', 'prohibits']),
  target: conditionSchema,
  note: z.string().max(500).default(''),
});
export type MandateConstraint = z.infer<typeof constraintSchema>;

export const mandateSchema = z.object({
  label: z.string().min(1).max(120),
  minimumScore: z.number().min(0).max(100),
  optionScores: z.record(z.string(), z.record(z.string(), z.number().min(-1).max(100))),
  constraints: z.array(constraintSchema).max(50).default([]),
});
export type PrivateMandate = z.infer<typeof mandateSchema>;

export const sessionStageSchema = z.enum([
  'waiting_for_party',
  'collecting_blinded',
  'collecting_transformed',
  'collecting_seed_reveals',
  'collecting_package_commits',
  'collecting_package_reveals',
  'collecting_approval_commits',
  'collecting_approval_reveals',
  'complete',
  'cancelled',
]);
export type SessionStage = z.infer<typeof sessionStageSchema>;

export const sessionResultSchema = z.enum([
  'agreement',
  'no_overlap',
  'not_finalized',
  'protocol_failure',
]);
export type SessionResult = z.infer<typeof sessionResultSchema>;

export interface PartyRecord {
  role: Role;
  displayName: string;
  tokenHash: string;
  publicKey: string;
  joinedAt: string;
}

export interface PartySubmission {
  blindedPoints?: string[];
  psiPublicKey?: string;
  transformedPoints?: string[];
  seedCommitment?: string;
  seedReveal?: string;
  packageCommitment?: string;
  packageReveal?: {
    candidateId: string;
    nonce: string;
  };
  approvalCommitment?: string;
  approvalReveal?: {
    approved: boolean;
    nonce: string;
  };
}

export interface IntersectionMatch {
  token: string;
  indexA: number;
  indexB: number;
}

export interface AuditEvent {
  sequence: number;
  timestamp: string;
  type: string;
  actor: Role | 'mediator';
  details: Record<string, string | number | boolean | null>;
  previousHash: string;
  hash: string;
}

export interface OutcomeReceipt {
  protocol: 'common-ground-protocol';
  version: '1.0';
  sessionId: string;
  result: SessionResult;
  candidateId: string | null;
  templateHash: string;
  candidateSetHash: string;
  transcriptHead: string;
  completedAt: string;
  mediatorPublicKey: string;
  signature: string;
}

export interface SessionState {
  id: string;
  title: string;
  template: NegotiationTemplate;
  candidates: CandidatePackage[];
  stage: SessionStage;
  result: SessionResult | null;
  createdAt: string;
  expiresAt: string;
  inviteCodeHash: string;
  parties: Partial<Record<Role, PartyRecord>>;
  submissions: Record<Role, PartySubmission>;
  intersections: IntersectionMatch[];
  selectedMatch: IntersectionMatch | null;
  selectedCandidateId: string | null;
  receipt: OutcomeReceipt | null;
  audit: AuditEvent[];
}

export interface SignedAction<T = unknown> {
  action: string;
  body: T;
  signature: string;
}

export interface LocalPartyState {
  sessionId: string;
  role: Role;
  token: string;
  inviteCode?: string;
  signingSecretKey: string;
  signingPublicKey: string;
  mandate?: PrivateMandate;
  psiSecret?: string;
  psiPublicKey?: string;
  pointMapping?: Array<string | null>;
  seed?: string;
  selectedCandidateId?: string;
  packageNonce?: string;
  approvalNonce?: string;
  pendingApproval?: boolean;
}
