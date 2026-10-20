import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { createSigningKeypair } from '../shared/crypto.js';
import { renderCandidate } from '../shared/candidates.js';
import { templateSchema } from '../shared/types.js';
import type { LocalPartyState, NegotiationTemplate, PrivateMandate } from '../shared/types.js';
import { templates } from '../shared/templates.js';
import { MandateEditor } from './components/MandateEditor.js';
import {
  createNegotiation,
  downloadAgreement,
  getPartyView,
  getSession,
  joinNegotiation,
  type PartyView,
  type PublicSession,
} from './lib/api.js';
import { activateAgent, advanceAgent, commitApproval } from './lib/agent.js';
import { loadPartyState, savePartyState } from './lib/storage.js';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="app-header">
        <Link className="brand" to="/">
          <span className="brand-mark">CG</span>
          <span>
            <strong>Common Ground Protocol</strong>
            <small>Sealed agent-to-agent negotiation</small>
          </span>
        </Link>
        <nav>
          <Link to="/create">Create negotiation</Link>
          <Link to="/join">Join</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        Self-hosted reference implementation. Synthetic templates are educational and are not legal
        advice.
      </footer>
    </>
  );
}

function HomePage() {
  return (
    <Layout>
      <section className="home-grid">
        <div>
          <p className="eyebrow">Open protocol and reference implementation</p>
          <h1>Reveal an acceptance only when both parties accept the same deal.</h1>
          <p className="lede">
            Each party’s agent evaluates complete contract or settlement packages against a private
            local mandate. The mediator finds overlap without receiving either party’s accepted
            package list.
          </p>
          <div className="button-row">
            <Link className="primary-button link-button" to="/create">
              Create negotiation
            </Link>
            <Link className="secondary-button link-button" to="/join">
              Join with an invitation
            </Link>
          </div>
        </div>
        <aside className="panel protocol-summary">
          <h2>Protocol boundary</h2>
          <dl>
            <div>
              <dt>Public</dt>
              <dd>Issue schema, candidate packages and final matched agreement</dd>
            </div>
            <div>
              <dt>Private</dt>
              <dd>Mandates, scores, rejected packages and unsuccessful acceptances</dd>
            </div>
            <div>
              <dt>Mediator learns</dt>
              <dd>Padded encrypted point sets, overlap tokens and the final package</dd>
            </div>
          </dl>
        </aside>
      </section>
    </Layout>
  );
}

function CreatePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('Commercial agreement negotiation');
  const [displayName, setDisplayName] = useState('Party A');
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [customJson, setCustomJson] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    setError('');
    try {
      const keys = createSigningKeypair();
      let customTemplate: NegotiationTemplate | undefined;
      if (templateId === 'custom') {
        customTemplate = templateSchema.parse(JSON.parse(customJson));
      }
      const response = await createNegotiation({
        title,
        templateId: customTemplate ? undefined : templateId,
        template: customTemplate,
        displayName,
        publicKey: keys.publicKey,
        expiresInHours: 72,
      });
      savePartyState({
        sessionId: response.session.id,
        role: response.credential.role,
        token: response.credential.token,
        inviteCode: response.inviteCode,
        signingSecretKey: keys.secretKey,
        signingPublicKey: keys.publicKey,
      });
      void navigate(`/session/${response.session.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create negotiation.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Layout>
      <section className="narrow-page">
        <div className="page-heading">
          <p className="eyebrow">New sealed negotiation</p>
          <h1>Create a session</h1>
        </div>
        <div className="panel form-panel">
          <label className="field">
            <span>Negotiation title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>Your party label</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="field">
            <span>Negotiation schema</span>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {templates.map((template) => (
                <option value={template.id} key={template.id}>
                  {template.name}
                </option>
              ))}
              <option value="custom">Custom template JSON</option>
            </select>
          </label>
          {templateId === 'custom' && (
            <label className="field">
              <span>Custom template</span>
              <textarea
                rows={16}
                value={customJson}
                onChange={(event) => setCustomJson(event.target.value)}
                placeholder={JSON.stringify(templates[0], null, 2)}
              />
            </label>
          )}
          {error && <div className="notice error-notice">{error}</div>}
          <button
            className="primary-button"
            disabled={creating || !title || !displayName}
            onClick={() => void create()}
          >
            {creating ? 'Creating…' : 'Create private session'}
          </button>
        </div>
      </section>
    </Layout>
  );
}

function JoinPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [sessionId, setSessionId] = useState(params.sessionId ?? '');
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('Party B');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  async function join() {
    setJoining(true);
    setError('');
    try {
      const keys = createSigningKeypair();
      const response = await joinNegotiation(sessionId, {
        inviteCode,
        displayName,
        publicKey: keys.publicKey,
      });
      savePartyState({
        sessionId,
        role: response.credential.role,
        token: response.credential.token,
        signingSecretKey: keys.secretKey,
        signingPublicKey: keys.publicKey,
      });
      void navigate(`/session/${sessionId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not join negotiation.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <Layout>
      <section className="narrow-page">
        <div className="page-heading">
          <p className="eyebrow">Counterparty access</p>
          <h1>Join a session</h1>
        </div>
        <div className="panel form-panel">
          <label className="field">
            <span>Session ID</span>
            <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
          </label>
          <label className="field">
            <span>Invitation code</span>
            <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
          </label>
          <label className="field">
            <span>Your party label</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          {error && <div className="notice error-notice">{error}</div>}
          <button
            className="primary-button"
            disabled={joining || !sessionId || !inviteCode || !displayName}
            onClick={() => void join()}
          >
            {joining ? 'Joining…' : 'Join negotiation'}
          </button>
        </div>
      </section>
    </Layout>
  );
}

const stageLabels: Record<PublicSession['stage'], string> = {
  waiting_for_party: 'Waiting for the counterparty',
  collecting_blinded: 'Agents are sealing their mandates',
  collecting_transformed: 'Agents are computing private overlap',
  collecting_seed_reveals: 'Selecting a match using committed randomness',
  collecting_package_commits: 'Agents are committing the selected package',
  collecting_package_reveals: 'Confirming that both agents found the same package',
  collecting_approval_commits: 'Waiting for final approvals',
  collecting_approval_reveals: 'Opening final approval commitments',
  complete: 'Negotiation complete',
  cancelled: 'Negotiation cancelled',
};

function SessionPage() {
  const { sessionId = '' } = useParams();
  const [session, setSession] = useState<PublicSession | null>(null);
  const [view, setView] = useState<PartyView | null>(null);
  const [local, setLocal] = useState<LocalPartyState | null>(() => loadPartyState(sessionId));
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const agentActionInFlight = useRef(false);
  const componentMounted = useRef(true);

  useEffect(() => {
    componentMounted.current = true;
    return () => {
      componentMounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!local) return;
    try {
      const publicState = await getSession(local);
      setSession(publicState);
      setView(await getPartyView(local));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load session.');
    }
  }, [local]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 1_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!local || !view) return;
    if (agentActionInFlight.current) return;
    agentActionInFlight.current = true;
    void advanceAgent(local, view)
      .then((next) => {
        if (componentMounted.current && next !== local) setLocal(next);
      })
      .catch((caught: unknown) => {
        if (componentMounted.current)
          setError(caught instanceof Error ? caught.message : 'Agent action failed.');
      })
      .finally(() => {
        agentActionInFlight.current = false;
      });
  }, [local, view]);

  const selectedCandidate = useMemo(
    () =>
      session?.selectedCandidateId
        ? session.candidates.find((candidate) => candidate.id === session.selectedCandidateId)
        : null,
    [session],
  );

  if (!local) {
    return <Navigate to={`/join/${sessionId}`} replace />;
  }

  if (!session) {
    return (
      <Layout>
        <section className="narrow-page">
          <div className="panel">{error || 'Loading session…'}</div>
        </section>
      </Layout>
    );
  }

  const currentSession = session;
  const currentLocal = local;

  async function activate(mandate: PrivateMandate) {
    setWorking(true);
    try {
      const next = await activateAgent(currentSession, currentLocal, mandate);
      setLocal(next);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not activate agent.');
    } finally {
      setWorking(false);
    }
  }

  async function approve(approved: boolean) {
    setWorking(true);
    try {
      const next = await commitApproval(currentLocal, approved);
      setLocal(next);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Approval failed.');
    } finally {
      setWorking(false);
    }
  }

  const rendered = selectedCandidate ? renderCandidate(session.template, selectedCandidate) : null;

  return (
    <Layout>
      <section className="session-page">
        <div className="session-heading">
          <div>
            <p className="eyebrow">Session {session.id}</p>
            <h1>{session.title}</h1>
            <p>{session.template.summary}</p>
          </div>
          <div className={`status-badge status-${session.stage}`}>{stageLabels[session.stage]}</div>
        </div>

        {error && <div className="notice error-notice">{error}</div>}

        {session.stage === 'waiting_for_party' && local.role === 'a' && (
          <section className="panel invite-panel">
            <h2>Invite the counterparty</h2>
            <p>
              Send the session ID and invitation code through a channel you already trust. The
              invitation code is not stored in plaintext by the mediator.
            </p>
            <div className="credential-grid">
              <div>
                <span>Session ID</span>
                <code>{session.id}</code>
              </div>
              <div>
                <span>Invitation code</span>
                <code>{local.inviteCode}</code>
              </div>
            </div>
          </section>
        )}

        {session.stage === 'collecting_blinded' && !view?.ownSubmission.blinded && (
          <MandateEditor
            template={session.template}
            label={session.parties[local.role] ?? `Party ${local.role.toUpperCase()}`}
            onActivate={activate}
            disabled={working}
          />
        )}

        {view?.ownSubmission.blinded &&
          !['collecting_approval_commits', 'collecting_approval_reveals', 'complete'].includes(
            session.stage,
          ) && (
            <section className="panel agent-panel">
              <div className="agent-pulse" aria-hidden="true" />
              <div>
                <h2>Your agent is participating automatically</h2>
                <p>
                  It is transforming padded point sets, opening committed randomness and confirming
                  only the selected overlap. Your mandate and rejected packages remain in this
                  browser tab.
                </p>
              </div>
            </section>
          )}

        {rendered && (
          <section className="panel matched-package">
            <p className="eyebrow">Mutually accepted package</p>
            <h2>{rendered.title}</h2>
            <div className="agreement-preview">
              <h3>Complete text subject to final approval</h3>
              {rendered.agreement.split('\n\n').map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="term-grid">
              {rendered.terms.map((term) => (
                <article key={term.issue}>
                  <span>{term.issue}</span>
                  <strong>{term.option}</strong>
                  <p>{term.clause}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {session.stage === 'collecting_approval_commits' &&
          !view?.ownSubmission.approvalCommitted && (
            <section className="panel approval-panel">
              <h2>Final approval</h2>
              <p>
                Your decision will be committed under seal. If you decline, you will not learn
                whether the other party approved or declined.
              </p>
              <div className="button-row">
                <button
                  className="primary-button"
                  disabled={working}
                  onClick={() => void approve(true)}
                >
                  Approve this package
                </button>
                <button
                  className="secondary-button danger-button"
                  disabled={working}
                  onClick={() => void approve(false)}
                >
                  Decline without disclosure
                </button>
              </div>
            </section>
          )}

        {session.stage === 'collecting_approval_reveals' && (
          <section className="panel agent-panel">
            <div className="agent-pulse" aria-hidden="true" />
            <div>
              <h2>Opening approval commitments</h2>
              <p>The mediator will disclose only whether both parties approved.</p>
            </div>
          </section>
        )}

        {session.stage === 'complete' && (
          <section className="panel result-panel">
            <p className="eyebrow">Final result</p>
            <h2>
              {session.result === 'agreement'
                ? 'Agreement finalized'
                : session.result === 'no_overlap'
                  ? 'No mutually acceptable package'
                  : session.result === 'not_finalized'
                    ? 'Package not finalized'
                    : 'Protocol could not confirm an agreement'}
            </h2>
            <p>
              {session.result === 'agreement'
                ? 'Both parties independently approved the same complete package.'
                : 'No individual acceptance, rejection, mandate or fallback position has been disclosed.'}
            </p>
            {session.result === 'agreement' && (
              <div className="button-row">
                <button
                  className="primary-button"
                  onClick={() => void downloadAgreement(local, 'docx')}
                >
                  Download Word agreement
                </button>
                <button
                  className="secondary-button"
                  onClick={() => void downloadAgreement(local, 'md')}
                >
                  Download Markdown
                </button>
              </div>
            )}
            {session.receipt && (
              <details>
                <summary>Signed outcome receipt</summary>
                <pre>{JSON.stringify(session.receipt, null, 2)}</pre>
              </details>
            )}
          </section>
        )}
      </section>
    </Layout>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:sessionId" element={<JoinPage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
