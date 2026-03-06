import { GoogleGenAI, Type } from '@google/genai';
import { Investor } from '../data/investors';
import { dedupeInvestors } from '../lib/investor-identity';
import {
  ContactProvider,
  InvestorContactResponse,
  InvestorIntelProviderStatus,
  InvestorSearchResponse,
  ProviderOption,
  SearchProvider,
  SearchResultSource,
} from '../lib/investor-intel';

interface SearchDocument {
  title: string;
  url: string;
  text: string;
}

interface OceanPersonResult {
  id?: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  seniority?: string;
  linkedinHandle?: string;
  linkedinUrl?: string;
  country?: string;
  city?: string;
  company?: {
    name?: string;
    domain?: string;
    website?: string;
    description?: string;
    linkedinHandle?: string;
  };
}

const MAX_SOURCE_RESULTS = 8;
const MAX_SOURCE_TEXT = 1800;

function getSearchModel() {
  return process.env.SEARCH_GEMINI_MODEL || 'gemini-2.5-flash';
}

function getResearchModel() {
  return process.env.INVESTOR_RESEARCH_MODEL || getSearchModel();
}

function getEnvAny(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getGoogleApiKey(): string {
  const apiKey = getEnvAny(
    'VERTEX_AI_API_KEY',
    'VITE_VERTEX_AI_API_KEY',
    'GOOGLE_API_KEY',
    'GEMINI_API_KEY',
    'VITE_GEMINI_API_KEY',
  );

  if (!apiKey) {
    throw new Error('No Google or Vertex AI API key is configured on the server.');
  }

  return apiKey;
}

let cachedGemini: GoogleGenAI | null = null;

function getServerGemini() {
  if (!cachedGemini) {
    cachedGemini = new GoogleGenAI({ apiKey: getGoogleApiKey() });
  }
  return cachedGemini;
}

function getSearchProviderOptions(): ProviderOption<SearchProvider>[] {
  return [
    {
      id: 'google-grounded',
      label: 'Vertex Grounded',
      description: 'Vertex/Gemini with Google Search grounding for live investor discovery.',
      configured: Boolean(
        getEnvAny(
          'VERTEX_AI_API_KEY',
          'VITE_VERTEX_AI_API_KEY',
          'GOOGLE_API_KEY',
          'GEMINI_API_KEY',
          'VITE_GEMINI_API_KEY',
        ),
      ),
      implemented: true,
    },
    {
      id: 'exa',
      label: 'Exa',
      description: 'Live web search with strong people and company discovery coverage.',
      configured: Boolean(getEnvAny('EXA_API_KEY', 'VITE_EXA_API_KEY')),
      implemented: true,
    },
    {
      id: 'firecrawl',
      label: 'Firecrawl',
      description: 'Web search with scraped page content for grounded synthesis.',
      configured: Boolean(getSafeEnv('FIRECRAWL_API_KEY')),
      implemented: true,
    },
    {
      id: 'explorium',
      label: 'Explorium',
      description: 'Prospect data search for investor and fund decision-maker discovery.',
      configured: Boolean(getEnvAny('EXPLORIUM_API_KEY', 'VITE_EXPLORIUM_API_KEY')),
      implemented: true,
    },
    {
      id: 'ocean',
      label: 'Ocean',
      description: 'Ocean people search for investor and lookalike discovery.',
      configured: Boolean(getSafeEnv('OCEAN_API_KEY')),
      implemented: true,
    },
  ];
}

function getContactProviderOptions(): ProviderOption<ContactProvider>[] {
  return [
    {
      id: 'none',
      label: 'None',
      description: 'Skip paid contact verification and use public data only.',
      configured: true,
      implemented: true,
    },
    {
      id: 'google-grounded',
      label: 'Vertex Grounded',
      description: 'Use Vertex/Gemini grounding to find explicit public investor contact data.',
      configured: Boolean(
        getEnvAny(
          'VERTEX_AI_API_KEY',
          'VITE_VERTEX_AI_API_KEY',
          'GOOGLE_API_KEY',
          'GEMINI_API_KEY',
          'VITE_GEMINI_API_KEY',
        ),
      ),
      implemented: true,
    },
    {
      id: 'exa',
      label: 'Exa',
      description: 'Use Exa web search to find explicit public investor contact data.',
      configured: Boolean(getEnvAny('EXA_API_KEY', 'VITE_EXA_API_KEY')),
      implemented: true,
    },
    {
      id: 'firecrawl',
      label: 'Firecrawl',
      description: 'Use Firecrawl search and scraped pages to find explicit public investor contact data.',
      configured: Boolean(getSafeEnv('FIRECRAWL_API_KEY')),
      implemented: true,
    },
    {
      id: 'apollo',
      label: 'Apollo',
      description: 'Match a person and return work email when Apollo account access allows it.',
      configured: Boolean(getSafeEnv('APOLLO_API_KEY')),
      implemented: true,
    },
    {
      id: 'ocean',
      label: 'Ocean',
      description: 'Reserved for Ocean contact lookup when the driver is enabled.',
      configured: Boolean(getSafeEnv('OCEAN_API_KEY')),
      implemented: false,
    },
    {
      id: 'explorium',
      label: 'Explorium',
      description: 'Use Explorium prospect data to find public identity and company routes.',
      configured: Boolean(getEnvAny('EXPLORIUM_API_KEY', 'VITE_EXPLORIUM_API_KEY')),
      implemented: true,
    },
  ];
}

export function getInvestorIntelProviderStatus(): InvestorIntelProviderStatus {
  return {
    searchProviders: getSearchProviderOptions(),
    contactProviders: getContactProviderOptions(),
  };
}

function getSafeEnv(key: string) {
  const value = process.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function requireConfiguredProvider<T extends string>(
  providers: ProviderOption<T>[],
  id: T,
): ProviderOption<T> {
  const provider = providers.find((item) => item.id === id);
  if (!provider) {
    throw new Error(`Unknown provider: ${id}`);
  }
  if (!provider.implemented) {
    throw new Error(`${provider.label} is not implemented yet in this build.`);
  }
  if (!provider.configured) {
    throw new Error(`${provider.label} is not configured on the server.`);
  }
  return provider;
}

function getConfiguredSearchFallbackProviders(primary: SearchProvider): SearchProvider[] {
  const preferredOrder: SearchProvider[] = [
    primary,
    'exa',
    'google-grounded',
    'firecrawl',
    'explorium',
    'ocean',
  ];
  const available = getSearchProviderOptions()
    .filter((provider) => provider.implemented && provider.configured)
    .map((provider) => provider.id);

  return preferredOrder.filter(
    (provider, index) =>
      provider !== primary &&
      available.includes(provider) &&
      preferredOrder.indexOf(provider) === index,
  );
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    throw new Error(
      raw || `Request to ${url} failed with status ${response.status}`,
    );
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`Expected JSON from ${url} but received ${contentType || 'unknown content type'}.`);
  }

  return JSON.parse(raw) as T;
}

