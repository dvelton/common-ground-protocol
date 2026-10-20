import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import {
  commitment,
  createBlindedSet,
  createSigningKeypair,
  signPayload,
  transformBlindedSetWithProof,
  verifyPayload,
} from '../../src/shared/crypto.js';
import { settlementTemplate } from '../../src/shared/templates.js';
import type { CandidatePackage, Role } from '../../src/shared/types.js';

const temporaryFiles: string[] = [];

afterEach(() => {
  for (const file of temporaryFiles.splice(0)) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(`${file}-shm`)) fs.unlinkSync(`${file}-shm`);
    if (fs.existsSync(`${file}-wal`)) fs.unlinkSync(`${file}-wal`);
  }
});

function signedAction(sessionId: string, action: string, body: unknown, secretKey: string) {
  return {
    action,
    body,
    signature: signPayload({ sessionId, action, body }, secretKey),
  };
}

describe('mediator API', () => {
  it('completes a sealed negotiation and issues a verifiable receipt', async () => {
    process.env.NODE_ENV = 'test';
    const databasePath = path.join(os.tmpdir(), `cgp-${crypto.randomUUID()}.sqlite`);
    temporaryFiles.push(databasePath);
    const { app } = await buildApp({
      host: '127.0.0.1',
      port: 3000,
      databasePath,
      baseUrl: 'http://localhost:3000',
      trustProxy: false,
    });

    const keysA = createSigningKeypair();
    const keysB = createSigningKeypair();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        title: 'Integration negotiation',
        templateId: settlementTemplate.id,
        displayName: 'Party A',
        publicKey: keysA.publicKey,
        expiresInHours: 24,
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json<{
      session: { id: string; candidates: CandidatePackage[] };
      credential: { role: Role; token: string };
      inviteCode: string;
    }>();

    const joinResponse = await app.inject({
      method: 'POST',
      url: `/api/sessions/${created.session.id}/join`,
      payload: {
        inviteCode: created.inviteCode,
        displayName: 'Party B',
        publicKey: keysB.publicKey,
      },
    });
    expect(joinResponse.statusCode).toBe(200);
    const joined = joinResponse.json<{
      credential: { role: Role; token: string };
    }>();

    const candidateIds = created.session.candidates.map((candidate) => candidate.id);
    const accepted = new Set([candidateIds[0], candidateIds[3], candidateIds[8]]);
    const sealedA = createBlindedSet(candidateIds, accepted);
    const sealedB = createBlindedSet(candidateIds, accepted);
    const seedA = 'seed-a';
    const seedB = 'seed-b';

    const submit = async (
      role: Role,
      token: string,
      secretKey: string,
      action: string,
      body: unknown,
    ) =>
      app.inject({
        method: 'POST',
        url: `/api/sessions/${created.session.id}/actions/${action}`,
        headers: { authorization: `Bearer ${token}` },
        payload: signedAction(created.session.id, action, body, secretKey),
      });

    expect(
      (
        await submit('a', created.credential.token, keysA.secretKey, 'submit-blinded', {
          points: sealedA.points,
          psiPublicKey: sealedA.publicKey,
          seedCommitment: commitment('selection-seed', created.session.id, seedA),
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await submit('b', joined.credential.token, keysB.secretKey, 'submit-blinded', {
          points: sealedB.points,
          psiPublicKey: sealedB.publicKey,
          seedCommitment: commitment('selection-seed', created.session.id, seedB),
        })
      ).statusCode,
    ).toBe(204);

    const partyAView = (
      await app.inject({
        method: 'GET',
        url: `/api/sessions/${created.session.id}/party`,
        headers: { authorization: `Bearer ${created.credential.token}` },
      })
    ).json<{ peerPoints: string[] }>();
    const partyBView = (
      await app.inject({
        method: 'GET',
        url: `/api/sessions/${created.session.id}/party`,
        headers: { authorization: `Bearer ${joined.credential.token}` },
      })
    ).json<{ peerPoints: string[] }>();

    await submit(
      'a',
      created.credential.token,
      keysA.secretKey,
      'submit-transformed',
      transformBlindedSetWithProof(
        partyAView.peerPoints,
        sealedA.secret,
        `${created.session.id}:a:transform`,
      ),
    );
    await submit(
      'b',
      joined.credential.token,
      keysB.secretKey,
      'submit-transformed',
      transformBlindedSetWithProof(
        partyBView.peerPoints,
        sealedB.secret,
        `${created.session.id}:b:transform`,
      ),
    );
    await submit('a', created.credential.token, keysA.secretKey, 'reveal-seed', {
      seed: seedA,
    });
    await submit('b', joined.credential.token, keysB.secretKey, 'reveal-seed', {
      seed: seedB,
    });

    const selectionA = (
      await app.inject({
        method: 'GET',
        url: `/api/sessions/${created.session.id}/party`,
        headers: { authorization: `Bearer ${created.credential.token}` },
      })
    ).json<{ selectedIndex: number }>();
    const selectionB = (
      await app.inject({
        method: 'GET',
        url: `/api/sessions/${created.session.id}/party`,
        headers: { authorization: `Bearer ${joined.credential.token}` },
      })
    ).json<{ selectedIndex: number }>();
    const selectedA = sealedA.mapping[selectionA.selectedIndex]!;
    const selectedB = sealedB.mapping[selectionB.selectedIndex]!;
    expect(selectedA).toBe(selectedB);

    const packageA = { candidateId: selectedA, nonce: 'package-a' };
    const packageB = { candidateId: selectedB, nonce: 'package-b' };
    await submit('a', created.credential.token, keysA.secretKey, 'commit-package', {
      commitment: commitment('selected-package', created.session.id, packageA),
    });
    await submit('b', joined.credential.token, keysB.secretKey, 'commit-package', {
      commitment: commitment('selected-package', created.session.id, packageB),
    });
    await submit('a', created.credential.token, keysA.secretKey, 'reveal-package', packageA);
    await submit('b', joined.credential.token, keysB.secretKey, 'reveal-package', packageB);

    const approvalA = { approved: true, nonce: 'approval-a' };
    const approvalB = { approved: true, nonce: 'approval-b' };
    await submit('a', created.credential.token, keysA.secretKey, 'commit-approval', {
      commitment: commitment('final-approval', created.session.id, approvalA),
    });
    await submit('b', joined.credential.token, keysB.secretKey, 'commit-approval', {
      commitment: commitment('final-approval', created.session.id, approvalB),
    });
    await submit('a', created.credential.token, keysA.secretKey, 'reveal-approval', approvalA);
    await submit('b', joined.credential.token, keysB.secretKey, 'reveal-approval', approvalB);

    const finalResponse = await app.inject({
      method: 'GET',
      url: `/api/sessions/${created.session.id}`,
      headers: { authorization: `Bearer ${created.credential.token}` },
    });
    const finalState = finalResponse.json<{
      result: string;
      selectedCandidateId: string;
      receipt: {
        signature: string;
        mediatorPublicKey: string;
        [key: string]: unknown;
      };
    }>();
    expect(finalState.result).toBe('agreement');
    expect(finalState.selectedCandidateId).toBe(selectedA);
    const { signature, ...unsignedReceipt } = finalState.receipt;
    expect(verifyPayload(unsignedReceipt, signature, finalState.receipt.mediatorPublicKey)).toBe(
      true,
    );

    const exportResponse = await app.inject({
      method: 'GET',
      url: `/api/sessions/${created.session.id}/export/agreement.docx`,
      headers: { authorization: `Bearer ${created.credential.token}` },
    });
    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.rawPayload.byteLength).toBeGreaterThan(1_000);

    await app.close();
  });
});
