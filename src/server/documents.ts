import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { renderCandidate } from '../shared/candidates.js';
import type { SessionState } from '../shared/types.js';

export function agreementMarkdown(state: SessionState): string {
  if (state.result !== 'agreement' || !state.selectedCandidateId) {
    throw new Error('No finalized agreement is available.');
  }
  const candidate = state.candidates.find((item) => item.id === state.selectedCandidateId);
  if (!candidate) throw new Error('Selected package is missing.');
  const rendered = renderCandidate(state.template, candidate);
  return [
    `# ${state.title}`,
    '',
    rendered.agreement,
    '',
    '## Negotiated terms',
    '',
    ...rendered.terms.flatMap((term) => [`### ${term.issue}: ${term.option}`, '', term.clause, '']),
    '---',
    '',
    `Common Ground Protocol session: ${state.id}`,
    `Receipt hash: ${state.receipt?.transcriptHead ?? 'unavailable'}`,
  ].join('\n');
}

export async function agreementDocx(state: SessionState): Promise<Buffer> {
  if (state.result !== 'agreement' || !state.selectedCandidateId) {
    throw new Error('No finalized agreement is available.');
  }
  const candidate = state.candidates.find((item) => item.id === state.selectedCandidateId);
  if (!candidate) throw new Error('Selected package is missing.');
  const rendered = renderCandidate(state.template, candidate);
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun(state.title)],
          }),
          new Paragraph(rendered.agreement),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('Negotiated terms')],
          }),
          ...rendered.terms.flatMap((term) => [
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun(`${term.issue}: ${term.option}`)],
            }),
            new Paragraph(term.clause),
          ]),
          new Paragraph({
            children: [
              new TextRun({
                text: `Common Ground Protocol session ${state.id}`,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
