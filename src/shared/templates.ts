import type { NegotiationTemplate } from './types.js';

export const commercialContractTemplate: NegotiationTemplate = {
  id: 'commercial-contract',
  name: 'Commercial services agreement',
  summary:
    'A synthetic multi-issue services agreement for demonstrating sealed package negotiation.',
  preamble:
    'The parties agree that the following terms form the negotiated business and legal package. This example is educational and is not legal advice.',
  issues: [
    {
      id: 'liability-cap',
      label: 'General liability cap',
      description: 'Aggregate liability for ordinary claims.',
      weight: 3,
      options: [
        {
          id: 'fees-12-months',
          label: 'Fees paid in prior 12 months',
          description: 'General cap tied to one year of fees.',
          clause:
            'Except for the agreed exclusions, each party’s aggregate liability will not exceed fees paid or payable during the twelve months preceding the event giving rise to liability.',
        },
        {
          id: 'fees-24-months',
          label: 'Fees paid in prior 24 months',
          description: 'General cap tied to two years of fees.',
          clause:
            'Except for the agreed exclusions, each party’s aggregate liability will not exceed fees paid or payable during the twenty-four months preceding the event giving rise to liability.',
        },
        {
          id: 'uncapped',
          label: 'Uncapped',
          description: 'No aggregate general liability cap.',
          clause: 'The parties’ general liability is not subject to an aggregate monetary cap.',
        },
      ],
    },
    {
      id: 'ip-indemnity',
      label: 'IP indemnity',
      description: 'Allocation of third-party intellectual-property claim risk.',
      weight: 3,
      options: [
        {
          id: 'provider-only',
          label: 'Provider indemnity only',
          description: 'Provider covers claims arising from the service.',
          clause:
            'Provider will defend and indemnify Customer against third-party claims alleging that the unmodified service infringes intellectual-property rights.',
        },
        {
          id: 'mutual',
          label: 'Mutual indemnity',
          description: 'Each party covers claims arising from its materials.',
          clause:
            'Each party will defend and indemnify the other against third-party intellectual-property claims arising from materials supplied by the indemnifying party.',
        },
        {
          id: 'none',
          label: 'No IP indemnity',
          description: 'Neither party provides an IP indemnity.',
          clause: 'Neither party provides a contractual intellectual-property indemnity.',
        },
      ],
    },
    {
      id: 'payment-terms',
      label: 'Payment terms',
      description: 'Time allowed to pay undisputed invoices.',
      weight: 1,
      options: [
        {
          id: 'net-30',
          label: 'Net 30',
          description: 'Payment within 30 days.',
          clause: 'Undisputed invoices are due within thirty days after receipt.',
        },
        {
          id: 'net-45',
          label: 'Net 45',
          description: 'Payment within 45 days.',
          clause: 'Undisputed invoices are due within forty-five days after receipt.',
        },
        {
          id: 'net-60',
          label: 'Net 60',
          description: 'Payment within 60 days.',
          clause: 'Undisputed invoices are due within sixty days after receipt.',
        },
      ],
    },
    {
      id: 'initial-term',
      label: 'Initial term',
      description: 'Length of the initial contractual commitment.',
      weight: 2,
      options: [
        {
          id: 'one-year',
          label: 'One year',
          description: 'Twelve-month initial term.',
          clause: 'The initial term is twelve months.',
        },
        {
          id: 'two-years',
          label: 'Two years',
          description: 'Twenty-four-month initial term.',
          clause: 'The initial term is twenty-four months.',
        },
        {
          id: 'three-years',
          label: 'Three years',
          description: 'Thirty-six-month initial term.',
          clause: 'The initial term is thirty-six months.',
        },
      ],
    },
    {
      id: 'data-use',
      label: 'Service-data use',
      description: 'Permitted use of customer-provided service data.',
      weight: 3,
      options: [
        {
          id: 'service-only',
          label: 'Provide the service only',
          description: 'No secondary use.',
          clause:
            'Provider may process service data only to provide, secure, support, and comply with law regarding the service.',
        },
        {
          id: 'deidentified-analytics',
          label: 'Deidentified analytics',
          description: 'Secondary analytics using deidentified data.',
          clause:
            'Provider may also use data rendered non-identifiable and non-reidentifiable for aggregate analytics.',
        },
        {
          id: 'product-improvement',
          label: 'Product improvement',
          description: 'Broader product-improvement use.',
          clause:
            'Provider may use service data to improve its products, subject to confidentiality and applicable data-protection requirements.',
        },
      ],
    },
  ],
};

