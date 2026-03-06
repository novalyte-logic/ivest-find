import { Investor } from '../data/investors';
import { fuzzyMatch } from './utils';
import { VaultData, countVaultKeywordMatches, getVaultInvestorKeywords, getVaultPreferredStages } from './vault';

export interface MatchResult {
  investorId: string;
  score: number;
  rationale: string[];
}

function getMatchedKeywords(text: string, keywords: string[]): string[] {
  const lowerText = text.toLowerCase();
  return keywords
    .filter((keyword) => lowerText.includes(keyword.toLowerCase()))
    .slice(0, 3);
}

export function calculateMatchScore(investor: Investor, vaultData?: VaultData): MatchResult {
  let score = 0;
  const rationale: string[] = [];

  const keywords = getVaultInvestorKeywords(
    vaultData || {
      overview: '',
      traction: '',
      ask: '',
      updates: '',
      usps: '',
      calendlyLink: '',
      documents: [],
      knowledgeSummary: '',
      investorFitSummary: '',
      emailGuidance: '',
      investorKeywords: [],
      recommendedInvestorTypes: [],
      investorSearchQueries: [],
      proofPoints: [],
      lastSavedAt: null,
      lastAnalyzedAt: null,
      version: 3,
    },
  );
  const preferredStages = vaultData ? getVaultPreferredStages(vaultData) : ['Pre-Seed', 'Seed'];

  const focusAndExpertise = [...investor.focus, ...investor.industryExpertise].join(' ');
  const focusMatches = countVaultKeywordMatches(focusAndExpertise, keywords);
  if (focusMatches > 0) {
    score += Math.min(30, focusMatches * 8);
    const matchedKeywords = getMatchedKeywords(focusAndExpertise, keywords);
    if (matchedKeywords.length > 0) {
      rationale.push(`Matches company themes: ${matchedKeywords.join(', ')}`);
    }
  }

  const thesisText = `${investor.bio} ${investor.investmentThesis} ${investor.notableInvestments.join(' ')}`;
  const thesisMatches = countVaultKeywordMatches(thesisText, keywords);
  if (thesisMatches > 0) {
    score += Math.min(24, thesisMatches * 5);
  }

  const lowerThesisText = thesisText.toLowerCase();
  if (lowerThesisText.includes('pre-seed') || lowerThesisText.includes('early-stage')) {
    score += 18;
    rationale.push('Invests in early-stage companies');
  }

  if (preferredStages.includes(investor.stage)) {
    score += 14;
    rationale.push(`Fits target stage: ${investor.stage}`);
  }

  if (
    lowerThesisText.includes('health') ||
    lowerThesisText.includes('medical') ||
    lowerThesisText.includes('clinic') ||
    lowerThesisText.includes('patient')
  ) {
    score += 10;
  }

  if (investor.investmentRange.includes('$25k') || investor.investmentRange.includes('$50k')) {
    score += 8;
    rationale.push('Investment range fits earlier rounds');
  }

  const notableMatches = investor.notableInvestments.filter((investment) =>
    keywords.some((keyword) => fuzzyMatch(investment, keyword)),
  );
  if (notableMatches.length > 0) {
    score += 14;
    rationale.push(`Relevant portfolio exposure: ${notableMatches.slice(0, 2).join(', ')}`);
  }

  if (investor.tags && investor.tags.length > 0) {
    if (investor.tags.some((tag) => tag.toLowerCase().includes('warm intro'))) {
      score += 20;
      rationale.push('Warm intro available');
    }
    if (investor.tags.some((tag) => tag.toLowerCase().includes('met'))) {
      score += 15;
      rationale.push('Previously met');
    }
  }

  score = Math.min(score, 100);

  return {
    investorId: investor.id,
    score,
    rationale: [...new Set(rationale)],
  };
}
