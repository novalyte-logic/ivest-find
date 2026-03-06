export const VAULT_STORAGE_KEY = 'novalyte_vault';

const VAULT_UPDATED_EVENT = 'novalyte-vault-updated';
const DEFAULT_MATCH_KEYWORDS = [
  'health tech',
  'digital health',
  'mens health',
  'ai',
  'clinical',
  'diagnostics',
  'medtech',
  'clinic operations',
  'patient care',
  'healthcare marketplace',
];

export type VaultDocumentSource = 'note' | 'paste' | 'upload' | 'research';

export interface VaultDocument {
  id: string;
  title: string;
  content: string;
  source: VaultDocumentSource;
  createdAt: string;
  updatedAt: string;
}

export interface VaultData {
  overview: string;
  traction: string;
  ask: string;
  updates: string;
  usps: string;
  calendlyLink: string;
  documents: VaultDocument[];
  knowledgeSummary: string;
  investorFitSummary: string;
  emailGuidance: string;
  investorKeywords: string[];
  recommendedInvestorTypes: string[];
  investorSearchQueries: string[];
  proofPoints: string[];
  lastSavedAt: string | null;
  lastAnalyzedAt: string | null;
  version: number;
}

export interface VaultContextOptions {
  documentLimit?: number;
  charsPerDocument?: number;
}

const EMPTY_VAULT_DATA: VaultData = {
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
};

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function sanitizeDocument(value: unknown): VaultDocument | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const content = sanitizeText(record.content).trim();
  if (!content) return null;

  const now = new Date().toISOString();
  return {
    id: sanitizeText(record.id) || `vault-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: sanitizeText(record.title) || 'Untitled document',
    content,
    source: isVaultDocumentSource(record.source) ? record.source : 'note',
    createdAt: sanitizeText(record.createdAt) || now,
    updatedAt: sanitizeText(record.updatedAt) || now,
  };
}

function normalizeVaultData(value: unknown): VaultData {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_VAULT_DATA };
  }

  const record = value as Record<string, unknown>;
  const documents = Array.isArray(record.documents)
    ? record.documents
        .map((item) => sanitizeDocument(item))
        .filter((item): item is VaultDocument => Boolean(item))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : [];

  return {
    overview: sanitizeText(record.overview),
    traction: sanitizeText(record.traction),
    ask: sanitizeText(record.ask),
    updates: sanitizeText(record.updates),
    usps: sanitizeText(record.usps),
    calendlyLink: sanitizeText(record.calendlyLink),
    documents,
    knowledgeSummary: sanitizeText(record.knowledgeSummary),
    investorFitSummary: sanitizeText(record.investorFitSummary),
    emailGuidance: sanitizeText(record.emailGuidance),
    investorKeywords: sanitizeStringArray(record.investorKeywords),
    recommendedInvestorTypes: sanitizeStringArray(record.recommendedInvestorTypes),
    investorSearchQueries: sanitizeStringArray(record.investorSearchQueries),
    proofPoints: sanitizeStringArray(record.proofPoints),
    lastSavedAt: sanitizeText(record.lastSavedAt) || null,
    lastAnalyzedAt: sanitizeText(record.lastAnalyzedAt) || null,
    version: typeof record.version === 'number' ? record.version : EMPTY_VAULT_DATA.version,
  };
}

function dispatchVaultUpdate() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(VAULT_UPDATED_EVENT));
}

function isVaultDocumentSource(value: unknown): value is VaultDocumentSource {
  return value === 'note' || value === 'paste' || value === 'upload' || value === 'research';
}

function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().replace(/[^a-z0-9+\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function loadVaultData(): VaultData {
  if (typeof window === 'undefined') {
    return { ...EMPTY_VAULT_DATA };
  }

  try {
    const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) {
      return { ...EMPTY_VAULT_DATA };
    }

    return normalizeVaultData(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to load vault data', error);
    return { ...EMPTY_VAULT_DATA };
  }
}

export function saveVaultData(nextData: VaultData): VaultData {
  const normalized = normalizeVaultData(nextData);
  const savedData: VaultData = {
    ...normalized,
    lastSavedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(savedData));
    dispatchVaultUpdate();
  }

  return savedData;
}

export function subscribeToVaultChanges(listener: (data: VaultData) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => listener(loadVaultData());
  const handleStorage = (event: StorageEvent) => {
    if (event.key === VAULT_STORAGE_KEY) {
      handleChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(VAULT_UPDATED_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(VAULT_UPDATED_EVENT, handleChange);
  };
}

export function getVaultInvestorKeywords(vaultData: VaultData): string[] {
  const explicitKeywords = vaultData.investorKeywords
    .map(normalizeKeyword)
    .filter(Boolean);

  if (explicitKeywords.length > 0) {
    return Array.from(new Set(explicitKeywords)).slice(0, 12);
  }

  const sourceText = [
    vaultData.overview,
    vaultData.traction,
    vaultData.ask,
    vaultData.usps,
    vaultData.updates,
    vaultData.knowledgeSummary,
    vaultData.investorFitSummary,
    ...vaultData.proofPoints,
    ...vaultData.documents.map((document) => document.title),
  ]
    .join(' ')
    .toLowerCase();

  const derivedKeywords = DEFAULT_MATCH_KEYWORDS.filter((keyword) => {
    const normalizedKeyword = normalizeKeyword(keyword);
    return normalizedKeyword && sourceText.includes(normalizedKeyword);
  });

  return Array.from(new Set([...derivedKeywords, ...DEFAULT_MATCH_KEYWORDS])).slice(0, 12);
}

export function getVaultPreferredStages(vaultData: VaultData): string[] {
  const stageSource = [
    vaultData.ask,
    vaultData.knowledgeSummary,
    vaultData.investorFitSummary,
  ]
    .join(' ')
    .toLowerCase();

  const stages: string[] = [];
  if (stageSource.includes('pre-seed')) stages.push('Pre-Seed');
  if (stageSource.includes('seed')) stages.push('Seed');
  if (stageSource.includes('series a')) stages.push('Series A');
  if (stageSource.includes('late stage')) stages.push('Late Stage');

  if (stages.length === 0) {
    return ['Pre-Seed', 'Seed'];
  }

  return Array.from(new Set(stages));
}

export function getVaultRecommendedInvestorTypes(vaultData: VaultData): string[] {
  if (vaultData.recommendedInvestorTypes.length > 0) {
    return Array.from(new Set(vaultData.recommendedInvestorTypes)).slice(0, 8);
  }

  const keywords = getVaultInvestorKeywords(vaultData);
  const stages = getVaultPreferredStages(vaultData).join(', ');
  const defaults = [
    `${stages} digital health investors`,
    `${stages} healthcare AI infrastructure investors`,
    `${stages} clinic operations software investors`,
    `${stages} men's health investors`,
  ];

  return Array.from(
    new Set([
      ...defaults,
      ...keywords.slice(0, 4).map((keyword) => `${stages} ${keyword} investors`),
    ]),
  ).slice(0, 8);
}

