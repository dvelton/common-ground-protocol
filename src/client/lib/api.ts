import { signPayload } from '../../shared/crypto.js';
import type {
  CandidatePackage,
  LocalPartyState,
  NegotiationTemplate,
  OutcomeReceipt,
  Role,
  SessionResult,
  SessionStage,
} from '../../shared/types.js';

export interface PublicSession {
  id: string;
  title: string;
  template: NegotiationTemplate;
  candidates: CandidatePackage[];
  stage: SessionStage;
  result: SessionResult | null;
  createdAt: string;
  expiresAt: string;
  parties: { a: string | null; b: string | null };
  selectedCandidateId: string | null;
  receipt: OutcomeReceipt | null;
}

export interface PartyView {
  sessionId: string;
  role: Role;
  stage: SessionStage;
  result: SessionResult | null;
  ownSubmission: {
    blinded: boolean;
    transformed: boolean;
    seedRevealed: boolean;
    packageCommitted: boolean;
    packageRevealed: boolean;
    approvalCommitted: boolean;
    approvalRevealed: boolean;
  };
  peerPoints?: string[];
  selectedIndex?: number;
  selectedCandidateId: string | null;
  receipt: OutcomeReceipt | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with status ${response.status}.`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function createNegotiation(input: {
  title: string;
  templateId?: string;
  template?: NegotiationTemplate;
  displayName: string;
  publicKey: string;
  expiresInHours: number;
}): Promise<{
  session: PublicSession;
  credential: { role: Role; token: string };
  inviteCode: string;
}> {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function joinNegotiation(
  sessionId: string,
  input: {
    inviteCode: string;
    displayName: string;
    publicKey: string;
  },
): Promise<{
  session: PublicSession;
  credential: { role: Role; token: string };
}> {
  return request(`/api/sessions/${sessionId}/join`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getSession(local: LocalPartyState): Promise<PublicSession> {
  return request(`/api/sessions/${local.sessionId}`, {
    headers: { Authorization: `Bearer ${local.token}` },
  });
}

export async function getPartyView(local: LocalPartyState): Promise<PartyView> {
  return request(`/api/sessions/${local.sessionId}/party`, {
    headers: { Authorization: `Bearer ${local.token}` },
  });
}

export async function submitAction(
  local: LocalPartyState,
  action: string,
  body: unknown,
): Promise<void> {
  const payload = { sessionId: local.sessionId, action, body };
  return request(`/api/sessions/${local.sessionId}/actions/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${local.token}` },
    body: JSON.stringify({
      action,
      body,
      signature: signPayload(payload, local.signingSecretKey),
    }),
  });
}

export async function downloadAgreement(
  local: LocalPartyState,
  format: 'md' | 'docx',
): Promise<void> {
  const response = await fetch(`/api/sessions/${local.sessionId}/export/agreement.${format}`, {
    headers: { Authorization: `Bearer ${local.token}` },
  });
  if (!response.ok) throw new Error('Agreement export failed.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${local.sessionId}-agreement.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
