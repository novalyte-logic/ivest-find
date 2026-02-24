import { useState, useMemo } from 'react';
import { initialInvestors, Investor } from '../data/investors';
import { InvestorCard } from './InvestorCard';
import { InvestorDetailModal } from './InvestorDetailModal';
import { NetworkGraph } from './NetworkGraph';
import { Search, Filter, Activity, SortAsc, SortDesc, ChevronDown, Network, BrainCircuit } from 'lucide-react';
import { calculateMatchScore } from '../lib/matching';
import { fuzzyMatch, parseInvestmentRange } from '../lib/utils';

type SortOption = 'match' | 'rangeAsc' | 'rangeDesc' | 'expertiseMatch';

const NOVALYTE_EXPERTISE = ['Health Tech', 'AI', 'Diagnostics', 'AI/ML', 'Generative AI', 'Digital Health'];

interface InvestorFinderProps {
  onDraftOutreach: (investor: Investor) => void;
}

export function InvestorFinder({ onDraftOutreach }: InvestorFinderProps) {
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('match');
  const [showFilters, setShowFilters] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  // Filter States
  const [selectedFocus, setSelectedFocus] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');

  // Derived lists for filter dropdowns
  const allFocusAreas = useMemo(() => Array.from(new Set(investors.flatMap(i => i.focus))), [investors]);
  const allLocations = useMemo(() => Array.from(new Set(investors.map(i => i.location))), [investors]);
  const allStages = useMemo(() => Array.from(new Set(investors.map(i => i.stage))), [investors]);

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

      return matchesSearch && matchesFocus && matchesLocation && matchesStage;
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Find Investors</h2>
          <p className="text-zinc-400">Discover and connect with the perfect angels for Novalyte AI.</p>
        </div>
        <div className="flex items-center gap-2">
           <button 
              onClick={() => setShowGraph(!showGraph)}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors ${
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

      {/* Controls Section */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input 
              type="text"
              placeholder="Search investors by name, firm, bio, thesis, or focus..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-600"
            />
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 py-3 border rounded-xl transition-colors flex items-center gap-2 ${
              showFilters 
                ? 'bg-zinc-800 border-zinc-700 text-white' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
            }`}
          >
            <Filter size={20} />
            <span>Filters</span>
            <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button 
              onClick={() => setSortOption('match')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                sortOption === 'match' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Match Score
            </button>
            <button 
              onClick={() => setSortOption(sortOption === 'rangeAsc' ? 'rangeDesc' : 'rangeAsc')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                sortOption.startsWith('range') ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Range</span>
              {sortOption === 'rangeAsc' && <SortAsc size={14} />}
              {sortOption === 'rangeDesc' && <SortDesc size={14} />}
            </button>
            <button 
              onClick={() => setSortOption('expertiseMatch')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                sortOption === 'expertiseMatch' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BrainCircuit size={14} />
              <span>Expertise</span>
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Stage
              </label>
              <select 
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">All Stages</option>
                {allStages.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Industry Focus
              </label>
              <select 
                value={selectedFocus}
                onChange={(e) => setSelectedFocus(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">All Industries</option>
                {allFocusAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Location
              </label>
              <select 
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">All Locations</option>
                {allLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => {
                  setSelectedFocus('');
                  setSelectedLocation('');
                  setSelectedStage('');
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
        {filteredInvestors.map((investor) => (
          <InvestorCard 
            key={investor.id} 
            investor={investor} 
            onSelect={setSelectedInvestor} 
            onAddTag={handleAddTag}
          />
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
      />
    </div>
  );
}
