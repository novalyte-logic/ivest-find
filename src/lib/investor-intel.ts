import { Investor } from '../data/investors';

export type SearchProvider =
  | 'google-grounded'
  | 'exa'
  | 'firecrawl'
  | 'explorium'
  | 'ocean';
export type ContactProvider =
  | 'none'
  | 'google-grounded'
  | 'exa'
  | 'firecrawl'
  | 'apollo'
  | 'ocean'
  | 'explorium';

export interface ProviderOption<T extends string> {
  id: T;
  label: string;
  description: string;
  configured: boolean;
  implemented: boolean;
}

export interface InvestorIntelProviderStatus {
  searchProviders: ProviderOption<SearchProvider>[];
  contactProviders: ProviderOption<ContactProvider>[];
}

export interface SearchResultSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface InvestorSearchResponse {
  provider: SearchProvider;
  investors: Investor[];
  sources: SearchResultSource[];
}

export interface InvestorContactResponse {
  provider: ContactProvider;
  investor: Investor;
}

export interface InvestorSearchRequest {
  query: string;
  searchProvider: SearchProvider;
  limit?: number;
}

export interface InvestorContactRequest {
  investor: Investor;
  contactProvider: ContactProvider;
}

export interface ProviderPreferences {
  searchProvider: SearchProvider;
  contactProvider: ContactProvider;
}

export const DEFAULT_PROVIDER_PREFERENCES: ProviderPreferences = {
  searchProvider: 'google-grounded',
  contactProvider: 'none',
};

export const PROVIDER_PREFERENCES_STORAGE_KEY = 'novalyte_provider_preferences';

export function loadProviderPreferences(): ProviderPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PROVIDER_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(PROVIDER_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PROVIDER_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<ProviderPreferences>;
    return {
      searchProvider: isSearchProvider(parsed.searchProvider)
        ? parsed.searchProvider
        : DEFAULT_PROVIDER_PREFERENCES.searchProvider,
      contactProvider: isContactProvider(parsed.contactProvider)
        ? parsed.contactProvider
        : DEFAULT_PROVIDER_PREFERENCES.contactProvider,
    };
  } catch (error) {
    console.error('Failed to load provider preferences', error);
    return DEFAULT_PROVIDER_PREFERENCES;
  }
}

export function saveProviderPreferences(preferences: ProviderPreferences) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    PROVIDER_PREFERENCES_STORAGE_KEY,
    JSON.stringify(preferences),
  );
}

export function isSearchProvider(value: unknown): value is SearchProvider {
  return (
    value === 'google-grounded' ||
    value === 'exa' ||
    value === 'firecrawl' ||
    value === 'explorium' ||
    value === 'ocean'
  );
}

export function isContactProvider(value: unknown): value is ContactProvider {
  return (
    value === 'none' ||
    value === 'google-grounded' ||
    value === 'exa' ||
    value === 'firecrawl' ||
    value === 'apollo' ||
    value === 'ocean' ||
    value === 'explorium'
  );
}

export function pickSearchProvider(
  providers: ProviderOption<SearchProvider>[],
  current?: SearchProvider,
): SearchProvider {
  const fallback =
    providers.find((provider) => provider.implemented && provider.configured)?.id ||
    DEFAULT_PROVIDER_PREFERENCES.searchProvider;

  if (!current) {
    return fallback;
  }

  return providers.some(
    (provider) =>
      provider.id === current && provider.implemented && provider.configured,
  )
    ? current
    : fallback;
}

export function pickContactProvider(
  providers: ProviderOption<ContactProvider>[],
  current?: ContactProvider,
): ContactProvider {
  const fallback =
    providers.find(
      (provider) =>
        provider.id !== 'none' && provider.implemented && provider.configured,
    )?.id ||
    providers.find((provider) => provider.id === 'none' && provider.implemented && provider.configured)?.id ||
    DEFAULT_PROVIDER_PREFERENCES.contactProvider;

  if (!current) {
    return fallback;
  }

  return providers.some(
    (provider) =>
      provider.id === current && provider.implemented && provider.configured,
  )
    ? current
    : fallback;
}
