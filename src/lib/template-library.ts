export type TemplateOrigin = 'default' | 'custom';

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  origin: TemplateOrigin;
  createdAt: string;
  updatedAt: string;
}

export const TEMPLATE_LIBRARY_STORAGE_KEY = 'novalyte_template_library';

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'question-led-intro',
    name: 'Question-Led Intro',
    description: 'Reply-friendly cold intro with one clear question and a short ask.',
    subject: '[Brand Name] x [Firm Name]',
    body:
      'Hi [Investor Name],<br><br>I am reaching out from [Brand Name]. We are building infrastructure for modern clinics, and your work around [Specific Area] looked especially relevant.<br><br>We are raising now and I would like to send a short overview to see if this fits your thesis in [Industry].<br><br>Would you be open to a quick look?<br><br>Best,<br>[My Name]',
    origin: 'default',
    createdAt: '2026-03-06T00:00:00.000Z',
    updatedAt: '2026-03-06T00:00:00.000Z',
  },
  {
    id: 'thesis-match',
    name: 'Thesis Match',
    description: 'Positions Novalyte AI against the investor thesis before making the ask.',
    subject: 'Why [Brand Name] fits [Firm Name]',
    body:
      'Hi [Investor Name],<br><br>I have been reviewing [Firm Name] and your focus on [Specific Area]. [Brand Name] is building AI clinical infrastructure for modern clinics, and I believe the fit is strong because we sit at the intersection of [Industry], workflow automation, and clinic growth.<br><br>If useful, I can send a concise deck and a few key proof points for your review.<br><br>Would that be helpful?<br><br>Best,<br>[My Name]',
    origin: 'default',
    createdAt: '2026-03-06T00:00:00.000Z',
    updatedAt: '2026-03-06T00:00:00.000Z',
  },
  {
    id: 'proof-point-forward',
    name: 'Proof-Point Forward',
    description: 'Leads with credibility and leaves space for vault-specific traction points.',
    subject: '[Brand Name] for [Industry] clinics',
    body:
      'Hi [Investor Name],<br><br>I wanted to share [Brand Name] because we are building AI infrastructure for clinics that need better patient acquisition, triage, and operational intelligence.<br><br>The reason I thought of [Firm Name] is your focus on [Specific Area]. If aligned, I can send a short overview with the strongest proof points and what we are raising.<br><br>Open to that?<br><br>Best,<br>[My Name]',
    origin: 'default',
    createdAt: '2026-03-06T00:00:00.000Z',
    updatedAt: '2026-03-06T00:00:00.000Z',
  },
  {
    id: 'quick-follow-up',
    name: 'Quick Follow-Up',
    description: 'Short follow-up designed to make replying easy.',
    subject: 'Re: [Brand Name] x [Firm Name]',
    body:
      'Hi [Investor Name],<br><br>Following up in case my last note got buried. I still think [Brand Name] could fit your focus on [Specific Area].<br><br>If helpful, I can send a short overview and the key reasons I thought of [Firm Name].<br><br>Best,<br>[My Name]',
    origin: 'default',
    createdAt: '2026-03-06T00:00:00.000Z',
    updatedAt: '2026-03-06T00:00:00.000Z',
  },
];

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTemplate(
  value: unknown,
  originFallback: TemplateOrigin,
): EmailTemplate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = sanitizeText(record.name);
  const subject = sanitizeText(record.subject);
  const body = sanitizeText(record.body);

  if (!name || !subject || !body) {
    return null;
  }

  const now = new Date().toISOString();
  const origin = record.origin === 'custom' || record.origin === 'default'
    ? record.origin
    : originFallback;

  return {
    id: sanitizeText(record.id) || `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    description: sanitizeText(record.description),
    subject,
    body,
    origin,
    createdAt: sanitizeText(record.createdAt) || now,
    updatedAt: sanitizeText(record.updatedAt) || now,
  };
}

export function loadCustomTemplates(): EmailTemplate[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TEMPLATE_LIBRARY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeTemplate(item, 'custom'))
      .filter((template): template is EmailTemplate => Boolean(template))
      .filter((template) => template.origin === 'custom')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    console.error('Failed to load custom templates', error);
    return [];
  }
}

export function saveCustomTemplates(templates: EmailTemplate[]): EmailTemplate[] {
  const normalized = templates
    .map((template) => normalizeTemplate({ ...template, origin: 'custom' }, 'custom'))
    .filter((template): template is EmailTemplate => Boolean(template))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      TEMPLATE_LIBRARY_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  }

  return normalized;
}

export function getTemplateLibrary(customTemplates: EmailTemplate[]): EmailTemplate[] {
  return [...DEFAULT_EMAIL_TEMPLATES, ...customTemplates];
}

export function isCustomTemplate(template: EmailTemplate | null | undefined): boolean {
  return Boolean(template && template.origin === 'custom');
}
