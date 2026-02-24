import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Paperclip, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { Investor } from '../data/investors';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvestor?: Investor | null;
  initialDraft?: string;
}

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function ComposeEmailModal({ isOpen, onClose, initialInvestor, initialDraft }: ComposeEmailModalProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);

  // Load initial data when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (initialInvestor) {
        setTo(initialInvestor.contactPreference === 'Email' ? 'email@example.com' : initialInvestor.name);
        setSubject(`Intro: Novalyte AI x ${initialInvestor.firm || initialInvestor.name}`);
      }
      if (initialDraft) {
        // Parse subject and body if possible, or just dump into body
        // Assuming the draft from OutreachModal is just text, we put it in body.
        // If it has "Subject:" line, we could parse it.
        const subjectMatch = initialDraft.match(/Subject: (.*)/);
        if (subjectMatch) {
          setSubject(subjectMatch[1]);
          setBody(initialDraft.replace(/Subject: .*\n/, '').trim());
        } else {
          setBody(initialDraft);
        }
      }
    }
  }, [isOpen, initialInvestor, initialDraft]);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      // Get stored context from Vault
      const vaultDataStr = localStorage.getItem('novalyte_vault');
      const vaultData = vaultDataStr ? JSON.parse(vaultDataStr) : {};
      
      const overview = vaultData.overview || "Novalyte AI is a pre-seed health tech startup...";
      const traction = vaultData.traction || "Product is live...";
      const ask = vaultData.ask || "Seeking pre-seed funding...";
      const usps = vaultData.usps || "Proprietary AI...";
      const updates = vaultData.updates || "";

      // Construct a rich prompt
      let fullPrompt = `
        Act as a professional startup fundraiser.
        Draft an email based on this request: "${aiPrompt}"
        
        **My Startup Context (Novalyte AI):**
        - Overview: ${overview}
        - Traction (EMPHASIZE THIS): ${traction}
        - The Ask: ${ask}
        - USPs: ${usps}
        - Recent Updates: ${updates}
      `;

      if (initialInvestor) {
        fullPrompt += `
        
        **Target Investor Profile:**
        - Name: ${initialInvestor.name}
        - Firm: ${initialInvestor.firm}
        - Focus: ${initialInvestor.focus.join(', ')}
        - Bio: ${initialInvestor.bio}
        - Thesis: ${initialInvestor.investmentThesis}
        
        **Strategy:**
        - Speak their language. Connect their thesis to our traction.
        - Show we are moving fast (updates/traction).
        - Frame the ask as fuel for scaling, not building.
        `;
      }

      fullPrompt += `\nReturn ONLY the email body.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: fullPrompt,
      });

      const generatedText = response.text || "";
      setBody(prev => prev + (prev ? "\n\n" : "") + generatedText);
      setShowAiInput(false);
      setAiPrompt('');
    } catch (error) {
      console.error("Error generating text:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={`fixed right-4 bottom-0 z-50 bg-zinc-900 border border-zinc-700 rounded-t-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isMinimized ? 'w-72 h-12' : 'w-[600px] h-[600px]'
        }`}
      >
        {/* Header */}
        <div 
          className="bg-zinc-800 px-4 py-3 flex items-center justify-between cursor-pointer"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <h3 className="text-sm font-bold text-white">New Message</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
              className="text-zinc-400 hover:text-white"
            >
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="text-zinc-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!isMinimized && (
          <div className="flex-1 flex flex-col bg-zinc-950">
            <div className="px-4 py-2 border-b border-zinc-800">
              <input
                type="text"
                placeholder="Recipients"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-zinc-500"
              />
            </div>
            <div className="px-4 py-2 border-b border-zinc-800">
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-zinc-500"
              />
            </div>
            
            <div className="flex-1 relative">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full h-full bg-transparent p-4 text-sm text-zinc-200 focus:outline-none resize-none font-mono"
                placeholder="Draft your email..."
              />

              {/* AI Input Popover */}
              <AnimatePresence>
                {showAiInput && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-4 left-4 right-4 bg-zinc-800 border border-zinc-700 rounded-xl p-3 shadow-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-blue-400" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Ask Gemini to write..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                        className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                      />
                      <button 
                        onClick={handleAiGenerate}
                        disabled={isGenerating}
                        className="p-1.5 bg-blue-600 rounded-lg text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-zinc-800 flex items-center justify-between bg-zinc-900">
              <div className="flex items-center gap-2">
                <button className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-full hover:bg-blue-500 transition-colors">
                  Send
                </button>
                <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full">
                  <Paperclip size={18} />
                </button>
                <button 
                  onClick={() => setShowAiInput(!showAiInput)}
                  className={`p-2 rounded-full transition-colors ${showAiInput ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                  title="Help me write"
                >
                  <Sparkles size={18} />
                </button>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-full"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
