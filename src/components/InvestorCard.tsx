import { MouseEvent } from 'react';
import { Investor } from '../data/investors';
import { MapPin, DollarSign, ArrowRight, Sparkles, Clock, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { calculateMatchScore } from '../lib/matching';

interface InvestorCardProps {
  investor: Investor;
  onSelect: (investor: Investor) => void;
  onAddTag: (investor: Investor, tag: string) => void;
  onToggleInterested?: (investor: Investor) => void;
  isInterested?: boolean;
}

export function InvestorCard({ investor, onSelect, onAddTag, onToggleInterested, isInterested }: InvestorCardProps) {
  const match = calculateMatchScore(investor);

  const handleToggleInterested = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleInterested?.(investor);
  };

  const handleFollowUp = (e: MouseEvent) => {
    e.stopPropagation();
    const tag = window.prompt("Enter tag for follow up (e.g., 'Follow Up Scheduled', 'Next Contact Date'):", "Follow Up Scheduled");
    if (tag) {
      onAddTag(investor, tag);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="group relative bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-zinc-600 transition-colors duration-300 cursor-pointer overflow-hidden flex flex-col h-full"
      onClick={() => onSelect(investor)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10 flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <img 
            src={investor.imageUrl} 
            alt={investor.name} 
            className="w-14 h-14 rounded-full object-cover border-2 border-zinc-800 group-hover:border-zinc-600 transition-colors"
          />
          <div>
            <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
              {investor.name}
            </h3>
            <p className="text-xs text-zinc-400">{investor.role} {investor.firm && `at ${investor.firm}`}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
           <div className="flex items-center gap-2">
             <button 
               onClick={handleToggleInterested}
               className={`p-1.5 rounded-lg transition-colors ${
                 isInterested ? 'text-yellow-500 bg-yellow-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
               }`}
               title={isInterested ? "Remove from interested" : "Mark as interested"}
             >
               <Star size={16} fill={isInterested ? "currentColor" : "none"} />
             </button>
             <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${
               match.score >= 80 ? 'bg-green-500/20 text-green-400' : 
               match.score >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 
               'bg-zinc-800 text-zinc-400'
             }`}>
               <Sparkles size={10} />
               {match.score}% Match
             </div>
           </div>
           <div className="px-2 py-1 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
             {investor.stage}
           </div>
        </div>
      </div>

      <p className="relative z-10 text-zinc-300 text-sm leading-relaxed line-clamp-2 mb-4 flex-grow">
        {investor.bio}
      </p>

      <div className="relative z-10 grid grid-cols-2 gap-4 text-xs text-zinc-500 mb-4">
        <div className="flex items-center gap-2">
          <MapPin size={14} />
          <span>{investor.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign size={14} />
          <span>{investor.investmentRange}</span>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap gap-2 mt-auto">
        {investor.tags && investor.tags.length > 0 && (
          <div className="w-full flex flex-wrap gap-2 mb-2">
            {investor.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                {tag}
              </span>
            ))}
          </div>
        )}
        {investor.focus.slice(0, 3).map((tag) => (
          <span 
            key={tag} 
            className="px-2 py-1 text-xs font-medium bg-zinc-800 text-zinc-300 rounded-md border border-zinc-700/50"
          >
            {tag}
          </span>
        ))}
        {investor.focus.length > 3 && (
          <span className="px-2 py-1 text-xs font-medium bg-zinc-800 text-zinc-500 rounded-md border border-zinc-700/50">
            +{investor.focus.length - 3}
          </span>
        )}
      </div>

      {/* Follow Up Button */}
      <div className="relative z-10 mt-4 pt-4 border-t border-zinc-800 flex justify-end">
        <button
          onClick={handleFollowUp}
          className="text-xs flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
        >
          <Clock size={12} />
          <span>Follow Up</span>
        </button>
      </div>
    </motion.div>
  );
}