function buildSearchDocumentsBlock(documents: SearchDocument[]): string {
  return documents
    .slice(0, MAX_SOURCE_RESULTS)
    .map((document, index) => {
      const snippet =
        document.text.length > MAX_SOURCE_TEXT
          ? `${document.text.slice(0, MAX_SOURCE_TEXT)}...`
          : document.text;

      return [
        `Source ${index + 1}`,
        `Title: ${document.title}`,
        `URL: ${document.url}`,
        `Text: ${snippet || 'No text extracted.'}`,
      ].join('\n');
    })
    .join('\n\n');
}

function normalizeInvestorRecord(
  record: Record<string, unknown>,
  provider: SearchProvider,
): Investor {
  const focus = uniqueStrings(record.focus);
  const latestNews = uniqueStrings(record.latestNews).slice(0, 4);
  const painPoints = uniqueStrings(record.painPoints).slice(0, 4);
  const financialGoals = uniqueStrings(record.financialGoals).slice(0, 4);
  const sourceUrls = uniqueStrings(record.sourceUrls).slice(0, 6);
  const notableInvestments = uniqueStrings(record.notableInvestments).slice(0, 6);
  const industryExpertise = uniqueStrings(record.industryExpertise).slice(0, 6);
  const email = optionalStringValue(record.email);

  return {
    id: `search-${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: stringValue(record.name) || 'Unknown Investor',
    role: stringValue(record.role) || 'Investor',
    firm: stringValue(record.firm) || undefined,
    bio: stringValue(record.bio) || stringValue(record.latestSummary) || 'No bio available.',
    focus: focus.length > 0 ? focus : ['Investor'],
    location: stringValue(record.location) || 'Unknown',
    investmentRange: stringValue(record.investmentRange) || 'Unknown',
    notableInvestments,
    investmentThesis:
      stringValue(record.investmentThesis) ||
      stringValue(record.latestSummary) ||
      'No investment thesis available.',
    industryExpertise:
      industryExpertise.length > 0 ? industryExpertise : focus,
    contactPreference: email ? 'Email' : 'Research First',
    tags: [`Search:${provider}`],
    stage: normalizeStage(stringValue(record.stage)),
    linkedinUrl: optionalStringValue(record.linkedinUrl) || undefined,
    email: email || undefined,
    companyDomain: optionalStringValue(record.companyDomain) || undefined,
    sourceUrls,
    latestSummary: stringValue(record.latestSummary) || undefined,
    latestNews,
    painPoints,
    financialGoals,
    contactVerificationProvider: email ? provider : undefined,
    contactVerificationStatus: email ? 'Publicly listed' : undefined,
    contactVerified: Boolean(email),
    lastEnrichedAt: new Date().toISOString(),
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalStringValue(value: unknown): string {
  const normalized = stringValue(value);
  if (!normalized) return '';

  const lowered = normalized.toLowerCase();
  if (
    lowered === 'null' ||
    lowered === 'undefined' ||
    lowered === 'none' ||
    lowered === 'n/a'
  ) {
    return '';
  }

  return normalized;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => optionalStringValue(item))
        .filter(Boolean),
    ),
  );
}

function mergeUniqueStrings(...valueSets: Array<string[] | undefined>): string[] {
  return Array.from(
    new Set(
      valueSets.flatMap((values) => (Array.isArray(values) ? values.filter(Boolean) : [])),
    ),
  );
}

function normalizeDomain(domain: string | undefined): string {
  if (!domain) return '';

  return domain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .trim();
}

function normalizeStage(value: string): Investor['stage'] {
  if (value === 'Late Stage') return value;
  if (value === 'Series A') return value;
  if (value === 'Seed') return value;
  return 'Pre-Seed';
}

function buildContactSearchQuery(investor: Investor): string {
  const normalizedDomain = normalizeDomain(investor.companyDomain);
  return [
    investor.name,
    investor.firm,
    normalizedDomain ? `site:${normalizedDomain}` : '',
    'email contact investor team partner',
  ]
    .filter(Boolean)
    .join(' ');
}

function mergeContactResult(
  investor: Investor,
  contactProvider: ContactProvider,
  patch: Partial<Investor>,
): Investor {
  const email = optionalStringValue(patch.email) || optionalStringValue(investor.email);
  const sourceUrls = mergeUniqueStrings(investor.sourceUrls, patch.sourceUrls);
  const linkedinUrl =
    optionalStringValue(patch.linkedinUrl) || optionalStringValue(investor.linkedinUrl);
  const normalizedDomain = normalizeDomain(
    optionalStringValue(patch.companyDomain) || optionalStringValue(investor.companyDomain),
  );
  const firm = optionalStringValue(patch.firm) || optionalStringValue(investor.firm);
  const role = optionalStringValue(patch.role) || investor.role;
  const nextContactPreference =
    patch.contactPreference ||
    (email
      ? 'Email'
      : sourceUrls.some((url) => url.toLowerCase().includes('linkedin.com'))
        ? 'LinkedIn'
        : sourceUrls.length > 0
          ? 'Website Form'
          : investor.contactPreference);

  return {
    ...investor,
    ...patch,
    linkedinUrl: linkedinUrl || undefined,
    firm: firm || undefined,
    role,
    email: email || undefined,
    sourceUrls,
    companyDomain: normalizedDomain || undefined,
    contactPreference: nextContactPreference,
    contactVerificationProvider: contactProvider,
    contactVerified: Boolean(email),
    lastEnrichedAt: new Date().toISOString(),
  };
}

async function searchWithExa(query: string, limit: number): Promise<SearchDocument[]> {
  requireConfiguredProvider(getSearchProviderOptions(), 'exa');
  const apiKey = getEnvAny('EXA_API_KEY', 'VITE_EXA_API_KEY');

  const response = await fetchJson<{ results?: Array<Record<string, unknown>> }>(
    'https://api.exa.ai/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        query,
        numResults: Math.max(limit, 4),
        contents: {
          text: {
            maxCharacters: 2000,
          },
          summary: {
            query: 'Summarize the investor or fund details, recent activity, and any public contact information on this page.',
          },
        },
      }),
    },
  );

  return (response.results || []).map((result) => ({
    title: stringValue(result.title) || stringValue(result.url) || 'Untitled result',
    url: stringValue(result.url),
    text:
      stringValue(result.text) ||
      stringValue(result.summary) ||
      stringValue(result.highlights),
  }));
}

function buildExploriumSearchPayload(query: string, limit: number) {
  const normalizedQuery = query.toLowerCase();
  const wantsUsOnly =
    normalizedQuery.includes(' us ') ||
    normalizedQuery.startsWith('us ') ||
    normalizedQuery.includes(' united states') ||
    normalizedQuery.includes('north america');

  const wantsUkOnly =
    normalizedQuery.includes(' uk ') ||
    normalizedQuery.includes(' united kingdom') ||
    normalizedQuery.includes(' london');

  const countryCodes = wantsUkOnly ? ['gb'] : wantsUsOnly ? ['us'] : ['us', 'ca', 'gb'];

  return {
    mode: 'full',
    size: Math.max(limit * 4, 12),
    page_size: Math.max(limit * 4, 12),
    page: 1,
    filters: {
      job_title: {
        values: [
          'partner',
          'principal',
          'investor',
          'managing partner',
          'general partner',
          'venture partner',
          'founding partner',
        ],
      },
      country_code: {
        values: countryCodes,
      },
    },
  };
}

async function searchWithExplorium(
  query: string,
  limit: number,
): Promise<SearchDocument[]> {
  requireConfiguredProvider(getSearchProviderOptions(), 'explorium');
  const apiKey = getEnvAny('EXPLORIUM_API_KEY', 'VITE_EXPLORIUM_API_KEY');

  const response = await fetchJson<{ data?: Array<Record<string, unknown>> }>(
    'https://api.explorium.ai/v1/prospects',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_key: apiKey,
      },
      body: JSON.stringify(buildExploriumSearchPayload(query, limit)),
    },
  );

  return (response.data || []).map((result) => {
    const fullName =
      stringValue(result.full_name) ||
      [stringValue(result.first_name), stringValue(result.last_name)]
        .filter(Boolean)
        .join(' ');
    const companyName = stringValue(result.company_name);
    const linkedinUrl =
      optionalStringValue(result.linkedin) ||
      optionalStringValue(
        Array.isArray(result.linkedin_url_array)
          ? (result.linkedin_url_array as unknown[]).find((value) => optionalStringValue(value))
          : '',
      );
    const experience = Array.isArray(result.experience)
      ? (result.experience as unknown[])
          .map((value) => optionalStringValue(value))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    const skills = Array.isArray(result.skills)
      ? (result.skills as unknown[])
          .map((value) => optionalStringValue(value))
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return {
      title: [fullName, companyName ? `at ${companyName}` : ''].filter(Boolean).join(' '),
      url:
        linkedinUrl ||
        optionalStringValue(result.company_website) ||
        '',
      text: [
        `Name: ${fullName}`,
        `Company: ${companyName || 'Unknown'}`,
        `Title: ${stringValue(result.job_title) || 'Unknown'}`,
        `Location: ${[stringValue(result.city), stringValue(result.region_name), stringValue(result.country_name)]
          .filter(Boolean)
          .join(', ') || 'Unknown'}`,
        `Experience: ${experience.join('; ') || 'Not available'}`,
        `Skills: ${skills.join(', ') || 'Not available'}`,
        `Company website: ${optionalStringValue(result.company_website) || 'Unknown'}`,
      ].join('\n'),
    } satisfies SearchDocument;
  });
}

async function searchWithFirecrawl(query: string, limit: number): Promise<SearchDocument[]> {
  requireConfiguredProvider(getSearchProviderOptions(), 'firecrawl');
  const apiKey = getSafeEnv('FIRECRAWL_API_KEY');

  const response = await fetchJson<{ data?: Array<Record<string, unknown>> }>(
    'https://api.firecrawl.dev/v1/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit: Math.max(limit, 4),
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    },
  );

  return (response.data || []).map((result) => ({
    title: stringValue(result.title) || stringValue(result.url) || 'Untitled result',
    url: stringValue(result.url),
    text:
      stringValue(result.markdown) ||
      stringValue(result.description) ||
      stringValue(result.content),
  }));
}

function inferOceanCountries(query: string): string[] {
  const normalized = query.toLowerCase();
  if (normalized.includes('uk') || normalized.includes('united kingdom') || normalized.includes('london')) {
    return ['United Kingdom'];
  }
  if (normalized.includes('europe') || normalized.includes('eu')) {
    return ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Switzerland'];
  }
  if (normalized.includes('mena') || normalized.includes('middle east')) {
    return ['United Arab Emirates', 'Saudi Arabia', 'Egypt'];
  }
  return ['United States', 'Canada'];
}

async function searchWithOcean(query: string, limit: number): Promise<SearchDocument[]> {
  requireConfiguredProvider(getSearchProviderOptions(), 'ocean');
  const apiKey = getSafeEnv('OCEAN_API_KEY');

  const response = await fetchJson<{ people?: OceanPersonResult[] }>(
    'https://api.ocean.io/v3/search/people',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': apiKey,
      },
      body: JSON.stringify({
        size: Math.max(limit * 4, 24),
        peoplePerCompany: 1,
        peopleFilters: {
          countries: inferOceanCountries(query),
          seniorities: ['Partner', 'Founder', 'Board Member', 'C-Level', 'VP'],
        },
      }),
    },
  );

  return (response.people || []).map((result) => {
    const fullName =
      optionalStringValue(result.fullName || result.name) ||
      [optionalStringValue(result.firstName), optionalStringValue(result.lastName)]
        .filter(Boolean)
        .join(' ');
    const currentExperience =
      Array.isArray((result as Record<string, unknown>).experiences)
        ? (((result as Record<string, unknown>).experiences as unknown[])[0] as Record<string, unknown> | undefined)
        : undefined;
    const companyName =
      optionalStringValue(result.company?.name) ||
      optionalStringValue(currentExperience?.domain);
    const companyDomain =
      optionalStringValue(result.company?.domain) ||
      normalizeDomain(
        optionalStringValue(result.company?.website) ||
        optionalStringValue((result as Record<string, unknown>).domain) ||
        optionalStringValue(currentExperience?.domain),
      );
    const linkedinUrl =
      optionalStringValue(result.linkedinUrl) ||
      (optionalStringValue(result.linkedinHandle)
        ? `https://www.linkedin.com/in/${optionalStringValue(result.linkedinHandle)}`
        : '');

    return {
      title: [fullName, companyName ? `at ${companyName}` : ''].filter(Boolean).join(' '),
      url: linkedinUrl || (companyDomain ? `https://${companyDomain}` : ''),
      text: [
        `Name: ${fullName || 'Unknown'}`,
        `Title: ${optionalStringValue(result.title) || optionalStringValue((result as Record<string, unknown>).jobTitle) || optionalStringValue(result.seniority) || 'Unknown'}`,
        `Company: ${companyName || 'Unknown'}`,
        `Location: ${optionalStringValue((result as Record<string, unknown>).location) || [optionalStringValue(result.city), optionalStringValue(result.country)].filter(Boolean).join(', ') || 'Unknown'}`,
        `Company domain: ${companyDomain || 'Unknown'}`,
        `Current job: ${optionalStringValue((result as Record<string, unknown>).currentJobDescription) || 'Not available'}`,
        `Company description: ${optionalStringValue(result.company?.description) || 'Not available'}`,
        `Search intent: ${query}`,
      ].join('\n'),
    };
  });
}

