import { ed25519 } from '@noble/curves/ed25519.js';
import { secp256k1, secp256k1_hasher } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { canonicalJson, fromBase64Url, hashText, randomBytes, toBase64Url } from './encoding.js';
import type { IntersectionMatch } from './types.js';

const encoder = new TextEncoder();
const CURVE_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

function bytesToBigInt(bytes: Uint8Array): bigint {
  return BigInt(`0x${bytesToHex(bytes)}`);
}

function bigIntToBytes(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  return Uint8Array.from(hex.match(/.{2}/gu) ?? [], (byte) => Number.parseInt(byte, 16));
}

function randomScalarBytes(): Uint8Array {
  while (true) {
    const secret = secp256k1.utils.randomSecretKey();
    if (secp256k1.utils.isValidSecretKey(secret)) return secret;
  }
}

function scalarFromEncoded(value: string): bigint {
  const bytes = fromBase64Url(value);
  if (!secp256k1.utils.isValidSecretKey(bytes)) throw new Error('Invalid PSI scalar.');
  return bytesToBigInt(bytes);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const sample = randomBytes(4);
    const number = (sample[0] << 24) | (sample[1] << 16) | (sample[2] << 8) | sample[3];
    const target = Math.abs(number) % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export interface BlindedSet {
  secret: string;
  publicKey: string;
  points: string[];
  mapping: Array<string | null>;
}

export interface DleqProof {
  t1: string;
  t2: string;
  s: string;
}

export interface ProvenTransformation {
  points: string[];
  proofs: DleqProof[];
}

export function createBlindedSet(candidateIds: string[], acceptedIds: Set<string>): BlindedSet {
  const secretBytes = randomScalarBytes();
  const scalar = bytesToBigInt(secretBytes);
  const entries = candidateIds.map((candidateId) => {
    if (acceptedIds.has(candidateId)) {
      const point = secp256k1_hasher
        .hashToCurve(encoder.encode(`cgp-package-v1:${candidateId}`))
        .multiply(scalar);
      return { point: toBase64Url(point.toBytes(true)), candidateId };
    }

    const decoy = secp256k1.Point.BASE.multiply(bytesToBigInt(randomScalarBytes()));
    return { point: toBase64Url(decoy.toBytes(true)), candidateId: null };
  });

  const shuffled = shuffle(entries);
  return {
    secret: toBase64Url(secretBytes),
    publicKey: toBase64Url(secp256k1.Point.BASE.multiply(scalar).toBytes(true)),
    points: shuffled.map((entry) => entry.point),
    mapping: shuffled.map((entry) => entry.candidateId),
  };
}

export function transformBlindedSet(points: string[], encodedSecret: string): string[] {
  const scalar = scalarFromEncoded(encodedSecret);
  return points.map((encodedPoint) => {
    const point = secp256k1.Point.fromBytes(fromBase64Url(encodedPoint));
    point.assertValidity();
    return toBase64Url(point.multiply(scalar).toBytes(true));
  });
}

function proofChallenge(input: {
  context: string;
  index: number;
  publicKey: string;
  inputPoint: string;
  outputPoint: string;
  t1: string;
  t2: string;
}): bigint {
  const challenge = bytesToBigInt(sha256(encoder.encode(`cgp-dleq-v1:${canonicalJson(input)}`)));
  return challenge % CURVE_ORDER || 1n;
}

export function transformBlindedSetWithProof(
  points: string[],
  encodedSecret: string,
  context: string,
): ProvenTransformation {
  const scalar = scalarFromEncoded(encodedSecret);
  const publicKey = toBase64Url(secp256k1.Point.BASE.multiply(scalar).toBytes(true));
  const transformed = transformBlindedSet(points, encodedSecret);
  const proofs = points.map((inputPoint, index) => {
    const input = secp256k1.Point.fromBytes(fromBase64Url(inputPoint));
    let randomScalar = bytesToBigInt(randomScalarBytes());
    let t1 = secp256k1.Point.BASE.multiply(randomScalar);
    let t2 = input.multiply(randomScalar);
    let encodedT1 = toBase64Url(t1.toBytes(true));
    let encodedT2 = toBase64Url(t2.toBytes(true));
    let challenge = proofChallenge({
      context,
      index,
      publicKey,
      inputPoint,
      outputPoint: transformed[index],
      t1: encodedT1,
      t2: encodedT2,
    });
    let response = (randomScalar + challenge * scalar) % CURVE_ORDER;
    while (response === 0n) {
      randomScalar = bytesToBigInt(randomScalarBytes());
      t1 = secp256k1.Point.BASE.multiply(randomScalar);
      t2 = input.multiply(randomScalar);
      encodedT1 = toBase64Url(t1.toBytes(true));
      encodedT2 = toBase64Url(t2.toBytes(true));
      challenge = proofChallenge({
        context,
        index,
        publicKey,
        inputPoint,
        outputPoint: transformed[index],
        t1: encodedT1,
        t2: encodedT2,
      });
      response = (randomScalar + challenge * scalar) % CURVE_ORDER;
    }
    return {
      t1: encodedT1,
      t2: encodedT2,
      s: toBase64Url(bigIntToBytes(response)),
    };
  });
  return { points: transformed, proofs };
}

export function verifyTransformedSet(
  inputPoints: string[],
  outputPoints: string[],
  proofs: DleqProof[],
  publicKey: string,
  context: string,
): void {
  if (inputPoints.length !== outputPoints.length || inputPoints.length !== proofs.length) {
    throw new Error('Transformation proof count does not match the point set.');
  }
  const scalarPublicKey = secp256k1.Point.fromBytes(fromBase64Url(publicKey));
  scalarPublicKey.assertValidity();
  if (scalarPublicKey.is0()) throw new Error('Invalid PSI public key.');

  for (let index = 0; index < inputPoints.length; index += 1) {
    const inputPoint = inputPoints[index];
    const outputPoint = outputPoints[index];
    const proof = proofs[index];
    const input = secp256k1.Point.fromBytes(fromBase64Url(inputPoint));
    const output = secp256k1.Point.fromBytes(fromBase64Url(outputPoint));
    const t1 = secp256k1.Point.fromBytes(fromBase64Url(proof.t1));
    const t2 = secp256k1.Point.fromBytes(fromBase64Url(proof.t2));
    const responseBytes = fromBase64Url(proof.s);
    const response = bytesToBigInt(responseBytes);
    if (responseBytes.length !== 32 || response <= 0n || response >= CURVE_ORDER) {
      throw new Error('Invalid transformation proof response.');
    }
    const challenge = proofChallenge({
      context,
      index,
      publicKey,
      inputPoint,
      outputPoint,
      t1: proof.t1,
      t2: proof.t2,
    });
    const firstValid = secp256k1.Point.BASE.multiply(response).equals(
      t1.add(scalarPublicKey.multiply(challenge)),
    );
    const secondValid = input.multiply(response).equals(t2.add(output.multiply(challenge)));
    if (!firstValid || !secondValid) {
      throw new Error(`Invalid transformation proof at index ${index}.`);
    }
  }
}

export function validatePublicPoint(encodedPoint: string): void {
  const point = secp256k1.Point.fromBytes(fromBase64Url(encodedPoint));
  point.assertValidity();
  if (point.is0()) throw new Error('Point at infinity is not permitted.');
}

export function validatePointSet(points: string[], expectedLength: number): void {
  if (points.length !== expectedLength) {
    throw new Error(`Expected ${expectedLength} points, received ${points.length}.`);
  }
  if (new Set(points).size !== points.length) throw new Error('Point set contains duplicates.');
  for (const encodedPoint of points) {
    const point = secp256k1.Point.fromBytes(fromBase64Url(encodedPoint));
    point.assertValidity();
    if (point.is0()) throw new Error('Point at infinity is not permitted.');
  }
}

export function findIntersections(
  aTransformsB: string[],
  bTransformsA: string[],
): IntersectionMatch[] {
  const positionsA = new Map<string, number>();
  for (const [indexA, token] of bTransformsA.entries()) positionsA.set(token, indexA);

  const matches: IntersectionMatch[] = [];
  for (const [indexB, token] of aTransformsB.entries()) {
    const indexA = positionsA.get(token);
    if (indexA !== undefined) matches.push({ token, indexA, indexB });
  }
  return matches;
}

export function selectIntersection(
  matches: IntersectionMatch[],
  combinedSeed: string,
): IntersectionMatch {
  if (matches.length === 0) throw new Error('Cannot select from an empty intersection.');
  return [...matches].sort((left, right) =>
    hashText(`${combinedSeed}:${left.token}`).localeCompare(
      hashText(`${combinedSeed}:${right.token}`),
    ),
  )[0];
}

export function createSigningKeypair(): { secretKey: string; publicKey: string } {
  const { secretKey, publicKey } = ed25519.keygen();
  return {
    secretKey: toBase64Url(secretKey),
    publicKey: toBase64Url(publicKey),
  };
}

export function signPayload(payload: unknown, encodedSecretKey: string): string {
  const message = encoder.encode(canonicalJson(payload));
  return toBase64Url(ed25519.sign(message, fromBase64Url(encodedSecretKey)));
}

export function verifyPayload(
  payload: unknown,
  signature: string,
  encodedPublicKey: string,
): boolean {
  try {
    return ed25519.verify(
      fromBase64Url(signature),
      encoder.encode(canonicalJson(payload)),
      fromBase64Url(encodedPublicKey),
    );
  } catch {
    return false;
  }
}

export function commitment(kind: string, sessionId: string, value: unknown): string {
  return bytesToHex(sha256(encoder.encode(`${kind}:${sessionId}:${canonicalJson(value)}`)));
}
