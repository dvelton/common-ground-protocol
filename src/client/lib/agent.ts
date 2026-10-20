import { commitment, createBlindedSet, transformBlindedSetWithProof } from '../../shared/crypto.js';
import { acceptableCandidateIds } from '../../shared/mandate.js';
import { randomToken } from '../../shared/encoding.js';
import type { LocalPartyState, PrivateMandate } from '../../shared/types.js';
import type { PartyView, PublicSession } from './api.js';
import { submitAction } from './api.js';
import { savePartyState } from './storage.js';

export async function activateAgent(
  session: PublicSession,
  local: LocalPartyState,
  mandate: PrivateMandate,
): Promise<LocalPartyState> {
  const accepted = acceptableCandidateIds(session.template, session.candidates, mandate);
  const sealedSet = createBlindedSet(
    session.candidates.map((candidate) => candidate.id),
    accepted,
  );
  const seed = randomToken();
  const next: LocalPartyState = {
    ...local,
    mandate,
    psiSecret: sealedSet.secret,
    psiPublicKey: sealedSet.publicKey,
    pointMapping: sealedSet.mapping,
    seed,
  };
  savePartyState(next);
  await submitAction(next, 'submit-blinded', {
    points: sealedSet.points,
    psiPublicKey: sealedSet.publicKey,
    seedCommitment: commitment('selection-seed', session.id, seed),
  });
  return next;
}

export async function advanceAgent(
  local: LocalPartyState,
  view: PartyView,
): Promise<LocalPartyState> {
  if (!local.psiSecret || !local.pointMapping || !local.seed) return local;

  if (
    view.stage === 'collecting_transformed' &&
    !view.ownSubmission.transformed &&
    view.peerPoints
  ) {
    const transformation = transformBlindedSetWithProof(
      view.peerPoints,
      local.psiSecret,
      `${local.sessionId}:${local.role}:transform`,
    );
    await submitAction(local, 'submit-transformed', transformation);
    return local;
  }

  if (view.stage === 'collecting_seed_reveals' && !view.ownSubmission.seedRevealed) {
    await submitAction(local, 'reveal-seed', { seed: local.seed });
    return local;
  }

  if (
    view.stage === 'collecting_package_commits' &&
    !view.ownSubmission.packageCommitted &&
    view.selectedIndex !== undefined
  ) {
    const candidateId = local.pointMapping[view.selectedIndex];
    if (!candidateId) throw new Error('The selected match does not map to an accepted package.');
    const nonce = randomToken();
    const reveal = { candidateId, nonce };
    const next = {
      ...local,
      selectedCandidateId: candidateId,
      packageNonce: nonce,
    };
    savePartyState(next);
    await submitAction(next, 'commit-package', {
      commitment: commitment('selected-package', local.sessionId, reveal),
    });
    return next;
  }

  if (
    view.stage === 'collecting_package_reveals' &&
    !view.ownSubmission.packageRevealed &&
    local.selectedCandidateId &&
    local.packageNonce
  ) {
    await submitAction(local, 'reveal-package', {
      candidateId: local.selectedCandidateId,
      nonce: local.packageNonce,
    });
    return local;
  }

  if (
    view.stage === 'collecting_approval_reveals' &&
    !view.ownSubmission.approvalRevealed &&
    local.pendingApproval !== undefined &&
    local.approvalNonce
  ) {
    await submitAction(local, 'reveal-approval', {
      approved: local.pendingApproval,
      nonce: local.approvalNonce,
    });
  }

  return local;
}

export async function commitApproval(
  local: LocalPartyState,
  approved: boolean,
): Promise<LocalPartyState> {
  const nonce = randomToken();
  const reveal = { approved, nonce };
  const next = {
    ...local,
    pendingApproval: approved,
    approvalNonce: nonce,
  };
  savePartyState(next);
  await submitAction(next, 'commit-approval', {
    commitment: commitment('final-approval', local.sessionId, reveal),
  });
  return next;
}
