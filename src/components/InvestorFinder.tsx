import { useState, useMemo, useEffect } from 'react';
import { initialInvestors, Investor, isLegacyMockInvestor } from '../data/investors';
import { InvestorCard } from './InvestorCard';
import { InvestorDetailModal } from './InvestorDetailModal';
import { NetworkGraph } from './NetworkGraph';
import { TopMatches } from './TopMatches';
import { SearchableDropdown } from './SearchableDropdown';
import { Search, Filter, Activity, SortAsc, SortDesc, ChevronDown, Network, BrainCircuit, Globe, Loader2, Plus, CheckCircle2, X } from 'lucide-react';
import { calculateMatchScore } from '../lib/matching';
import { fuzzyMatch, parseInvestmentRange } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  countVaultKeywordMatches,
  getVaultInvestorKeywords,
  getVaultInvestorSearchQueries,
  getVaultRecommendedInvestorTypes,
  loadVaultData,
  subscribeToVaultChanges,
  VaultData,
} from '../lib/vault';
import { InvestorAvatar } from './InvestorAvatar';
import { parseJsonResponse } from '../lib/http';
import {
  InvestorContactResponse,
  InvestorIntelProviderStatus,
  InvestorSearchResponse,
  loadProviderPreferences,
  pickContactProvider,
  pickSearchProvider,
  ProviderPreferences,
  saveProviderPreferences,
} from '../lib/investor-intel';
import { dedupeInvestors, getInvestorIdentityKey } from '../lib/investor-identity';

type SortOption = 'match' | 'rangeAsc' | 'rangeDesc' | 'expertiseMatch';
const INVESTOR_STORAGE_KEY = 'novalyte_live_investors';

interface InvestorFinderProps {
  onDraftOutreach: (investor: Investor) => void;
  onToggleInterested: (investor: Investor) => void;
  onImportInvestors: (investors: Investor[]) => number;
  interestedKeys: Set<string>;
}

