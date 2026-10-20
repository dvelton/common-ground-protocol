# Threat model

This document states what version 1.0 protects, what it leaks, and what it does not defend.

## Protected information

- Private mandates
- Option scores
- Constraint reasons
- Individual accepted packages
- Individual rejected packages
- Unsuccessful acceptances
- Individual final approval when the other party rejects

## Adversaries

### Curious counterparty

The counterparty follows the protocol but attempts to infer negotiating limits from messages and outcomes.

Controls:

- No free-text agent-to-agent channel
- Fixed-size padded point sets
- No per-package result messages
- Only one selected overlap is disclosed
- Identical final result for approval/rejection and rejection/rejection

### Malicious counterparty

The counterparty may submit malformed points, invalid signatures, duplicate actions, false package reveals, or inconsistent approvals.

Controls:

- Strict schemas and message-size limit
- Curve-point validation
- Duplicate-point rejection
- Same-scalar equality proofs bound to every transformed position
- Signed action envelopes
- Explicit state transitions
- Commit/reveal phases
- Dual independent package confirmation

The protocol does not force a party to reveal a committed seed or complete a session. A malicious party can cause denial of service.

The same-scalar proofs prevent a party from reordering peer points or substituting transformations in order to test whether the peer accepted a package outside the party's own sealed acceptance set.

### Curious mediator

The mediator observes all server-side state.

It learns:

- Session metadata and timing
- Public candidates
- Party identities supplied to the session
- Padded curve-point lists
- Overlap tokens and the number of overlaps while the session is active
- The final package if both agents confirm it

It does not receive accepted candidate identifiers before package confirmation. Completed sessions purge blinded sets, transformed sets, intersection tokens, private seeds, and approval decisions.

The mediator could modify its own software or send dishonest role-specific responses. Version 1.0 provides signed party inputs and a signed mediator receipt, but does not provide a zero-knowledge proof that the mediator selected or processed a match correctly.

### Network observer

The application does not implement its own transport encryption. Local development uses HTTP. Any remote deployment must use TLS through a trusted reverse proxy.

### Compromised endpoint

If a party's browser, operating system, extension, or origin is compromised, that party's mandate and ephemeral keys may be exposed. The protocol does not protect an endpoint from itself.

## Residual leakage

### Final agreement

A completed agreement necessarily reveals that both parties accepted the selected package.

### No-overlap inference

If no overlap exists, each party can infer that the counterparty rejected every package that it personally accepted. It does not learn which other packages the counterparty would accept.

### Repeated-session probing

A party can create repeated sessions with deliberately changed candidate universes or overly broad acceptance sets to learn more about a counterparty over time. Version 1.0 has no cross-session identity, rate budget, or privacy budget.

Production deployments should authenticate organizations and enforce cross-session limits.

### Cardinality during active computation

Padding hides each party's accepted-set size. The mediator still learns the number of mutual matches during computation. The public response does not expose that number.

### Timing

Submission and approval timing may reveal organizational behavior. Version 1.0 does not add timing delays or cover traffic.

## Cryptographic status

The reference mechanism uses:

- RFC 9380 hash-to-curve from `@noble/curves`
- secp256k1 scalar multiplication
- Non-interactive Chaum-Pedersen equality-of-discrete-log proofs
- Ed25519 signatures
- SHA-256 commitments
- Cryptographically secure browser randomness

The construction is intended to make the privacy property inspectable and testable. It is not represented as a formally proven private-set-intersection protocol and has not received an independent cryptographic audit.

Do not use version 1.0 for production legal, financial, employment, health, or other sensitive negotiations without independent cryptographic and application-security review.

## Out of scope

- Protecting a compromised endpoint
- Preventing a principal from lying to its own agent
- Guaranteeing truthful preference scores
- Making multi-issue negotiation strategy-proof
- Enforcing legal authority outside the application
- Proving generated language is legally sufficient
- Cross-session privacy
- Traffic-analysis resistance
- Availability against a party that stops responding
