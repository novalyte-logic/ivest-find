export interface Email {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  folder: 'inbox' | 'drafts' | 'sent';
  read: boolean;
  investorId?: string;
  scheduledFor?: string;
}

const LEGACY_MOCK_EMAIL_MARKERS = [
  'me@novalyte.ai',
  'healthai.vc',
  'biotechangels.com',
  'angel.co',
  '99% accuracy metric',
];

export const initialEmails: Email[] = [];

export function isLegacyMockEmail(email: Email): boolean {
  const haystack = [
    email.to,
    email.from,
    email.subject,
    email.body,
  ]
    .join(' ')
    .toLowerCase();

  return LEGACY_MOCK_EMAIL_MARKERS.some((marker) =>
    haystack.includes(marker.toLowerCase()),
  );
}