export function InvestorFinder({
  onDraftOutreach,
  onToggleInterested,
  onImportInvestors,
  interestedKeys,
}: InvestorFinderProps) {
  const [investors, setInvestors] = useState<Investor[]>(() => {
    if (typeof window === 'undefined') {
      return initialInvestors;
    }

    try {
      const saved = window.localStorage.getItem(INVESTOR_STORAGE_KEY);
      if (!saved) {
        return initialInvestors;
      }

      const parsed = JSON.parse(saved) as Investor[];
      return dedupeInvestors(
        parsed.filter((investor) => !isLegacyMockInvestor(investor)),
      );
    } catch (error) {
      console.error('Failed to parse saved investors', error);
      return initialInvestors;
    }
  });
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [vaultData, setVaultData] = useState<VaultData>(() => loadVaultData());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('match');
  const [showFilters, setShowFilters] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [webSearchResults, setWebSearchResults] = useState<Investor[]>([]);
  const [showWebSearchModal, setShowWebSearchModal] = useState(false);
  const [webSearchQuery, setWebSearchQuery] = useState('');
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const [selectedWebResultIds, setSelectedWebResultIds] = useState<Set<string>>(new Set());
  const [contactLookupIds, setContactLookupIds] = useState<Set<string>>(new Set());
  const [providerStatus, setProviderStatus] = useState<InvestorIntelProviderStatus | null>(null);
  const [providerPreferences, setProviderPreferences] = useState<ProviderPreferences>(() => loadProviderPreferences());

  // Filter States
  const [selectedFocus, setSelectedFocus] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedContactPref, setSelectedContactPref] = useState<string>('');
  const [thesisSearch, setThesisSearch] = useState<string>('');

  useEffect(() => {
    setVaultData(loadVaultData());
    return subscribeToVaultChanges(setVaultData);
  }, []);

  useEffect(() => {
    const loadProviderStatus = async () => {
      try {
        const response = await fetch('/api/investor-intel/providers', {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        });
        const result = await parseJsonResponse<InvestorIntelProviderStatus>(response);
        setProviderStatus(result);

        const nextPreferences: ProviderPreferences = {
          searchProvider: pickSearchProvider(
            result.searchProviders,
            providerPreferences.searchProvider,
          ),
          contactProvider: pickContactProvider(
            result.contactProviders,
            providerPreferences.contactProvider,
          ),
        };

        setProviderPreferences(nextPreferences);
        saveProviderPreferences(nextPreferences);
      } catch (error) {
        console.error('Failed to load investor intel providers', error);
      }
    };

    void loadProviderStatus();
  }, []);

  useEffect(() => {
    saveProviderPreferences(providerPreferences);
  }, [providerPreferences]);

  useEffect(() => {
    setSelectedWebResultIds((current) => {
      const validIds = new Set(webSearchResults.map((investor) => investor.id));
      return new Set(Array.from(current).filter((id) => validIds.has(id)));
    });
  }, [webSearchResults]);

  useEffect(() => {
    const cleaned = dedupeInvestors(
      investors.filter((investor) => !isLegacyMockInvestor(investor)),
    );
    window.localStorage.setItem(INVESTOR_STORAGE_KEY, JSON.stringify(cleaned));

    if (cleaned.length !== investors.length) {
      setInvestors(cleaned);
    }
  }, [investors]);

  // Derived lists for filter dropdowns
  const allFocusAreas = useMemo(() => Array.from(new Set(investors.flatMap(i => i.focus))), [investors]);
  const allLocations = useMemo(() => Array.from(new Set(investors.map(i => i.location))), [investors]);
  const allStages = useMemo(() => Array.from(new Set(investors.map(i => i.stage))), [investors]);
  const allContactPrefs = useMemo(() => Array.from(new Set(investors.map(i => i.contactPreference))).filter(Boolean), [investors]);
  const companyKeywords = useMemo(() => getVaultInvestorKeywords(vaultData), [vaultData]);
  const suggestedInvestorTypes = useMemo(() => getVaultRecommendedInvestorTypes(vaultData), [vaultData]);
  const suggestedSearchQueries = useMemo(() => getVaultInvestorSearchQueries(vaultData), [vaultData]);
  const availableSearchProviders = useMemo(
    () => providerStatus?.searchProviders.filter((provider) => provider.implemented && provider.configured) || [],
    [providerStatus],
  );
  const availableContactProviders = useMemo(
    () => providerStatus?.contactProviders.filter((provider) => provider.implemented && provider.configured) || [],
    [providerStatus],
  );

  const filteredInvestors = useMemo(() => {
    let result = investors.filter(inv => {
      // Fuzzy Search across multiple fields
      const searchContent = [
        inv.name, 
        inv.firm, 
        inv.bio, 
        inv.investmentThesis,
        ...inv.focus
      ].join(' ');
      
      const matchesSearch = fuzzyMatch(searchContent, searchTerm);
      
      // Filters
      const matchesFocus = selectedFocus ? inv.focus.includes(selectedFocus) : true;
      const matchesLocation = selectedLocation ? inv.location === selectedLocation : true;
      const matchesStage = selectedStage ? inv.stage === selectedStage : true;
      const matchesContactPref = selectedContactPref ? inv.contactPreference === selectedContactPref : true;
      
      // Thesis Keyword Filter (Fuzzy)
      const matchesThesis = thesisSearch ? fuzzyMatch(inv.investmentThesis, thesisSearch) : true;

      return matchesSearch && matchesFocus && matchesLocation && matchesStage && matchesContactPref && matchesThesis;
    });

    // Sorting
    result = result.sort((a, b) => {
      if (sortOption === 'match') {
        const scoreA = calculateMatchScore(a, vaultData).score;
        const scoreB = calculateMatchScore(b, vaultData).score;
        return scoreB - scoreA;
      } else if (sortOption === 'rangeAsc') {
        return parseInvestmentRange(a.investmentRange) - parseInvestmentRange(b.investmentRange);
      } else if (sortOption === 'rangeDesc') {
        return parseInvestmentRange(b.investmentRange) - parseInvestmentRange(a.investmentRange);
      } else if (sortOption === 'expertiseMatch') {
        const countA = countVaultKeywordMatches(
          [...a.industryExpertise, ...a.focus, a.investmentThesis].join(' '),
          companyKeywords,
        );
        const countB = countVaultKeywordMatches(
          [...b.industryExpertise, ...b.focus, b.investmentThesis].join(' '),
          companyKeywords,
        );
        return countB - countA;
      }
      return 0;
    });

    return result;
  }, [
    companyKeywords,
    investors,
    searchTerm,
    selectedContactPref,
    selectedFocus,
    selectedLocation,
    selectedStage,
    sortOption,
    thesisSearch,
    vaultData,
  ]);

  const handleUpdateInvestor = (updatedInvestor: Investor) => {
    setInvestors(prev => prev.map(inv => inv.id === updatedInvestor.id ? updatedInvestor : inv));
    setSelectedInvestor(updatedInvestor); // Update the modal view as well
  };

  const handleAddTag = (investor: Investor, tag: string) => {
    if (!investor.tags.includes(tag)) {
      const updatedInvestor = { ...investor, tags: [...investor.tags, tag] };
      handleUpdateInvestor(updatedInvestor);
    }
  };

  const handleOpenSmartSearch = (query: string) => {
    setWebSearchQuery(query);
    setShowWebSearchModal(true);
    void handleWebSearch(query);
  };

  const handleWebSearch = async (queryOverride?: string) => {
    const finalQuery = queryOverride?.trim() || webSearchQuery.trim() || suggestedSearchQueries[0] || '';
    if (!finalQuery) return;

    setWebSearchQuery(finalQuery);
    setIsWebSearching(true);
    try {
      const response = await fetch('/api/investor-intel/search', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: finalQuery,
          searchProvider: providerPreferences.searchProvider,
          limit: 11,
          vaultData,
        }),
      });
      const result = await parseJsonResponse<InvestorSearchResponse>(response);
      setWebSearchResults(result.investors);
      setSelectedWebResultIds(new Set());
    } catch (error) {
      console.error("Web search error:", error);
      alert(error instanceof Error ? error.message : 'Failed to search investors.');
    } finally {
      setIsWebSearching(false);
    }
  };

  const handleVerifyContact = async (investor: Investor) => {
    if (providerPreferences.contactProvider === 'none') {
      alert('Choose a contact verification provider first.');
      return;
    }

    setContactLookupIds((prev) => new Set(prev).add(investor.id));
    try {
      const response = await fetch('/api/investor-intel/contact', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          investor,
          contactProvider: providerPreferences.contactProvider,
        }),
      });
      const result = await parseJsonResponse<InvestorContactResponse>(response);
      setWebSearchResults((prev) =>
        prev.map((item) => (item.id === investor.id ? result.investor : item)),
      );
    } catch (error) {
      console.error('Contact verification error:', error);
      alert(error instanceof Error ? error.message : 'Failed to verify contact.');
    } finally {
      setContactLookupIds((prev) => {
        const next = new Set(prev);
        next.delete(investor.id);
        return next;
      });
    }
  };

  const handleImportInvestor = (investor: Investor) => {
    setImportingIds(prev => new Set(prev).add(investor.id));
    setTimeout(() => {
      setInvestors(prev => dedupeInvestors([investor, ...prev]));
      onImportInvestors([investor]);
      setWebSearchResults(prev => prev.filter(i => i.id !== investor.id));
      setSelectedWebResultIds((current) => {
        const next = new Set(current);
        next.delete(investor.id);
        return next;
      });
      setImportingIds(prev => {
        const next = new Set(prev);
        next.delete(investor.id);
        return next;
      });
    }, 600);
  };

  const handleToggleWebResultSelection = (investorId: string) => {
    setSelectedWebResultIds((current) => {
      const next = new Set(current);
      if (next.has(investorId)) {
        next.delete(investorId);
      } else {
        next.add(investorId);
      }
      return next;
    });
  };

  const handleSelectAllWebResults = () => {
    setSelectedWebResultIds(new Set(webSearchResults.map((investor) => investor.id)));
  };

  const handleClearWebResultSelection = () => {
    setSelectedWebResultIds(new Set());
  };

  const handleImportSelectedInvestors = () => {
    const selectedInvestors = webSearchResults.filter((investor) =>
      selectedWebResultIds.has(investor.id),
    );

    if (selectedInvestors.length === 0) {
      return;
    }

    const selectedIdSet = new Set(selectedInvestors.map((investor) => investor.id));
    setImportingIds((current) => new Set([...current, ...selectedIdSet]));

    setTimeout(() => {
      setInvestors((current) => dedupeInvestors([...selectedInvestors, ...current]));
      onImportInvestors(selectedInvestors);
      setWebSearchResults((current) =>
        current.filter((investor) => !selectedIdSet.has(investor.id)),
      );
      setSelectedWebResultIds(new Set());
      setImportingIds((current) => {
        const next = new Set(current);
        selectedIdSet.forEach((id) => next.delete(id));
        return next;
      });
    }, 600);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">Find Investors</h2>
          <p className="text-sm md:text-base text-zinc-400">Discover and connect with the perfect angels for Novalyte AI.</p>
        </div>
        <div className="flex items-center gap-2">
           <button 
              onClick={() => setShowWebSearchModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs hover:bg-blue-500/20 transition-colors"
            >
              <Globe size={14} />
              Web Search
            </button>
           <button 
              onClick={() => setShowGraph(!showGraph)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors ${
                showGraph ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <Network size={14} />
              {showGraph ? 'Hide Graph' : 'Show Network'}
            </button>
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-blue-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_rgba(9,9,11,0.94)_60%)] p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              <BrainCircuit size={14} />
              AI Smart Assist
            </p>
            <h3 className="text-lg font-bold text-white">Investor targeting from the Novalyte Vault</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">
              {vaultData.investorFitSummary || 'Run Analyze Vault in the Novalyte Vault to generate tailored investor targeting guidance.'}
            </p>
          </div>
          <button
            onClick={() => setShowWebSearchModal(true)}
            className="shrink-0 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-500/20"
          >
            Open Search
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr,1fr]">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Suggested Investor Types
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedInvestorTypes.map((investorType) => (
                <span
                  key={investorType}
                  className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300"
                >
                  {investorType}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              One-Click Search Prompts
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedSearchQueries.map((query) => (
                <button
                  key={query}
                  onClick={() => handleOpenSmartSearch(query)}
                  className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-left text-xs font-medium text-zinc-300 transition-colors hover:border-blue-500/40 hover:text-white"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Network Graph Widget */}
      {showGraph && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-4">
          <NetworkGraph investors={filteredInvestors} />
        </div>
      )}

      {/* Top Matches Widget */}
      {!searchTerm && !selectedFocus && !selectedLocation && !selectedStage && !selectedContactPref && !thesisSearch && (
        <TopMatches investors={investors} onSelect={setSelectedInvestor} vaultData={vaultData} />
      )}

      {/* Controls Section */}
      <div className="mb-6 md:mb-8 space-y-4">
        <div className="flex flex-col gap-4">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input 
              type="text"
              placeholder="Search investors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm md:text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-600"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 md:flex-none px-4 py-2.5 border rounded-xl transition-colors flex items-center justify-center gap-2 text-sm ${
                showFilters 
                  ? 'bg-zinc-800 border-zinc-700 text-white' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
            >
              <Filter size={18} />
              <span>Filters</span>
              <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            <div className="flex-1 md:flex-none flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 overflow-x-auto">
              <button 
                onClick={() => setSortOption('match')}
                className={`flex-1 md:flex-none whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sortOption === 'match' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Match
              </button>
              <button 
                onClick={() => setSortOption(sortOption === 'rangeAsc' ? 'rangeDesc' : 'rangeAsc')}
                className={`flex-1 md:flex-none whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  sortOption.startsWith('range') ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Range</span>
                {sortOption === 'rangeAsc' && <SortAsc size={12} />}
                {sortOption === 'rangeDesc' && <SortDesc size={12} />}
              </button>
              <button 
                onClick={() => setSortOption('expertiseMatch')}
                className={`flex-1 md:flex-none whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  sortOption === 'expertiseMatch' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <BrainCircuit size={12} />
                <span>Expertise</span>
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4">
            <SearchableDropdown
              label="Stage"
              options={allStages}
              value={selectedStage}
              onChange={setSelectedStage}
              placeholder="All Stages"
            />
            <SearchableDropdown
              label="Industry Focus"
              options={allFocusAreas}
              value={selectedFocus}
              onChange={setSelectedFocus}
              placeholder="All Industries"
            />
            <SearchableDropdown
              label="Location"
              options={allLocations}
              value={selectedLocation}
              onChange={setSelectedLocation}
              placeholder="All Locations"
            />
            <SearchableDropdown
              label="Contact Preference"
              options={allContactPrefs}
              value={selectedContactPref}
              onChange={setSelectedContactPref}
              placeholder="All Preferences"
            />
            
            {/* Thesis Keyword Filter */}
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Thesis Keywords
              </label>
              <input 
                type="text"
                value={thesisSearch}
                onChange={(e) => setThesisSearch(e.target.value)}
                placeholder="e.g. 'scalable', 'clinical'..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-blue-500 placeholder:text-zinc-700"
              />
            </div>

            <div className="flex items-end md:col-span-4 justify-end">
              <button 
                onClick={() => {
                  setSelectedFocus('');
                  setSelectedLocation('');
                  setSelectedStage('');
                  setSelectedContactPref('');
                  setThesisSearch('');
                }}
                className="text-sm text-zinc-500 hover:text-white underline decoration-zinc-700 underline-offset-4"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInvestors.map((investor: Investor) => (
          <div key={investor.id}>
            <InvestorCard 
              investor={investor} 
              onSelect={setSelectedInvestor} 
              onAddTag={handleAddTag}
              onToggleInterested={onToggleInterested}
              isInterested={interestedKeys.has(getInvestorIdentityKey(investor))}
              vaultData={vaultData}
            />
          </div>
        ))}
      </div>

      {filteredInvestors.length === 0 && (
        <div className="text-center py-20">
          <p className="text-zinc-500">
            {investors.length === 0
              ? 'No live investors saved yet. Use Web Search to find and import real investors.'
              : 'No investors found matching your search.'}
          </p>
        </div>
      )}

      {/* Detail Modal */}
      <InvestorDetailModal
        investor={selectedInvestor}
        isOpen={!!selectedInvestor}
        onClose={() => setSelectedInvestor(null)}
        onSave={handleUpdateInvestor}
        onDraftOutreach={(inv) => {
          setSelectedInvestor(null);
          onDraftOutreach(inv);
        }}
        onToggleInterested={onToggleInterested}
        isInterested={
          selectedInvestor
            ? interestedKeys.has(getInvestorIdentityKey(selectedInvestor))
            : false
        }
      />

      {/* Web Search Modal */}
      <AnimatePresence>
        {showWebSearchModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWebSearchModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:h-[78vh] md:max-h-[860px] md:w-[920px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-[70] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <Globe className="text-blue-500" size={24} />
                  <div>
                    <h3 className="text-xl font-bold text-white">Web Intelligence Search</h3>
                    <p className="text-xs text-zinc-500">Find real investors with a chosen search provider, then verify contacts one by one.</p>
                  </div>
                </div>
                <button onClick={() => setShowWebSearchModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 border-b border-zinc-800 bg-zinc-950/60 px-6 py-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Search Provider
                  </span>
                  <select
                    value={providerPreferences.searchProvider}
                    onChange={(event) =>
                      setProviderPreferences((current) => ({
                        ...current,
                        searchProvider: event.target.value as ProviderPreferences['searchProvider'],
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {availableSearchProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Contact Verification
                  </span>
                  <select
                    value={providerPreferences.contactProvider}
                    onChange={(event) =>
                      setProviderPreferences((current) => ({
                        ...current,
                        contactProvider: event.target.value as ProviderPreferences['contactProvider'],
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {availableContactProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="p-6 border-b border-zinc-800 flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="text"
                    placeholder={suggestedSearchQueries[0] || "e.g. 'Health tech angel investors in London'..."}
                    value={webSearchQuery}
                    onChange={(e) => setWebSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <button 
                  onClick={handleWebSearch}
                  disabled={isWebSearching || (!webSearchQuery.trim() && suggestedSearchQueries.length === 0)}
                  className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {isWebSearching ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />}
                  Search
                </button>
              </div>

              {suggestedSearchQueries.length > 0 && (
                <div className="max-h-28 overflow-y-auto px-6 pb-4 flex flex-wrap gap-2">
                  {suggestedSearchQueries.slice(0, 6).map((query) => (
                    <button
                      key={query}
                      onClick={() => handleWebSearch(query)}
                      className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {isWebSearching ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <div>
                      <p className="text-white font-medium">Scouring the web for investors...</p>
                      <p className="text-sm text-zinc-500">Gemini is analyzing search results to find the best matches.</p>
                    </div>
                  </div>
                ) : webSearchResults.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {webSearchResults.length} investor{webSearchResults.length === 1 ? '' : 's'} found
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Select individual investors or import the full search batch into My Investors.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleSelectAllWebResults}
                          disabled={webSearchResults.length === 0}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-40"
                        >
                          Select All
                        </button>
                        <button
                          onClick={handleClearWebResultSelection}
                          disabled={selectedWebResultIds.size === 0}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-40"
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleImportSelectedInvestors}
                          disabled={selectedWebResultIds.size === 0}
                          className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-40"
                        >
                          Import Selected ({selectedWebResultIds.size})
                        </button>
                      </div>
                    </div>
                    {webSearchResults.map((inv) => (
                      <div
                        key={inv.id}
                        className={`p-4 rounded-xl flex items-start justify-between group transition-colors ${
                          selectedWebResultIds.has(inv.id)
                            ? 'bg-blue-500/10 border border-blue-500/30'
                            : 'bg-zinc-900 border border-zinc-800'
                        }`}
                      >
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => handleToggleWebResultSelection(inv.id)}
                            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                              selectedWebResultIds.has(inv.id)
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : 'border-zinc-700 bg-zinc-950 text-transparent hover:border-zinc-500'
                            }`}
                            aria-label={
                              selectedWebResultIds.has(inv.id)
                                ? `Unselect ${inv.name}`
                                : `Select ${inv.name}`
                            }
                          >
                            <CheckCircle2 size={12} />
                          </button>
                          <InvestorAvatar
                            imageUrl={inv.imageUrl}
                            name={inv.name}
                            className="h-12 w-12 object-cover"
                          />
                          <div>
                            <h4 className="font-bold text-white">{inv.name}</h4>
                            <p className="text-xs text-blue-400 mb-1">{inv.role} {inv.firm ? `@ ${inv.firm}` : ''}</p>
                            <p className="text-xs text-zinc-400 line-clamp-2 max-w-md">
                              {inv.latestSummary || inv.bio}
                            </p>
                            {inv.email ? (
                              <p className="mt-1 text-[11px] text-emerald-400">{inv.email}</p>
                            ) : null}
                            {inv.contactVerificationStatus ? (
                              <p className="mt-1 text-[11px] text-zinc-500">
                                {inv.contactVerificationProvider || 'contact'}: {inv.contactVerificationStatus}
                              </p>
                            ) : null}
                            {inv.latestNews && inv.latestNews.length > 0 ? (
                              <p className="mt-1 text-[11px] text-zinc-500">
                                News: {inv.latestNews[0]}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {inv.focus.slice(0, 3).map(f => (
                                <span key={f} className="px-2 py-0.5 bg-zinc-800 text-[10px] text-zinc-500 rounded-full">{f}</span>
                              ))}
                            </div>
                            {inv.sourceUrls && inv.sourceUrls.length > 0 ? (
                              <p className="mt-2 text-[11px] text-zinc-500">
                                {inv.sourceUrls.length} source{inv.sourceUrls.length === 1 ? '' : 's'} attached
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => handleImportInvestor(inv)}
                            disabled={importingIds.has(inv.id)}
                            className="px-3 py-1.5 bg-zinc-800 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-all flex items-center gap-2"
                          >
                            {importingIds.has(inv.id) ? (
                              <>
                                <CheckCircle2 size={14} className="text-green-400" />
                                Imported
                              </>
                            ) : (
                              <>
                                <Plus size={14} />
                                Import
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleVerifyContact(inv)}
                            disabled={
                              contactLookupIds.has(inv.id) ||
                              providerPreferences.contactProvider === 'none'
                            }
                            className="px-3 py-1.5 border border-zinc-700 bg-zinc-950 text-zinc-300 text-xs font-bold rounded-lg hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
                          >
                            {contactLookupIds.has(inv.id) ? 'Finding…' : 'Find Contact'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
                    <Globe size={48} className="mb-4 opacity-20" />
                    <p>Enter a query to find real investors on the web.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
