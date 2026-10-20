import { useMemo, useState } from 'react';
import { acceptableCandidateIds, defaultMandate } from '../../shared/mandate.js';
import type { MandateConstraint, NegotiationTemplate, PrivateMandate } from '../../shared/types.js';
import { generateCandidates } from '../../shared/candidates.js';

interface MandateEditorProps {
  template: NegotiationTemplate;
  label: string;
  onActivate: (mandate: PrivateMandate) => Promise<void>;
  disabled?: boolean;
}

function findIssue(template: NegotiationTemplate, issueId: string) {
  const issue = template.issues.find((item) => item.id === issueId);
  if (!issue) throw new Error(`Unknown issue: ${issueId}`);
  return issue;
}

export function MandateEditor({
  template,
  label,
  onActivate,
  disabled = false,
}: MandateEditorProps) {
  const [mandate, setMandate] = useState(() => defaultMandate(template, label));
  const [saving, setSaving] = useState(false);
  const candidates = useMemo(() => generateCandidates(template), [template]);
  const acceptedCount = useMemo(
    () => acceptableCandidateIds(template, candidates, mandate).size,
    [template, candidates, mandate],
  );

  function updateScore(issueId: string, optionId: string, score: number) {
    setMandate((current) => ({
      ...current,
      optionScores: {
        ...current.optionScores,
        [issueId]: {
          ...current.optionScores[issueId],
          [optionId]: score,
        },
      },
    }));
  }

  function addConstraint() {
    const firstIssue = template.issues[0];
    const secondIssue = template.issues[1] ?? firstIssue;
    const constraint: MandateConstraint = {
      id: crypto.randomUUID(),
      when: { issueId: firstIssue.id, optionId: firstIssue.options[0].id },
      kind: 'requires',
      target: { issueId: secondIssue.id, optionId: secondIssue.options[0].id },
      note: '',
    };
    setMandate((current) => ({
      ...current,
      constraints: [...current.constraints, constraint],
    }));
  }

  function updateConstraint(index: number, constraint: MandateConstraint) {
    setMandate((current) => ({
      ...current,
      constraints: current.constraints.map((item, itemIndex) =>
        itemIndex === index ? constraint : item,
      ),
    }));
  }

  async function submit() {
    setSaving(true);
    try {
      await onActivate(mandate);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel mandate-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Private to this browser tab</p>
          <h2>Configure the {label} agent</h2>
        </div>
        <div className="private-count">
          <strong>{acceptedCount}</strong>
          <span>authorized packages</span>
        </div>
      </div>

      <label className="field compact-field">
        <span>Minimum weighted package score: {mandate.minimumScore}</span>
        <input
          type="range"
          min="0"
          max="100"
          value={mandate.minimumScore}
          onChange={(event) =>
            setMandate((current) => ({
              ...current,
              minimumScore: Number(event.target.value),
            }))
          }
        />
      </label>

      <div className="issue-grid">
        {template.issues.map((issue) => (
          <article className="issue-card" key={issue.id}>
            <h3>{issue.label}</h3>
            <p>{issue.description}</p>
            {issue.options.map((option) => {
              const score = mandate.optionScores[issue.id]?.[option.id] ?? -1;
              return (
                <label className="option-score" key={option.id}>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <select
                    value={score}
                    onChange={(event) =>
                      updateScore(issue.id, option.id, Number(event.target.value))
                    }
                  >
                    <option value="-1">Reject</option>
                    <option value="25">Accept, low preference</option>
                    <option value="50">Accept</option>
                    <option value="75">Prefer</option>
                    <option value="100">Strongly prefer</option>
                  </select>
                </label>
              );
            })}
          </article>
        ))}
      </div>

      <div className="constraint-section">
        <div className="section-heading">
          <div>
            <h3>Cross-issue constraints</h3>
            <p>Keep linked fallback positions inside the private mandate.</p>
          </div>
          <button className="secondary-button" type="button" onClick={addConstraint}>
            Add constraint
          </button>
        </div>
        {mandate.constraints.map((constraint, index) => {
          const whenIssue = findIssue(template, constraint.when.issueId);
          const targetIssue = findIssue(template, constraint.target.issueId);
          return (
            <div className="constraint-row" key={constraint.id}>
              <span>If</span>
              <select
                value={constraint.when.issueId}
                onChange={(event) => {
                  const issue = findIssue(template, event.target.value);
                  updateConstraint(index, {
                    ...constraint,
                    when: { issueId: issue.id, optionId: issue.options[0].id },
                  });
                }}
              >
                {template.issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.label}
                  </option>
                ))}
              </select>
              <select
                value={constraint.when.optionId}
                onChange={(event) =>
                  updateConstraint(index, {
                    ...constraint,
                    when: { ...constraint.when, optionId: event.target.value },
                  })
                }
              >
                {whenIssue.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={constraint.kind}
                onChange={(event) =>
                  updateConstraint(index, {
                    ...constraint,
                    kind: event.target.value as MandateConstraint['kind'],
                  })
                }
              >
                <option value="requires">requires</option>
                <option value="prohibits">prohibits</option>
              </select>
              <select
                value={constraint.target.issueId}
                onChange={(event) => {
                  const issue = findIssue(template, event.target.value);
                  updateConstraint(index, {
                    ...constraint,
                    target: { issueId: issue.id, optionId: issue.options[0].id },
                  });
                }}
              >
                {template.issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.label}
                  </option>
                ))}
              </select>
              <select
                value={constraint.target.optionId}
                onChange={(event) =>
                  updateConstraint(index, {
                    ...constraint,
                    target: { ...constraint.target, optionId: event.target.value },
                  })
                }
              >
                {targetIssue.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                className="text-button danger"
                type="button"
                onClick={() =>
                  setMandate((current) => ({
                    ...current,
                    constraints: current.constraints.filter(
                      (_item, itemIndex) => itemIndex !== index,
                    ),
                  }))
                }
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="notice privacy-notice">
        {acceptedCount === 0
          ? 'This mandate authorizes no package. Sealing it will produce a no-overlap result without disclosing individual positions.'
          : 'The mandate, option scores, rejected packages and constraint reasons remain in this tab. The mediator receives only a padded cryptographic set.'}
      </div>

      <button
        className="primary-button"
        type="button"
        disabled={disabled || saving}
        onClick={() => void submit()}
      >
        {saving ? 'Sealing mandate…' : 'Seal mandate and start agent'}
      </button>
    </section>
  );
}
