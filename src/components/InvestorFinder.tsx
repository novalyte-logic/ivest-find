import { useState, useMemo, useEffect } from 'react';
import { initialInvestors, Investor } from '../data/investors';
import { InvestorCard } from './InvestorCard';
import { InvestorDetailModal } from './InvestorDetailModal';
import { NetworkGraph } from './NetworkGraph';
import { TopMatches } from './TopMatches';
import { SearchableDropdown } from './SearchableDropdown';
import { Search, Filter, Activity, SortAsc, SortDesc, ChevronDown, Network, BrainCircuit, Globe, Loader2, Plus, CheckCircle2, X } from 'lucide-react';
import { calculateMatchScore } from '../lib/matching';
import { fuzzyMatch, parseInvestmentRange } from '../lib/utils';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';

type SortOption = 'match' | 'rangeAsc' | 'rangeDesc' | 'expertiseMatch';

const NOVALYTE_EXPERTISE = ['Health Tech', 'AI', 'Diagnostics', 'AI/ML', 'Generative AI', 'Digital Health'];

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface InvestorFinderProps {
  onDraftOutreach: (investor: Investor) => void;
  onToggleInterested: (investor: Investor) => void;
  interestedIds: Set<string>;
}

export function InvestorFinder({ onDraftOutreach, onToggleInterested, interestedIds }: InvestorFinderProps) {
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('match');
  const [showFilters, setShowFilters] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [webSearchResults, setWebSearchResults] = useState<Investor[]>([]);
  const [showWebSearchModal, setShowWebSearchModal] = useState(false);
  const [webSearchQuery, setWebSearchQuery] = useState('');
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  // Filter States
  const [selectedFocus, setSelectedFocus] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedContactPref, setSelectedContactPref] = useState<string>('');
  const [thesisSearch, setThesisSearch] = useState<string>('');

  // Derived lists for filter dropdowns
  const allFocusAreas = useMemo(() => Array.from(new Set(investors.flatMap(i => i.focus))), [investors]);
  const allLocations = useMemo(() => Array.from(new Set(investors.map(i => i.location))), [investors]);
  const allStages = useMemo(() => Array.from(new Set(investors.map(i => i.stage))), [investors]);
  const allContactPrefs = useMemo(() => Array.from(new Set(investors.map(i => i.contactPreference))).filter(Boolean), [investors]);

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
        const scoreA = calculateMatchScore(a).score;
        const scoreB = calculateMatchScore(b).score;
        return scoreB - scoreA;
      } else if (sortOption === 'rangeAsc') {
        return parseInvestmentRange(a.investmentRange) - parseInvestmentRange(b.investmentRange);
      } else if (sortOption === 'rangeDesc') {
        return parseInvestmentRange(b.investmentRange) - parseInvestmentRange(a.investmentRange);
      } else if (sortOption === 'expertiseMatch') {
        const countA = a.industryExpertise.filter(exp => NOVALYTE_EXPERTISE.some(ne => exp.includes(ne) || ne.includes(exp))).length;
        const countB = b.industryExpertise.filter(exp => NOVALYTE_EXPERTISE.some(ne => exp.includes(ne) || ne.includes(exp))).length;
        return countB - countA;
      }
      return 0;
    });

    return result;
  }, [investors, searchTerm, sortOption, selectedFocus, selectedLocation, selectedStage]);

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

  const handleWebSearch = async () => {
    if (!webSearchQuery.trim()) return;
    setIsWebSearching(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find real angel investors or venture capitalists who invest in ${webSearchQuery}. 
        Focus on those interested in Health Tech, AI, and Diagnostics.
        Return a JSON array of investors with these fields: 
        name, role, firm, bio, focus (array), location, investmentRange, investmentThesis, stage (Pre-Seed, Seed, Series A, or Late Stage), linkedinUrl.
        Make the data as realistic as possible based on web information.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
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
                investmentThesis: { type: Type.STRING },
                stage: { type: Type.STRING },
                linkedinUrl: { type: Type.STRING }
              },
              required: ["name", "role", "bio", "focus", "location", "investmentRange", "investmentThesis", "stage"]
            }
          }
        }
      });

      const results = JSON.parse(response.text || "[]");
      const formattedResults = results.map((res: any, index: number) => ({
        ...res,
        id: `web-${Date.now()}-${index}`,
        imageUrl: `https://images.unsplash.com/photo-${1500000000000 + index}?auto=format&fit=crop&q=80&w=200&h=200`,
        industryExpertise: res.focus,
        contactPreference: 'Email',
        tags: ['Web Found']
      }));
      setWebSearchResults(formattedResults);
    } catch (error) {
      console.error("Web search error:", error);
    } finally {
      setIsWebSearching(false);
    }
  };

  const handleImportInvestor = (investor: Investor) => {
    setImportingIds(prev => new Set(prev).add(investor.id));
    setTimeout(() => {
      setInvestors(prev => [investor, ...prev]);
      setWebSearchResults(prev => prev.filter(i => i.id !== investor.id));
      setImportingIds(prev => {
        const next = new Set(prev);
        next.delete(investor.id);
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

      {/* Network Graph Widget */}
      {showGraph && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-4">
          <NetworkGraph investors={filteredInvestors} />
        </div>
      )}

      {/* Top Matches Widget */}
      {!searchTerm && !selectedFocus && !selectedLocation && !selectedStage && !selectedContactPref && !thesisSearch && (
        <TopMatches investors={investors} onSelect={setSelectedInvestor} />
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
              isInterested={interestedIds.has(investor.id)}
            />
          </div>
        ))}
      </div>

      {filteredInvestors.length === 0 && (
        <div className="text-center py-20">
          <p className="text-zinc-500">No investors found matching your search.</p>
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
        isInterested={selectedInvestor ? interestedIds.has(selectedInvestor.id) : false}
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
              className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[800px] md:h-[600px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-[70] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <Globe className="text-blue-500" size={24} />
                  <div>
                    <h3 className="text-xl font-bold text-white">Web Intelligence Search</h3>
                    <p className="text-xs text-zinc-500">Find real investors using Gemini & Google Search</p>
                  </div>
                </div>
                <button onClick={() => setShowWebSearchModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 border-b border-zinc-800 flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="text"
                    placeholder="e.g. 'Health tech angel investors in London'..."
                    value={webSearchQuery}
                    onChange={(e) => setWebSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <button 
                  onClick={handleWebSearch}
                  disabled={isWebSearching || !webSearchQuery.trim()}
                  className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {isWebSearching ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />}
                  Search
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
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
                    {webSearchResults.map((inv) => (
                      <div key={inv.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex items-start justify-between group">
                        <div className="flex gap-4">
                          <img src={inv.imageUrl} className="w-12 h-12 rounded-full object-cover" />
                          <div>
                            <h4 className="font-bold text-white">{inv.name}</h4>
                            <p className="text-xs text-blue-400 mb-1">{inv.role} {inv.firm ? `@ ${inv.firm}` : ''}</p>
                            <p className="text-xs text-zinc-400 line-clamp-2 max-w-md">{inv.bio}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {inv.focus.slice(0, 3).map(f => (
                                <span key={f} className="px-2 py-0.5 bg-zinc-800 text-[10px] text-zinc-500 rounded-full">{f}</span>
                              ))}
                            </div>
                          </div>
                        </div>
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
