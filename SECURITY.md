# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting feature for this repository. Include:

- Affected version or commit
- Reproduction steps
- Security impact
- Whether private mandates or unsuccessful acceptances can be exposed
- Any suggested remediation

Reports involving cryptographic correctness, signature bypass, authentication bypass, cross-party data disclosure, dependency compromise, or receipt forgery will be prioritized.

## Supported versions

Until the protocol reaches a stable audited release, only the current `main` branch is supported.

## Security claims

The repository documentation defines the intended privacy properties and their limits. A bug report demonstrating that a rejecting party can distinguish accept/reject from reject/reject for the same candidate is a protocol-level security issue.
