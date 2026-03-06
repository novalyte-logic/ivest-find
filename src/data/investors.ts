export interface Investor {
  id: string;
  name: string;
  role: string;
  firm?: string;
  bio: string;
  focus: string[];
  location: string;
  investmentRange: string;
  notableInvestments: string[];
  imageUrl?: string;
  investmentThesis: string;
  industryExpertise: string[];
  contactPreference: string;
  tags: string[];
  stage: 'Pre-Seed' | 'Seed' | 'Series A' | 'Late Stage';
  linkedinUrl?: string;
  email?: string;
  companyDomain?: string;
  sourceUrls?: string[];
  latestSummary?: string;
  latestNews?: string[];
  painPoints?: string[];
  financialGoals?: string[];
  contactVerificationProvider?: string;
  contactVerificationStatus?: string;
  contactVerified?: boolean;
  lastEnrichedAt?: string;
}

const LEGACY_MOCK_INVESTOR_NAMES = new Set([
  'Sarah Chen',
  'David Miller',
  'Elena Rodriguez',
  'Michael Chang',
  'Dr. James Wilson',
]);

export const initialInvestors: Investor[] = [];

export function isLegacyMockInvestor(investor: Investor): boolean {
  const linkedinUrl = investor.linkedinUrl || '';
  const imageUrl = investor.imageUrl || '';
  const email = investor.email || '';

  return (
    LEGACY_MOCK_INVESTOR_NAMES.has(investor.name) ||
    linkedinUrl.includes('-example') ||
    imageUrl.includes('images.unsplash.com') ||
    email.includes('example.com')
  );
}
