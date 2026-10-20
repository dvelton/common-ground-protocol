import { describe, expect, it } from 'vitest';
import {
  createBlindedSet,
  findIntersections,
  selectIntersection,
  transformBlindedSet,
  transformBlindedSetWithProof,
  verifyTransformedSet,
} from '../../src/shared/crypto.js';

describe('padded private-set matching', () => {
  it('finds only mutual acceptances without exposing rejected candidate ids', () => {
    const candidates = ['pkg-a', 'pkg-b', 'pkg-c', 'pkg-d'];
    const partyA = createBlindedSet(candidates, new Set(['pkg-a', 'pkg-c']));
    const partyB = createBlindedSet(candidates, new Set(['pkg-b', 'pkg-c']));

    const aTransformsB = transformBlindedSet(partyB.points, partyA.secret);
    const bTransformsA = transformBlindedSet(partyA.points, partyB.secret);
    const matches = findIntersections(aTransformsB, bTransformsA);

    expect(matches).toHaveLength(1);
    expect(partyA.mapping[matches[0].indexA]).toBe('pkg-c');
    expect(partyB.mapping[matches[0].indexB]).toBe('pkg-c');
    expect(selectIntersection(matches, 'combined-seed')).toEqual(matches[0]);
  });

  it('rejects reordered transformations that could probe the peer acceptance set', () => {
    const candidates = ['pkg-a', 'pkg-b', 'pkg-c'];
    const party = createBlindedSet(candidates, new Set(candidates));
    const peer = createBlindedSet(candidates, new Set(candidates));
    const context = 'session:a:transform';
    const transformed = transformBlindedSetWithProof(peer.points, party.secret, context);

    expect(() =>
      verifyTransformedSet(
        peer.points,
        [...transformed.points].reverse(),
        transformed.proofs,
        party.publicKey,
        context,
      ),
    ).toThrow(/Invalid transformation proof/u);
  });

  it('uses a fixed-size shuffled payload regardless of the acceptance count', () => {
    const candidates = ['pkg-a', 'pkg-b', 'pkg-c'];
    const none = createBlindedSet(candidates, new Set());
    const all = createBlindedSet(candidates, new Set(candidates));

    expect(none.points).toHaveLength(candidates.length);
    expect(all.points).toHaveLength(candidates.length);
    expect(none.points).not.toEqual(all.points);
  });
});
