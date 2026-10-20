import { randomUUID } from 'node:crypto';
import {
  commitment,
  createSigningKeypair,
  findIntersections,
  selectIntersection,
  signPayload,
  validatePointSet,
  validatePublicPoint,
  verifyPayload,
  verifyTransformedSet,
} from '../shared/crypto.js';
import { generateCandidates } from '../shared/candidates.js';
import { hashObject, hashText, randomToken, secureEqual } from '../shared/encoding.js';
import type {
  AuditEvent,
  NegotiationTemplate,
  PartyRecord,
  Role,
  SessionResult,
  SessionState,
  SignedAction,
} from '../shared/types.js';
import { SessionStore } from './database.js';

export interface PartyCredential {
  role: Role;
  token: string;
}

export interface MediatorIdentity {
  secretKey: string;
  publicKey: string;
}

export function getMediatorIdentity(store: SessionStore): MediatorIdentity {
  const existing = store.getMetadata('mediator.identity');
  if (existing) return JSON.parse(existing) as MediatorIdentity;
  const identity = createSigningKeypair();
  store.setMetadata('mediator.identity', JSON.stringify(identity));
  return identity;
}

function appendAudit(
  state: SessionState,
  type: string,
  actor: Role | 'mediator',
  details: AuditEvent['details'] = {},
): void {
  const previousHash = state.audit.at(-1)?.hash ?? '0'.repeat(64);
  const eventWithoutHash = {
    sequence: state.audit.length + 1,
    timestamp: new Date().toISOString(),
    type,
    actor,
    details,
    previousHash,
  };
  state.audit.push({
    ...eventWithoutHash,
    hash: hashObject(eventWithoutHash),
  });
}

function partyTokenHash(token: string): string {
  return hashText(`cgp-party-token-v1:${token}`);
}

function createParty(
  role: Role,
  displayName: string,
  publicKey: string,
): { party: PartyRecord; credential: PartyCredential } {
  const token = randomToken();
  return {
    party: {
      role,
      displayName,
      tokenHash: partyTokenHash(token),
      publicKey,
      joinedAt: new Date().toISOString(),
    },
    credential: { role, token },
  };
}

export function createSession(input: {
  title: string;
  template: NegotiationTemplate;
  displayName: string;
  publicKey: string;
  expiresInHours: number;
}): {
  state: SessionState;
  credential: PartyCredential;
  inviteCode: string;
} {
  const candidates = generateCandidates(input.template);
  const inviteCode = randomToken(12);
  const { party, credential } = createParty('a', input.displayName, input.publicKey);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + Math.min(Math.max(input.expiresInHours, 1), 168) * 3_600_000,
  );

  const state: SessionState = {
    id: randomUUID(),
    title: input.title,
    template: input.template,
    candidates,
    stage: 'waiting_for_party',
    result: null,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    inviteCodeHash: hashText(`cgp-invite-v1:${inviteCode}`),
    parties: { a: party },
    submissions: { a: {}, b: {} },
    intersections: [],
    selectedMatch: null,
    selectedCandidateId: null,
    receipt: null,
    audit: [],
  };
  appendAudit(state, 'session.created', 'mediator', {
    templateId: input.template.id,
    candidateCount: candidates.length,
  });
  return { state, credential, inviteCode };
}

export function joinSession(
  state: SessionState,
  input: { inviteCode: string; displayName: string; publicKey: string },
): PartyCredential {
  if (state.stage !== 'waiting_for_party') throw new Error('Session is no longer open to join.');
  if (new Date(state.expiresAt).getTime() <= Date.now()) throw new Error('Session has expired.');
  const presented = hashText(`cgp-invite-v1:${input.inviteCode}`);
  if (!secureEqual(presented, state.inviteCodeHash)) throw new Error('Invalid invitation code.');

  const { party, credential } = createParty('b', input.displayName, input.publicKey);
  state.parties.b = party;
  state.stage = 'collecting_blinded';
  appendAudit(state, 'party.joined', 'b');
  appendAudit(state, 'stage.changed', 'mediator', { stage: state.stage });
  return credential;
}

export function authenticateParty(state: SessionState, token: string): PartyRecord {
  const tokenHash = partyTokenHash(token);
  for (const role of ['a', 'b'] as const) {
    const party = state.parties[role];
    if (party && secureEqual(tokenHash, party.tokenHash)) return party;
  }
  throw new Error('Invalid party credential.');
}

function assertStage(state: SessionState, expected: SessionState['stage']): void {
  if (state.stage !== expected) {
    throw new Error(`Action is not valid during ${state.stage}.`);
  }
}

function verifyAction<T>(
  state: SessionState,
  role: Role,
  action: string,
  signed: SignedAction<T>,
): T {
  if (signed.action !== action) throw new Error('Signed action does not match the route.');
  const party = state.parties[role];
  if (!party) throw new Error('Party is not registered.');
  const payload = { sessionId: state.id, action, body: signed.body };
  if (!verifyPayload(payload, signed.signature, party.publicKey)) {
    throw new Error('Invalid action signature.');
  }
  return signed.body;
}