async function searchDocumentsWithProvider(
  query: string,
  provider: Exclude<SearchProvider, 'google-grounded'>,
  limit: number,
): Promise<SearchDocument[]> {
  if (provider === 'exa') {
    return searchWithExa(query, limit);
  }

  if (provider === 'explorium') {
    return searchWithExplorium(query, limit);
  }

  if (provider === 'ocean') {
    return searchWithOcean(query, limit);
  }

  return searchWithFirecrawl(query, limit);
}

async function synthesizeInvestorsFromDocuments(
  query: string,
  vaultContext: string,
  provider: SearchProvider,
  documents: SearchDocument[],
  limit: number,
): Promise<InvestorSearchResponse> {
  const ai = getServerGemini();
  const searchBlock = buildSearchDocumentsBlock(documents);

  const response = await ai.models.generateContent({
    model: getSearchModel(),
    contents: `You are extracting investor targets for Novalyte AI from live search documents.

Rules:
1. Use only the search documents below.
2. Do not invent investors, firms, emails, portfolio companies, or claims.
3. Prioritize investors that fit the Novalyte AI vault context.
4. Return only real people or named investment decision-makers.
5. Include sourceUrls only from the URLs explicitly listed in the search documents.
6. If email is not explicitly public in the search documents, return an empty string.

User search request:
${query}

Novalyte AI vault context:
${vaultContext}

Search documents:
${searchBlock}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            firm: { type: Type.STRING },
            bio: { type: Type.STRING },
            focus: { type: Type.ARRAY, items: { type: Type.STRING } },
            location: { type: Type.STRING },
            investmentRange: { type: Type.STRING },
            notableInvestments: { type: Type.ARRAY, items: { type: Type.STRING } },
            investmentThesis: { type: Type.STRING },
            industryExpertise: { type: Type.ARRAY, items: { type: Type.STRING } },
            stage: { type: Type.STRING },
            linkedinUrl: { type: Type.STRING },
            email: { type: Type.STRING },
            companyDomain: { type: Type.STRING },
            latestSummary: { type: Type.STRING },
            latestNews: { type: Type.ARRAY, items: { type: Type.STRING } },
            painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            financialGoals: { type: Type.ARRAY, items: { type: Type.STRING } },
            sourceUrls: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['name', 'role', 'bio', 'focus', 'location', 'investmentRange', 'investmentThesis', 'stage'],
        },
      },
    },
  });

  const parsed = JSON.parse(response.text || '[]') as Array<Record<string, unknown>>;
  const investors = parsed.slice(0, limit).map((record) => normalizeInvestorRecord(record, provider));
  const sources = documents
    .filter((document) => document.url)
    .map((document) => ({
      title: document.title,
      url: document.url,
      snippet: document.text.slice(0, 200),
    }));

  return {
    provider,
    investors,
    sources,
  };
}

async function searchWithGoogleGrounding(
  query: string,
  vaultContext: string,
  limit: number,
): Promise<InvestorSearchResponse> {
  requireConfiguredProvider(getSearchProviderOptions(), 'google-grounded');
  const ai = getServerGemini();

  const groundedResponse = await ai.models.generateContent({
    model: getSearchModel(),
    contents: `Find real angel investors or venture capitalists who are a strong fit for Novalyte AI.

User search request:
${query}

Novalyte AI vault context:
${vaultContext}

Instructions:
1. Prioritize investors whose thesis, portfolio, and recent public activity match the vault context.
2. Prefer named partners, principals, angel investors, or managing partners.
3. Do not invent investor details.
4. Only include email if it is explicitly public.
5. For each investor include sourceUrls from public sources used in grounding.
6. Summarize latest news, pain points, and financial goals only if they are supported by recent public information.
7. Return concise research notes in plain text. Organize them by investor and include the supporting source URLs inline.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  const groundingSources = extractGroundingSources(groundedResponse);
  const groundingSourceUrls = groundingSources.map((source) => source.url);

  const structuringResponse = await ai.models.generateContent({
    model: getSearchModel(),
    contents: `Convert these grounded investor research notes into structured JSON.

Rules:
1. Use only the grounded notes below.
2. Do not invent investors, firms, emails, or source URLs.
3. Only include email if it is explicitly public in the notes.
4. Return a JSON array only.

Grounded notes:
${groundedResponse.text || ''}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            firm: { type: Type.STRING },
            bio: { type: Type.STRING },
            focus: { type: Type.ARRAY, items: { type: Type.STRING } },
            location: { type: Type.STRING },
            investmentRange: { type: Type.STRING },
            notableInvestments: { type: Type.ARRAY, items: { type: Type.STRING } },
            investmentThesis: { type: Type.STRING },
            industryExpertise: { type: Type.ARRAY, items: { type: Type.STRING } },
            stage: { type: Type.STRING },
            linkedinUrl: { type: Type.STRING },
            email: { type: Type.STRING },
            companyDomain: { type: Type.STRING },
            latestSummary: { type: Type.STRING },
            latestNews: { type: Type.ARRAY, items: { type: Type.STRING } },
            painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            financialGoals: { type: Type.ARRAY, items: { type: Type.STRING } },
            sourceUrls: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['name', 'role', 'bio', 'focus', 'location', 'investmentRange', 'investmentThesis', 'stage'],
        },
      },
    },
  });

  const parsed = JSON.parse(structuringResponse.text || '[]') as Array<Record<string, unknown>>;
  const investors = parsed.slice(0, limit).map((record) =>
    normalizeInvestorRecord(
      {
        ...record,
        sourceUrls:
          uniqueStrings(record.sourceUrls).length > 0
            ? record.sourceUrls
            : groundingSourceUrls,
      },
      'google-grounded',
    ),
  );
  const sources = dedupeSources(
    [
      ...groundingSources,
      ...investors.flatMap((investor) =>
        (investor.sourceUrls || []).map((url) => ({
          title: url,
          url,
        })),
      ),
    ],
  );

  return {
    provider: 'google-grounded',
    investors,
    sources,
  };
}

function dedupeSources(sources: SearchResultSource[]): SearchResultSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url || seen.has(source.url)) {
      return false;
    }
    seen.add(source.url);
    return true;
  });
}

function extractGroundingSources(response: unknown): SearchResultSource[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const responseRecord = response as Record<string, unknown>;
  const candidates = Array.isArray(responseRecord.candidates)
    ? responseRecord.candidates
    : [];

  return dedupeSources(
    candidates.flatMap((candidate) => {
      const candidateRecord =
        candidate && typeof candidate === 'object'
          ? (candidate as Record<string, unknown>)
          : null;
      const metadata =
        candidateRecord?.groundingMetadata &&
        typeof candidateRecord.groundingMetadata === 'object'
          ? (candidateRecord.groundingMetadata as Record<string, unknown>)
          : null;
      const chunks = Array.isArray(metadata?.groundingChunks)
        ? metadata.groundingChunks
        : [];

      return chunks
        .map((chunk) => {
          const chunkRecord =
            chunk && typeof chunk === 'object'
              ? (chunk as Record<string, unknown>)
              : null;
          const web =
            chunkRecord?.web && typeof chunkRecord.web === 'object'
              ? (chunkRecord.web as Record<string, unknown>)
              : null;
          const url = optionalStringValue(web?.uri);
          if (!url) return null;

          return {
            title: optionalStringValue(web?.title) || url,
            url,
          } satisfies SearchResultSource;
        })
        .filter((source): source is SearchResultSource => Boolean(source));
    }),
  );
}

async function runInvestorSearch(input: {
  query: string;
  searchProvider: SearchProvider;
  vaultContext: string;
  limit?: number;
}): Promise<InvestorSearchResponse> {
  const limit = Math.max(1, Math.min(input.limit || 8, 12));

  if (input.searchProvider === 'google-grounded') {
    return searchWithGoogleGrounding(input.query, input.vaultContext, limit);
  }

  const documents =
    await searchDocumentsWithProvider(
      input.query,
      input.searchProvider,
      limit,
    );

  return synthesizeInvestorsFromDocuments(
    input.query,
    input.vaultContext,
    input.searchProvider,
    documents,
    limit,
  );
}

export async function searchInvestorsWithProvider(input: {
  query: string;
  searchProvider: SearchProvider;
  vaultContext: string;
  limit?: number;
}): Promise<InvestorSearchResponse> {
  const limit = Math.max(1, Math.min(input.limit || 8, 12));
  const primary = await runInvestorSearch({
    ...input,
    limit,
  });

  let investors = dedupeInvestors(primary.investors).slice(0, limit);
  let sources = dedupeSources(primary.sources);

  if (investors.length >= limit) {
    return {
      provider: primary.provider,
      investors,
      sources,
    };
  }

  for (const fallbackProvider of getConfiguredSearchFallbackProviders(input.searchProvider)) {
    const remaining = limit - investors.length;
    if (remaining <= 0) {
      break;
    }

    try {
      const fallback = await runInvestorSearch({
        ...input,
        searchProvider: fallbackProvider,
        limit: remaining,
      });

      investors = dedupeInvestors([...investors, ...fallback.investors]).slice(0, limit);
      sources = dedupeSources([...sources, ...fallback.sources]);
    } catch (error) {
      console.error(`Fallback investor search failed for provider ${fallbackProvider}:`, error);
    }
  }

  return {
    provider: primary.provider,
    investors,
    sources,
  };
}

export async function enrichInvestorResearch(input: {
  investor: Investor;
  searchProvider: SearchProvider;
}): Promise<InvestorContactResponse> {
  const searchQuery = [
    input.investor.name,
    input.investor.firm,
    'investor latest news portfolio thesis',
  ]
    .filter(Boolean)
    .join(' ');

  const vaultContext = `Target investor: ${input.investor.name}${input.investor.firm ? ` at ${input.investor.firm}` : ''}`;
  const searchResponse = await searchInvestorsWithProvider({
    query: searchQuery,
    searchProvider: input.searchProvider,
    vaultContext,
    limit: 1,
  });

  const matched = searchResponse.investors[0];
  if (!matched) {
    return {
      provider: 'none',
      investor: input.investor,
    };
  }

  return {
    provider: 'none',
    investor: {
      ...input.investor,
      bio: matched.bio || input.investor.bio,
      focus: matched.focus.length > 0 ? matched.focus : input.investor.focus,
      notableInvestments:
        matched.notableInvestments.length > 0
          ? matched.notableInvestments
          : input.investor.notableInvestments,
      investmentThesis: matched.investmentThesis || input.investor.investmentThesis,
      linkedinUrl: matched.linkedinUrl || input.investor.linkedinUrl,
      companyDomain: matched.companyDomain || input.investor.companyDomain,
      latestSummary: matched.latestSummary || input.investor.latestSummary,
      latestNews: matched.latestNews || input.investor.latestNews,
      painPoints: matched.painPoints || input.investor.painPoints,
      financialGoals: matched.financialGoals || input.investor.financialGoals,
      sourceUrls: matched.sourceUrls || input.investor.sourceUrls,
      lastEnrichedAt: new Date().toISOString(),
    },
  };
}

async function synthesizeContactFromDocuments(
  investor: Investor,
  provider: Extract<ContactProvider, SearchProvider>,
  documents: SearchDocument[],
): Promise<Investor> {
  const ai = getServerGemini();
  const searchBlock = buildSearchDocumentsBlock(documents);
  const normalizedDomain = normalizeDomain(investor.companyDomain);

  const response = await ai.models.generateContent({
    model: getResearchModel(),
    contents: `Find the best real public contact route for this investor.

Rules:
1. Use only the search documents below.
2. Do not guess or invent any email address.
3. Only return an email if it appears explicitly in the search documents.
4. If there is no explicit email, prefer a firm's team page, contact page, or the investor's LinkedIn URL.
5. Include sourceUrls only from the listed search documents.
6. Summarize the result in contactVerificationStatus.

Target investor:
- Name: ${investor.name}
- Firm: ${investor.firm || 'Unknown'}
- Domain: ${normalizedDomain || 'Unknown'}
- Existing LinkedIn: ${investor.linkedinUrl || 'Unknown'}

Search documents:
${searchBlock}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          email: { type: Type.STRING },
          linkedinUrl: { type: Type.STRING },
          firm: { type: Type.STRING },
          role: { type: Type.STRING },
          companyDomain: { type: Type.STRING },
          contactPreference: { type: Type.STRING },
          contactVerificationStatus: { type: Type.STRING },
          sourceUrls: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}') as Record<string, unknown>;
  return mergeContactResult(investor, provider, {
    email: stringValue(parsed.email) || undefined,
    linkedinUrl: stringValue(parsed.linkedinUrl) || investor.linkedinUrl,
    firm: stringValue(parsed.firm) || investor.firm,
    role: stringValue(parsed.role) || investor.role,
    companyDomain: stringValue(parsed.companyDomain) || investor.companyDomain,
    sourceUrls: uniqueStrings(parsed.sourceUrls).slice(0, 6),
    contactPreference: stringValue(parsed.contactPreference) || undefined,
    contactVerificationStatus:
      stringValue(parsed.contactVerificationStatus) ||
      'Public-web search completed. No explicit email found.',
  });
}

async function findContactWithSearchProvider(
  investor: Investor,
  provider: Exclude<SearchProvider, 'google-grounded'>,
): Promise<Investor> {
  requireConfiguredProvider(getContactProviderOptions(), provider);
  const documents = await searchDocumentsWithProvider(
    buildContactSearchQuery(investor),
    provider,
    6,
  );

  if (documents.length === 0) {
    return mergeContactResult(investor, provider, {
      contactVerificationStatus: 'No public search results found for contact lookup.',
    });
  }

  return synthesizeContactFromDocuments(investor, provider, documents);
}

async function findContactWithGoogleGrounding(investor: Investor): Promise<Investor> {
  requireConfiguredProvider(getContactProviderOptions(), 'google-grounded');
  const ai = getServerGemini();
  const normalizedDomain = normalizeDomain(investor.companyDomain);

  const groundedResponse = await ai.models.generateContent({
    model: getResearchModel(),
    contents: `Find the best real public contact route for this investor using Google Search grounding.

Rules:
1. Do not invent any email address.
2. Only report an email if it is explicitly public on a cited source.
3. If there is no public email, find the best public contact route such as a team page, firm contact page, or LinkedIn profile.
4. Include supporting source URLs inline in the notes.
5. Keep the notes concise and factual.

Target investor:
- Name: ${investor.name}
- Firm: ${investor.firm || 'Unknown'}
- Domain: ${normalizedDomain || 'Unknown'}
- Existing LinkedIn: ${investor.linkedinUrl || 'Unknown'}`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  const groundingSources = extractGroundingSources(groundedResponse);
  const groundingSourceUrls = groundingSources.map((source) => source.url);

  const structuringResponse = await ai.models.generateContent({
    model: getResearchModel(),
    contents: `Convert these grounded contact research notes into structured JSON.

Rules:
1. Use only the grounded notes below.
2. Do not guess or invent an email address.
3. Only include sourceUrls that appear in the notes.
4. If no explicit email is present, leave email empty and explain the best public contact route in contactVerificationStatus.
5. Return a JSON object only.

Grounded notes:
${groundedResponse.text || ''}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          email: { type: Type.STRING },
          linkedinUrl: { type: Type.STRING },
          firm: { type: Type.STRING },
          role: { type: Type.STRING },
          companyDomain: { type: Type.STRING },
          contactPreference: { type: Type.STRING },
          contactVerificationStatus: { type: Type.STRING },
          sourceUrls: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  const parsed = JSON.parse(structuringResponse.text || '{}') as Record<string, unknown>;
  return mergeContactResult(investor, 'google-grounded', {
    email: stringValue(parsed.email) || undefined,
    linkedinUrl: stringValue(parsed.linkedinUrl) || investor.linkedinUrl,
    firm: stringValue(parsed.firm) || investor.firm,
    role: stringValue(parsed.role) || investor.role,
    companyDomain: stringValue(parsed.companyDomain) || investor.companyDomain,
    sourceUrls: mergeUniqueStrings(
      uniqueStrings(parsed.sourceUrls).slice(0, 6),
      groundingSourceUrls,
    ).slice(0, 6),
    contactPreference: stringValue(parsed.contactPreference) || undefined,
    contactVerificationStatus:
      stringValue(parsed.contactVerificationStatus) ||
      'Google-grounded contact search completed. No explicit email found.',
  });
}

interface ApolloPersonResponse {
  error?: string;
  error_code?: string;
  person?: Record<string, unknown>;
}

async function findContactWithApollo(investor: Investor): Promise<Investor> {
  requireConfiguredProvider(getContactProviderOptions(), 'apollo');
  const apiKey = getSafeEnv('APOLLO_API_KEY');
  const normalizedDomain = normalizeDomain(investor.companyDomain);

  const [firstName, ...restName] = investor.name.split(' ');
  const lastName = restName.join(' ');
  const url = new URL('https://api.apollo.io/api/v1/people/match');

  if (investor.linkedinUrl) url.searchParams.set('linkedin_url', investor.linkedinUrl);
  if (investor.name) url.searchParams.set('name', investor.name);
  if (firstName) url.searchParams.set('first_name', firstName);
  if (lastName) url.searchParams.set('last_name', lastName);
  if (investor.firm) url.searchParams.set('organization_name', investor.firm);
  if (normalizedDomain) url.searchParams.set('domain', normalizedDomain);
  url.searchParams.set('reveal_personal_emails', 'false');
  url.searchParams.set('reveal_phone_number', 'false');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      'x-api-key': apiKey,
    },
  });
  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as ApolloPersonResponse) : {};

  if (!response.ok) {
    const message =
      stringValue(parsed.error) ||
      `Apollo request failed with status ${response.status}`;

    return mergeContactResult(investor, 'apollo', {
      contactVerificationStatus: message,
    });
  }

  const person = parsed.person || {};
  const matchedEmail =
    stringValue(person.email) ||
    stringValue(person.work_email) ||
    stringValue(person.email_address);
  const emailStatus =
    stringValue(person.email_status) ||
    stringValue(person.email_status_reason) ||
    (matchedEmail ? 'Matched by Apollo' : 'No verified email returned');

  return mergeContactResult(investor, 'apollo', {
    email: matchedEmail || undefined,
    linkedinUrl: stringValue(person.linkedin_url) || investor.linkedinUrl,
    role: stringValue(person.title) || investor.role,
    firm:
      stringValue(
        (person.organization as Record<string, unknown> | undefined)?.name,
      ) || investor.firm,
    companyDomain:
      stringValue(person.website_url) ||
      stringValue(
        (person.organization as Record<string, unknown> | undefined)?.website_url,
      ) ||
      investor.companyDomain,
    contactVerificationStatus: emailStatus,
  });
}

export async function verifyInvestorContact(input: {
  investor: Investor;
  contactProvider: ContactProvider;
}): Promise<InvestorContactResponse> {
  if (input.contactProvider === 'none') {
    return {
      provider: 'none',
      investor: {
        ...input.investor,
        bio: input.investor.bio,
        contactVerificationProvider: 'none',
        contactVerificationStatus: 'Skipped',
        lastEnrichedAt: new Date().toISOString(),
      },
    };
  }

  if (input.contactProvider === 'apollo') {
    return {
      provider: 'apollo',
      investor: await findContactWithApollo(input.investor),
    };
  }

  if (
    input.contactProvider === 'google-grounded' ||
    input.contactProvider === 'exa' ||
    input.contactProvider === 'firecrawl' ||
    input.contactProvider === 'explorium'
  ) {
    return {
      provider: input.contactProvider,
      investor:
        input.contactProvider === 'google-grounded'
          ? await findContactWithGoogleGrounding(input.investor)
          : await findContactWithSearchProvider(input.investor, input.contactProvider),
    };
  }

  requireConfiguredProvider(getContactProviderOptions(), input.contactProvider);
  throw new Error(`${input.contactProvider} is reserved but not implemented in this build.`);
}
