import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchableDropdownProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchableDropdown({ label, options, value, onChange, placeholder = "Select..." }: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-left flex items-center justify-between hover:border-zinc-700 transition-colors"
      >
        <span className={`truncate ${value ? "text-zinc-200" : "text-zinc-500"}`}>
          {value || placeholder}
        </span>
        <ChevronDown size={16} className={`text-zinc-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-zinc-800">
              <div className="flex items-center gap-2 bg-zinc-950 rounded-lg px-2 py-1.5 border border-zinc-800">
                <Search size={14} className="text-zinc-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-zinc-600"
                  autoFocus
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="text-zinc-500 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              <button
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  value === '' ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <span>All {label}s</span>
                {value === '' && <Check size={14} />}
              </button>
              {filteredOptions.map(option => (
                <button
                  key={option}
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    value === option ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <span className="truncate">{option}</span>
                  {value === option && <Check size={14} />}
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <div className="px-3 py-2 text-xs text-zinc-600 text-center">
                  No matches found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