function finish(state: SessionState, result: SessionResult, mediator: MediatorIdentity): void {
  state.result = result;
  state.stage = 'complete';
  appendAudit(state, 'session.completed', 'mediator', { result });

  const unsigned = {
    protocol: 'common-ground-protocol' as const,
    version: '1.0' as const,
    sessionId: state.id,
    result,
    candidateId: result === 'agreement' ? state.selectedCandidateId : null,
    templateHash: hashObject(state.template),
    candidateSetHash: hashObject(state.candidates),
    transcriptHead: state.audit.at(-1)?.hash ?? '0'.repeat(64),
    completedAt: new Date().toISOString(),
    mediatorPublicKey: mediator.publicKey,
  };
  state.receipt = {
    ...unsigned,
    signature: signPayload(unsigned, mediator.secretKey),
  };

  for (const role of ['a', 'b'] as const) {
    const submission = state.submissions[role];
    delete submission.blindedPoints;
    delete submission.psiPublicKey;
    delete submission.transformedPoints;
    delete submission.seedReveal;
    delete submission.packageReveal;
    delete submission.approvalReveal;
  }
  state.intersections = [];
  state.selectedMatch = null;
}

export function applyPartyAction(
  state: SessionState,
  role: Role,
  action: string,
  signed: SignedAction,
  mediator: MediatorIdentity,
): void {
  if (new Date(state.expiresAt).getTime() <= Date.now()) {
    throw new Error('Session has expired.');
  }
  const submission = state.submissions[role];
  const otherRole: Role = role === 'a' ? 'b' : 'a';
  const other = state.submissions[otherRole];

  switch (action) {
    case 'submit-blinded': {
      assertStage(state, 'collecting_blinded');
      const body = verifyAction(
        state,
        role,
        action,
        signed as SignedAction<{
          points: string[];
          seedCommitment: string;
          psiPublicKey: string;
        }>,
      );
      if (submission.blindedPoints) throw new Error('Blinded set already submitted.');
      validatePointSet(body.points, state.candidates.length);
      validatePublicPoint(body.psiPublicKey);
      if (!/^[a-f0-9]{64}$/u.test(body.seedCommitment)) {
        throw new Error('Invalid seed commitment.');
      }
      submission.blindedPoints = body.points;
      submission.psiPublicKey = body.psiPublicKey;
      submission.seedCommitment = body.seedCommitment;
      appendAudit(state, 'sealed-set.submitted', role);
      if (other.blindedPoints) {
        state.stage = 'collecting_transformed';
        appendAudit(state, 'stage.changed', 'mediator', { stage: state.stage });
      }
      break;
    }
    case 'submit-transformed': {
      assertStage(state, 'collecting_transformed');
      const body = verifyAction(
        state,
        role,
        action,
        signed as SignedAction<{
          points: string[];
          proofs: Array<{ t1: string; t2: string; s: string }>;
        }>,
      );
      if (submission.transformedPoints) throw new Error('Transformed set already submitted.');
      if (!other.blindedPoints) throw new Error('Peer blinded set is unavailable.');
      validatePointSet(body.points, other.blindedPoints.length);
      if (!submission.psiPublicKey) throw new Error('PSI public key is unavailable.');
      verifyTransformedSet(
        other.blindedPoints,
        body.points,
        body.proofs,
        submission.psiPublicKey,
        `${state.id}:${role}:transform`,
      );
      submission.transformedPoints = body.points;
      appendAudit(state, 'sealed-set.transformed', role);

      if (other.transformedPoints) {
        const aTransformsB = state.submissions.a.transformedPoints!;
        const bTransformsA = state.submissions.b.transformedPoints!;
        state.intersections = findIntersections(aTransformsB, bTransformsA);
        if (state.intersections.length === 0) {
          finish(state, 'no_overlap', mediator);
        } else {
          state.stage = 'collecting_seed_reveals';
          appendAudit(state, 'stage.changed', 'mediator', { stage: state.stage });
        }
      }
      break;
    }
    case 'reveal-seed': {
      assertStage(state, 'collecting_seed_reveals');
      const body = verifyAction(state, role, action, signed as SignedAction<{ seed: string }>);
      if (submission.seedReveal) throw new Error('Seed already revealed.');
      if (commitment('selection-seed', state.id, body.seed) !== submission.seedCommitment) {
        throw new Error('Seed does not match its commitment.');
      }
      submission.seedReveal = body.seed;
      appendAudit(state, 'selection-seed.revealed', role);
      if (other.seedReveal) {
        const combinedSeed = hashText(
          `cgp-selection-v1:${state.submissions.a.seedReveal}:${state.submissions.b.seedReveal}`,
        );
        state.selectedMatch = selectIntersection(state.intersections, combinedSeed);
        state.stage = 'collecting_package_commits';
        appendAudit(state, 'match.selected', 'mediator');
        appendAudit(state, 'stage.changed', 'mediator', { stage: state.stage });
      }
      break;
    }
    case 'commit-package': {
      assertStage(state, 'collecting_package_commits');
      const body = verifyAction(
        state,
        role,
        action,
        signed as SignedAction<{ commitment: string }>,
      );
      if (submission.packageCommitment) throw new Error('Package already committed.');
      if (!/^[a-f0-9]{64}$/u.test(body.commitment)) {
        throw new Error('Invalid package commitment.');
      }
      submission.packageCommitment = body.commitment;
      appendAudit(state, 'package.committed', role);
      if (other.packageCommitment) {
        state.stage = 'collecting_package_reveals';
        appendAudit(state, 'stage.changed', 'mediator', { stage: state.stage });
      }
      break;
    }
    case 'reveal-package': {
      assertStage(state, 'collecting_package_reveals');
      const body = verifyAction(
        state,
        role,
        action,
        signed as SignedAction<{ candidateId: string; nonce: string }>,
      );
      if (submission.packageReveal) throw new Error('Package already revealed.');
      if (commitment('selected-package', state.id, body) !== submission.packageCommitment) {
        throw new Error('Package reveal does not match its commitment.');
      }
      if (!state.candidates.some((candidate) => candidate.id === body.candidateId)) {
        throw new Error('Unknown candidate package.');
      }
      submission.packageReveal = body;
      appendAudit(state, 'package.revealed-to-mediator', role);
      if (other.packageReveal) {
        if (submission.packageReveal.candidateId !== other.packageReveal.candidateId) {
          finish(state, 'protocol_failure', mediator);
        } else {
          state.selectedCandidateId = body.candidateId;
          state.stage = 'collecting_approval_commits';
          appendAudit(state, 'package.confirmed', 'mediator');
          appendAudit(state, 'stage.changed', 'mediator', { stage: state.stage });
        }
      }
      break;
    }
    case 'commit-approval': {
      assertStage(state, 'collecting_approval_commits');
      const body = verifyAction(
        state,
        role,
        action,
        signed as SignedAction<{ commitment: string }>,
      );
      if (submission.approvalCommitment) throw new Error('Approval already committed.');
      if (!/^[a-f0-9]{64}$/u.test(body.commitment)) {
        throw new Error('Invalid approval commitment.');
      }
      submission.approvalCommitment = body.commitment;
      appendAudit(state, 'approval.committed', role);
      if (other.approvalCommitment) {
        state.stage = 'collecting_approval_reveals';
        appendAudit(state, 'stage.changed', 'mediator', { stage: state.stage });
      }
      break;
    }
    case 'reveal-approval': {
      assertStage(state, 'collecting_approval_reveals');
      const body = verifyAction(
        state,
        role,
        action,
        signed as SignedAction<{ approved: boolean; nonce: string }>,
      );
      if (submission.approvalReveal) throw new Error('Approval already revealed.');
      if (commitment('final-approval', state.id, body) !== submission.approvalCommitment) {
        throw new Error('Approval reveal does not match its commitment.');
      }
      submission.approvalReveal = body;
      appendAudit(state, 'approval.revealed-to-mediator', role);
      if (other.approvalReveal) {
        finish(
          state,
          body.approved && other.approvalReveal.approved ? 'agreement' : 'not_finalized',
          mediator,
        );
      }
      break;
    }
    default:
      throw new Error('Unknown protocol action.');
  }
}

