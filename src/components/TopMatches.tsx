import { Investor } from '../data/investors';
import { calculateMatchScore } from '../lib/matching';
import { VaultData } from '../lib/vault';
import { Sparkles, ArrowRight } from 'lucide-react';

interface TopMatchesProps {
  investors: Investor[];
  onSelect: (investor: Investor) => void;
  vaultData: VaultData;
}

export function TopMatches({ investors, onSelect, vaultData }: TopMatchesProps) {
  // Get top 5 investors based on match score
  const topInvestors = [...investors]
    .sort((a, b) => calculateMatchScore(b, vaultData).score - calculateMatchScore(a, vaultData).score)
    .slice(0, 5);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-yellow-400" size={20} />
        <h3 className="text-lg font-bold text-white">Top 5 Matches for Novalyte AI</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {topInvestors.map((investor, index) => {
          const match = calculateMatchScore(investor, vaultData);
          return (
            <div 
              key={investor.id}
              onClick={() => onSelect(investor)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 hover:border-blue-500/50 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-500">#{index + 1}</span>
                <span className="text-xs font-bold text-green-400">{match.score}% Match</span>
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                <img src={investor.imageUrl} alt={investor.name} className="w-8 h-8 rounded-full" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{investor.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{investor.firm}</p>
                </div>
              </div>

              <div className="text-[10px] text-zinc-400 bg-zinc-900 rounded p-2 mb-2 h-12 overflow-hidden">
                {match.rationale}
              </div>

              <div className="flex justify-end">
                <ArrowRight size={14} className="text-zinc-600 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