export const settlementTemplate: NegotiationTemplate = {
  id: 'settlement',
  name: 'Synthetic commercial settlement',
  summary: 'A synthetic settlement package combining monetary and non-monetary terms.',
  preamble:
    'The parties agree to resolve the synthetic dispute on the following terms. This example is educational and is not legal advice.',
  issues: [
    {
      id: 'payment',
      label: 'Settlement payment',
      description: 'Illustrative payment amount.',
      weight: 4,
      options: [
        {
          id: '500k',
          label: '$500,000',
          description: 'Illustrative lower amount.',
          clause: 'The paying party will pay five hundred thousand dollars.',
        },
        {
          id: '650k',
          label: '$650,000',
          description: 'Illustrative middle amount.',
          clause: 'The paying party will pay six hundred fifty thousand dollars.',
        },
        {
          id: '800k',
          label: '$800,000',
          description: 'Illustrative higher amount.',
          clause: 'The paying party will pay eight hundred thousand dollars.',
        },
      ],
    },
    {
      id: 'payment-timing',
      label: 'Payment timing',
      description: 'Timing after execution.',
      weight: 2,
      options: [
        {
          id: '10-days',
          label: '10 days',
          description: 'Payment within ten days.',
          clause: 'Payment is due within ten calendar days after execution.',
        },
        {
          id: '30-days',
          label: '30 days',
          description: 'Payment within thirty days.',
          clause: 'Payment is due within thirty calendar days after execution.',
        },
        {
          id: '60-days',
          label: '60 days',
          description: 'Payment within sixty days.',
          clause: 'Payment is due within sixty calendar days after execution.',
        },
      ],
    },
    {
      id: 'confidentiality',
      label: 'Confidentiality',
      description: 'Treatment of settlement terms.',
      weight: 2,
      options: [
        {
          id: 'full',
          label: 'Terms and existence confidential',
          description: 'Broader confidentiality.',
          clause:
            'The parties will keep the existence and terms of the settlement confidential, subject to customary legal and professional-advisor exceptions.',
        },
        {
          id: 'terms-only',
          label: 'Terms confidential',
          description: 'Existence may be disclosed.',
          clause:
            'The parties will keep the settlement terms confidential, subject to customary exceptions.',
        },
        {
          id: 'none',
          label: 'No confidentiality covenant',
          description: 'No settlement-specific confidentiality.',
          clause: 'The settlement does not impose a separate confidentiality covenant.',
        },
      ],
    },
    {
      id: 'admission',
      label: 'Admission',
      description: 'Whether the agreement contains an admission.',
      weight: 3,
      options: [
        {
          id: 'no-admission',
          label: 'No admission',
          description: 'Standard non-admission provision.',
          clause:
            'The settlement is a compromise of disputed claims and does not constitute an admission of liability or wrongdoing.',
        },
        {
          id: 'factual-statement',
          label: 'Agreed factual statement',
          description: 'Neutral agreed statement without liability admission.',
          clause:
            'The parties will issue the mutually approved factual statement attached to the final agreement, without an admission of liability.',
        },
        {
          id: 'acknowledgment',
          label: 'Limited acknowledgment',
          description: 'Narrow acknowledgment defined in final drafting.',
          clause:
            'The final agreement will include the mutually approved limited acknowledgment described in the negotiated term sheet.',
        },
      ],
    },
  ],
};

export const templates = [commercialContractTemplate, settlementTemplate] as const;

export function getTemplate(templateId: string): NegotiationTemplate | undefined {
  return templates.find((template) => template.id === templateId);
}