export function partyView(state: SessionState, role: Role): Record<string, unknown> {
  const own = state.submissions[role];
  const otherRole: Role = role === 'a' ? 'b' : 'a';
  const other = state.submissions[otherRole];
  const view: Record<string, unknown> = {
    sessionId: state.id,
    role,
    stage: state.stage,
    result: state.result,
    ownSubmission: {
      blinded: Boolean(own.blindedPoints),
      transformed: Boolean(own.transformedPoints),
      seedRevealed: Boolean(own.seedReveal),
      packageCommitted: Boolean(own.packageCommitment),
      packageRevealed: Boolean(own.packageReveal),
      approvalCommitted: Boolean(own.approvalCommitment),
      approvalRevealed: Boolean(own.approvalReveal),
    },
    selectedCandidateId:
      state.stage === 'collecting_approval_commits' ||
      state.stage === 'collecting_approval_reveals' ||
      state.stage === 'complete'
        ? state.selectedCandidateId
        : null,
    receipt: state.receipt,
  };

  if (state.stage === 'collecting_transformed') view.peerPoints = other.blindedPoints;
  if (
    state.stage === 'collecting_package_commits' ||
    state.stage === 'collecting_package_reveals'
  ) {
    view.selectedIndex = role === 'a' ? state.selectedMatch?.indexA : state.selectedMatch?.indexB;
  }
  return view;
}
