import { Investor } from '../data/investors';

export interface MatchResult {
  investorId: string;
  score: number;
  rationale: string[];
}

export function calculateMatchScore(investor: Investor): MatchResult {
  let score = 0;
  const rationale: string[] = [];

  // Keywords relevant to Novalyte AI (Health Tech, AI, Pre-seed)
  const keywords = {
    high: ['health tech', 'ai', 'diagnostics', 'medtech', 'clinical'],
    medium: ['digital health', 'biotech', 'ml', 'machine learning', 'generative ai'],
    low: ['saas', 'infrastructure', 'software']
  };

  // Check Focus Areas
  investor.focus.forEach(area => {
    const lowerArea = area.toLowerCase();
    if (keywords.high.some(k => lowerArea.includes(k))) {
      score += 15;
      rationale.push(`Matches high-priority focus: ${area}`);
    } else if (keywords.medium.some(k => lowerArea.includes(k))) {
      score += 10;
      rationale.push(`Matches focus area: ${area}`);
    } else if (keywords.low.some(k => lowerArea.includes(k))) {
      score += 5;
    }
  });

  // Check Bio & Thesis
  const textToScan = (investor.bio + ' ' + investor.investmentThesis).toLowerCase();
  
  if (textToScan.includes('pre-seed') || textToScan.includes('early-stage')) {
    score += 20;
    rationale.push('Invests in pre-seed/early-stage');
  }

  if (textToScan.includes('health') || textToScan.includes('medical') || textToScan.includes('patient')) {
    score += 10;
  }

  // Check Investment Range (Pre-seed typically < $500k)
  // Simple check based on string presence for now
  if (investor.investmentRange.includes('$25k') || investor.investmentRange.includes('$50k')) {
    score += 10;
    rationale.push('Investment range fits pre-seed');
  }

  // Cap score at 100
  score = Math.min(score, 100);

  return {
    investorId: investor.id,
    score,
    rationale: [...new Set(rationale)] // unique reasons
  };
}
