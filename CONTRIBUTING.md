# Contributing

## Development

```bash
npm ci --ignore-scripts
npm run dev
```

Before opening a pull request:

```bash
npm run test:all
```

## Protocol changes

A protocol change must include:

- Updated schemas and state transitions
- Unit and integration tests
- A two-party browser test where applicable
- Threat-model analysis
- Documentation of new mediator or counterparty disclosures
- Backward-compatibility decision

Do not add a free-text field to party-to-party protocol messages. Human-readable explanations may be local or public, but they must not create a channel for private mandate data or prompt injection.

## Dependencies

Before adding an npm package:

1. Explain why the standard library or an existing dependency is insufficient.
2. Verify the exact package name, repository, maintainers, registry signatures, integrity hashes, advisories, and lifecycle scripts.
3. Pin the exact version.
4. Regenerate the lockfile from `https://registry.npmjs.org/`.
5. Run `npm audit signatures` and `npm audit`.

## Synthetic content only

Examples, fixtures, templates, screenshots, and documentation must use synthetic information. Do not commit client matters, internal communications, private repository references, credentials, personal data, or confidential URLs.
