# Common Ground Protocol

Common Ground Protocol is an open protocol and self-hosted reference implementation for sealed agent-to-agent negotiation.

It explores a practical question for lawyers and legal-technology builders: can two parties use agents to search for a complete deal without giving away their fallback positions along the way?

Each party gives its own browser agent a private negotiating mandate. The agents consider complete contract or settlement packages across multiple issues and look for packages that both sides can accept. The central rule is that one party's acceptance is disclosed only when the other party independently accepts the same package.

## Why this exists

Negotiation depends on information control. A party may be willing to accept a term without wanting to announce that willingness before it knows whether the other side will agree. Revealing every acceptable position can weaken bargaining leverage, invite further demands, or turn a possible compromise into a new starting point.

This problem becomes more pronounced when agents negotiate automatically. An agent can evaluate thousands of combinations quickly, but a conventional exchange may reveal much more than a human negotiator would. Even a simple response such as "Party A would accept this package, but Party B would not" gives Party B useful information about Party A's position.

Common Ground Protocol tests a different approach:

- A rejected package should reveal nothing about whether the other party would have accepted it.
- A party should learn about an acceptance only when the acceptance is mutual.
- The agents should evaluate whole packages, because the acceptable result may depend on tradeoffs among several clauses.
- The mediator should help the parties find overlap without receiving their private instructions, scoring, or reasons.
- No final agreement should be produced without a separate approval from both parties.

The project takes inspiration from the role of a trusted human mediator who can receive confidential positions from both sides, identify common ground, and disclose only the result the parties have authorized. It asks how much of that function can be expressed as an open, inspectable protocol.

## What it is for

Common Ground Protocol is intended as a foundation for experimentation, research, and legal-technology development. Possible uses include:

- Exploring agent-assisted contract negotiation across several interdependent clauses
- Testing sealed settlement matching without limiting the negotiation to a single dollar figure
- Building internal negotiation tools in which each party controls its own agent and private mandate
- Studying how automated negotiators can preserve bargaining positions while searching for efficient tradeoffs
- Prototyping mediator, online dispute resolution, procurement, insurance, or claims workflows
- Providing a concrete protocol that lawyers, cryptographers, engineers, and dispute-resolution professionals can examine and improve together

The current implementation works from options the parties define in advance; it does not decide business objectives or draft bespoke clauses during a negotiation. It is not a substitute for legal judgment, authority checks, client instructions, or a lawyer's review of the resulting language. Its cryptographic design has not received an independent audit.

## How it works, in plain English

Consider a negotiation covering five contract issues. Each issue has several possible outcomes. Different combinations produce complete packages: one package might pair a higher liability cap with shorter payment terms, while another might trade a lower cap for broader indemnity.

1. The parties define the negotiating space by agreeing on the issues and the possible language or outcomes for each issue. Both agents work from that same public menu.
2. Each party privately instructs its own agent. A party can score terms, prohibit terms, set minimum requirements, and create rules that link one issue to another. Those instructions stay in that party's browser.
3. Each agent identifies acceptable complete packages. The agent considers the tradeoffs across all issues rather than negotiating each clause in isolation.
4. The mediator checks for common ground without seeing the lists. The agents send cryptographically disguised sets. The mediator can determine whether the sets overlap, but it does not receive the parties' mandates or a readable list of what either side would accept.
5. Unsuccessful positions remain sealed. If one party would accept a package and the other would not, neither party learns the other's answer. If there is no overlap at all, both sides learn only that no match was found.
6. A matching package is selected and confirmed. If several packages are mutually acceptable, a process using randomness contributed by both parties selects one. Each agent independently confirms that it identified the same package.
7. The parties make a separate sealed approval decision. A party does not learn whether the other approved unless both approve. Only mutual approval produces an agreement and signed receipt.

The protocol therefore separates three questions that are often collapsed together: what each party could accept, whether the parties have any common ground, and whether each party authorizes the selected result.

## What it does

- Negotiates complete multi-issue packages rather than isolated clauses.
- Keeps mandates, scores, rejected packages, constraints, and unsuccessful acceptances in each party's browser tab.
- Sends fixed-size padded point sets so acceptance-set size is not disclosed.
- Proves that each peer set was transformed with one committed scalar in the original order.
- Selects among overlapping packages using randomness committed by both parties.
- Requires both agents to confirm the same selected package.
- Uses sealed final approvals so a declining party does not learn whether the other party approved.
- Produces a signed outcome receipt and exports a Word agreement or Markdown term sheet.
- Supports built-in synthetic commercial-contract and settlement scenarios.
- Accepts custom negotiation schemas as validated JSON.

## What the mediator learns

The mediator receives:

- The public issue schema and complete candidate universe
- Padded blinded point sets
- Transformed overlap tokens
- Protocol timing and party identifiers
- The final package only after both agents independently reveal the same package

The mediator does not receive:

- Private mandates
- Option scores
- Constraint reasons
- Individual accepted-package identifiers
- Rejected-package identifiers
- An individual final approval unless both parties complete the approval protocol

The current cryptographic mechanism is a reviewable reference implementation. It has not received an independent cryptographic audit and should not be used for production legal commitments without one.

## Run locally

Requirements:

- Node.js 24 or later
- npm 11 or later

```bash
git clone https://github.com/dvelton/common-ground-protocol
cd common-ground-protocol
npm ci --ignore-scripts
npm run dev
```

Open `http://localhost:5173`.

The install uses exact versions from `package-lock.json`. The lockfile resolves only through the public npm registry and includes integrity hashes. The application does not require dependency lifecycle scripts for local development.

## Run as one self-hosted service

```bash
npm ci --ignore-scripts
npm run build
npm start
```

Open `http://localhost:3000`.

The SQLite database is created at `./data/common-ground.sqlite` unless `CGP_DATABASE_PATH` is set.

### Docker

```bash
docker compose up --build
```

## Practical flow

1. Party A selects or imports a public negotiation schema.
2. Party A sends Party B the session ID and one-time invitation code through an existing trusted channel.
3. Each party privately scores the available terms and adds any cross-issue constraints.
4. Each browser agent derives its complete acceptable-package set locally.
5. The agents perform padded private-set matching through the mediator.
6. If no overlap exists, the system reveals no individual acceptance.
7. If overlap exists, committed randomness selects one matching package.
8. Both agents independently identify and commit that package.
9. Each party makes a sealed final approval decision.
10. If both approve, the system issues a signed receipt and exportable agreement.

## Built-in scenarios

### Commercial services agreement

The synthetic commercial template negotiates:

- General liability cap
- IP indemnity
- Payment terms
- Initial term
- Service-data use

### Commercial settlement

The synthetic settlement template negotiates:

- Payment amount
- Payment timing
- Confidentiality
- Admission language

The clauses are examples for testing the protocol. They are not legal advice or approved contract language.

## Commands

| Command             | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Run the mediator and web interface locally |
| `npm run build`     | Build the web interface and server         |
| `npm start`         | Run the built self-hosted service          |
| `npm test`          | Run protocol and server tests              |
| `npm run test:e2e`  | Run the complete two-browser negotiation   |
| `npm run lint`      | Run ESLint                                 |
| `npm run typecheck` | Run both TypeScript configurations         |
| `npm run test:all`  | Run all validation                         |

## Security model

Read [THREAT-MODEL.md](THREAT-MODEL.md) before using or extending the protocol. The most important limit is that repeated sessions can leak information even when each individual session preserves unsuccessful acceptances.

Security reports should follow [SECURITY.md](SECURITY.md).

## Protocol documentation

- [Protocol specification](docs/PROTOCOL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](THREAT-MODEL.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).
