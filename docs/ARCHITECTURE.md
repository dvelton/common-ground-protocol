# Architecture

## Components

### Party browser agent

The browser agent:

- Stores the private mandate in `sessionStorage`
- Generates ephemeral signing and matching keys
- Evaluates every public package locally
- Creates the padded blinded set
- Transforms the peer set with same-scalar, order-bound proofs
- Maps the selected token position back to a package
- Commits and reveals the selected package
- Commits and reveals the party's final approval

The browser agent operates without an external model provider. Future model adapters should assist with mandate drafting or clause mapping but must not bypass deterministic validation.

### Mediator server

The Fastify server:

- Authenticates party bearer credentials
- Verifies signed actions
- Enforces the protocol state machine
- Persists session state in SQLite
- Compares transformed tokens
- Selects a match using committed randomness
- Restricts role-specific responses
- Issues signed outcome receipts
- Exports final agreements

The mediator never receives mandate JSON or an accepted-package list.

### Shared protocol library

Shared TypeScript modules provide:

- Zod schemas
- Canonical JSON
- Candidate generation
- Mandate evaluation
- Curve-point matching
- Ed25519 signatures
- Receipt verification
- Synthetic negotiation templates

## Storage

Server state uses the Node.js built-in SQLite API. Party-private state uses browser `sessionStorage` and is lost when the tab's session ends.

The reference implementation deliberately avoids accounts, analytics, telemetry, third-party model APIs, hosted databases, and external identity providers.

## Deployment

The production build is one self-hosted Node.js process:

```text
Browser A ----\
               Fastify + static React + SQLite
Browser B ----/
```

TLS termination is expected at a reverse proxy for any non-local deployment.
Container deployments bind the application to `0.0.0.0`; ordinary local execution defaults to loopback. Set `CGP_TRUST_PROXY=true` only behind an explicitly trusted reverse proxy.

## Dependency policy

- Exact dependency versions
- Public npm registry only
- Lockfile integrity hashes
- Registry-signature verification
- No unnecessary native database package
- No runtime telemetry
- No dependency lifecycle scripts required by the application