export function getVaultInvestorSearchQueries(vaultData: VaultData): string[] {
  if (vaultData.investorSearchQueries.length > 0) {
    return Array.from(new Set(vaultData.investorSearchQueries)).slice(0, 8);
  }

  const stages = getVaultPreferredStages(vaultData).join(' ');
  const keywords = getVaultInvestorKeywords(vaultData);
  const derivedQueries = [
    `${stages} digital health investors`,
    `${stages} healthcare AI investors`,
    `${stages} clinic infrastructure investors`,
    `${stages} men's health investors`,
    ...keywords.slice(0, 4).map((keyword) => `${stages} ${keyword} investors`),
  ];

  return Array.from(new Set(derivedQueries.map((query) => query.trim()).filter(Boolean))).slice(0, 8);
}

export function countVaultKeywordMatches(text: string, keywords: string[]): number {
  const normalizedText = normalizeKeyword(text);
  if (!normalizedText) return 0;

  return keywords.reduce((count, keyword) => {
    const normalizedKeyword = normalizeKeyword(keyword);
    if (!normalizedKeyword) return count;
    return normalizedText.includes(normalizedKeyword) ? count + 1 : count;
  }, 0);
}

export function buildVaultPromptContext(
  vaultData: VaultData,
  options: VaultContextOptions = {},
): string {
  const documentLimit = options.documentLimit ?? 4;
  const charsPerDocument = options.charsPerDocument ?? 1200;

  const documents = vaultData.documents
    .slice(0, documentLimit)
    .map((document, index) => {
      const snippet =
        document.content.length > charsPerDocument
          ? `${document.content.slice(0, charsPerDocument)}...`
          : document.content;

      return [
        `Document ${index + 1}: ${document.title}`,
        `Source: ${document.source}`,
        snippet,
      ].join('\n');
    });

  const sections = [
    `Overview: ${vaultData.overview || 'Not provided.'}`,
    `Traction: ${vaultData.traction || 'Not provided.'}`,
    `Ask: ${vaultData.ask || 'Not provided.'}`,
    `USPs: ${vaultData.usps || 'Not provided.'}`,
    `Updates: ${vaultData.updates || 'Not provided.'}`,
    `Knowledge Summary: ${vaultData.knowledgeSummary || 'Not analyzed yet.'}`,
    `Ideal Investor Fit: ${vaultData.investorFitSummary || 'Not analyzed yet.'}`,
    `Email Guidance: ${vaultData.emailGuidance || 'Not analyzed yet.'}`,
    `Proof Points: ${vaultData.proofPoints.length > 0 ? vaultData.proofPoints.join('; ') : 'None saved.'}`,
    `Investor Keywords: ${getVaultInvestorKeywords(vaultData).join(', ') || 'None saved.'}`,
    `Recommended Investor Types: ${getVaultRecommendedInvestorTypes(vaultData).join('; ') || 'None saved.'}`,
    `Investor Search Queries: ${getVaultInvestorSearchQueries(vaultData).join('; ') || 'None saved.'}`,
  ];

  if (documents.length > 0) {
    sections.push(`Source Documents:\n${documents.join('\n\n')}`);
  }

  return sections.join('\n\n');
}
