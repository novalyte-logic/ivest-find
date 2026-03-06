export interface Email {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  date: string; // ISO string
  folder: 'inbox' | 'drafts' | 'sent';
  read: boolean;
  investorId?: string; // Link to an investor if applicable
  scheduledFor?: string; // ISO string for scheduled send
}

export const initialEmails: Email[] = [
  {
    id: '1',
    to: 'me@novalyte.ai',
    from: 'sarah.chen@healthai.vc',
    subject: 'Re: Novalyte AI - Pre-seed Round',
    body: "Hi there,\n\nThanks for reaching out. I'm intrigued by the 99% accuracy metric. Do you have a technical whitepaper you could share?\n\nBest,\nSarah",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    folder: 'inbox',
    read: false,
    investorId: '1'
  },
  {
    id: '2',
    to: 'david@biotechangels.com',
    from: 'me@novalyte.ai',
    subject: 'Novalyte AI x BioTech Angels',
    body: "Hi David,\n\nI noticed your focus on the intersection of biology and ML. Novalyte AI is...",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    folder: 'sent',
    read: true,
    investorId: '2'
  },
  {
    id: '3',
    to: 'elena@angel.co',
    from: 'me@novalyte.ai',
    subject: 'Draft: Intro to Novalyte',
    body: "Hi Elena,\n\nI saw your investment in HealthBridge and thought...",
    date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    folder: 'drafts',
    read: true,
    investorId: '3'
  }
];
