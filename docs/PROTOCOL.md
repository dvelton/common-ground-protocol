# Common Ground Protocol specification

Status: reference protocol version 1.0.

## Privacy invariant

For any candidate package rejected by a party, that party must not be able to distinguish whether the counterparty accepted or rejected that package from the mediator's output.

The mediator releases a candidate identifier only after both parties independently map the selected overlap token to the same package and commit their results.

## Public inputs

Every session has:

- A validated negotiation template
- A finite candidate-package universe
- Two party signing keys
- A session expiration
- A fixed protocol version

The candidate universe is generated as the Cartesian product of issue options. Version 1.0 limits a session to 1,000 packages.

## Private inputs

Each party locally holds:

- Option scores
- Prohibited options
- Cross-issue constraints
- Minimum acceptable weighted score
- Accepted candidate identifiers
- A private curve scalar
- A selection seed
- Final approval intent

Private mandates never enter the wire protocol.

## Padded private-set matching

For each public candidate:

1. If the candidate is accepted, the agent hashes its identifier to a secp256k1 point and multiplies it by a fresh private scalar.
2. If the candidate is rejected, the agent substitutes a random valid curve point.
3. The complete list is shuffled.

Every party therefore submits exactly one point per public candidate, regardless of how many candidates it accepts.

The mediator exchanges the padded point lists. Each agent multiplies every peer point by its own scalar and returns the transformed list. Points corresponding to a mutually accepted identifier become equal because elliptic-curve scalar multiplication is commutative:

```text
(H(package) * a) * b = (H(package) * b) * a
```

Random padding points do not match except with negligible probability.

Every transformed point includes a non-interactive Chaum-Pedersen equality-of-discrete-log proof. The proof binds the original point, transformed point, list position, session, party role, and the scalar public key. The mediator verifies that the same scalar was applied to each peer point in the original order. This prevents a party from permuting or redirecting transformed positions to probe packages it did not accept.

The mediator learns overlap tokens and positions in the shuffled lists. It does not receive the candidate identifiers associated with those positions.

## Match selection

Each party commits a random seed before learning whether an overlap exists. If overlap exists, both parties reveal their seeds. The mediator hashes the combined seeds with each overlap token and selects the lowest resulting value.

This prevents either party or the mediator from selecting a preferred match after seeing the overlap set, assuming at least one party chooses its seed honestly and reveals it.

## Package confirmation

The mediator tells each party only the selected position in that party's own shuffled list.

Each agent:

1. Maps the position to its local candidate identifier.
2. Commits the identifier with a fresh nonce.
3. Reveals the identifier and nonce after both commitments exist.

If the identifiers differ, the session ends with `protocol_failure`. If they match, that identifier becomes the proposed agreement.

## Final approval

Each party commits either approval or rejection with a nonce. The decisions are revealed to the mediator only after both commitments exist.

The mediator releases:

- `agreement` if both approved
- `not_finalized` for every other combination

A rejecting party therefore cannot distinguish approval/rejection from rejection/rejection.

## Session state machine

```text
waiting_for_party
  -> collecting_blinded
  -> collecting_transformed
  -> complete(no_overlap)
  -> collecting_seed_reveals
  -> collecting_package_commits
  -> collecting_package_reveals
  -> collecting_approval_commits
  -> collecting_approval_reveals
  -> complete(agreement | not_finalized | protocol_failure)
```

## Signed actions

Every party action signs the canonical JSON object:

```json
{
  "sessionId": "uuid",
  "action": "action-name",
  "body": {}
}
```

The mediator verifies the signature against the public key registered when the party creates or joins the session.

## Outcome receipt

The mediator signs a receipt containing:

- Protocol and version
- Session identifier
- Result
- Final candidate identifier, only for an agreement
- Template hash
- Candidate-set hash
- Audit-chain head
- Completion timestamp
- Mediator public key

The mediator deletes blinded sets, transformed sets, seed reveals, package-reveal nonces, approval decisions, and intersection tokens when the session completes.
