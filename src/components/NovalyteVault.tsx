import { useState, useEffect, ChangeEvent } from 'react';
import { Save, Database, Sparkles, Check, Clipboard, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface VaultData {
  overview: string;
  traction: string;
  ask: string;
  updates: string;
  usps: string;
  calendlyLink: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DEFAULT_DATA: VaultData = {
  overview: "Novalyte AI is a pre-seed health tech startup focused on AI-driven diagnostics. We have developed a proprietary algorithm that detects early signs of anomalies with 99% accuracy.",
  traction: "Our product is live and market-ready. Google Ads campaigns are active and generating significant traffic, validating strong market demand. We have secured 2 pilot programs with local clinics.",
  ask: "We are seeking pre-seed capital specifically to scale our operations and user base. We are not looking for R&D funding; the tech is built. We need fuel for growth.",
  updates: "Just released v2.0 of the diagnostic engine. User retention is up 40% MoM.",
  usps: "Proprietary AI algorithm with 99% accuracy. HIPAA-compliant architecture. Zero-latency inference.",
  calendlyLink: "https://calendly.com/novalyte/intro"
};

export function NovalyteVault() {
  const [data, setData] = useState<VaultData>(DEFAULT_DATA);
  const [isSaved, setIsSaved] = useState(false);
  const [isResearching, setIsResearching] = useState(false);

  const handleIndustryResearch = async () => {
    setIsResearching(true);
    try {
      const prompt = `
        Research current 2024-2025 trends in "AI-driven health diagnostics" and "Health Tech pre-seed funding".
        Find:
        1. Key market growth statistics.
        2. Recent major news or regulatory changes (e.g. FDA AI guidelines).
        3. What investors are currently looking for in this space.
        
        Return a summary that can be used to enrich a startup's pitch.
        Format as a concise list of bullet points.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const researchText = response.text || "";
      handleChange('updates', data.updates + "\n\n--- Industry Research (2025) ---\n" + researchText);
      alert("Industry research added to your Recent Updates!");
    } catch (error) {
      console.error("Research error:", error);
      alert("Failed to research industry. Please try again.");
    } finally {
      setIsResearching(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('novalyte_vault');
    if (saved) {
      try {
        setData({ ...DEFAULT_DATA, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to parse vault data", e);
      }
    }
  }, []);

  const handleChange = (field: keyof VaultData, value: string) => {
    const newData = { ...data, [field]: value };
    setData(newData);
    setIsSaved(false);
    
    // Auto-save to local storage
    localStorage.setItem('novalyte_vault', JSON.stringify(newData));
  };

  const handleSave = () => {
    localStorage.setItem('novalyte_vault', JSON.stringify(data));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleChange('overview', data.overview + "\n\n--- Uploaded Context ---\n" + text);
    };
    reader.readAsText(file);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleChange('overview', data.overview + "\n\n--- Pasted Context ---\n" + text);
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      alert("Failed to read clipboard. Please allow clipboard access or paste manually.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2 flex items-center gap-3">
            <Database className="text-blue-500" size={24} />
            Novalyte Vault
          </h2>
          <p className="text-sm md:text-base text-zinc-400">
            Central intelligence for Novalyte AI. The AI Engine uses this data to personalize every outreach.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleIndustryResearch}
            disabled={isResearching}
            className="flex-1 md:flex-none px-3 py-2 bg-blue-500/10 text-blue-400 font-bold rounded-xl hover:bg-blue-500/20 border border-blue-500/20 transition-colors flex items-center justify-center gap-2 text-xs md:text-sm disabled:opacity-50"
          >
            {isResearching ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Industry Research
          </button>
          <button
            onClick={handlePaste}
            className="flex-1 md:flex-none px-3 py-2 bg-zinc-800 text-zinc-300 font-bold rounded-xl hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 text-xs md:text-sm"
          >
            <Clipboard size={16} />
            Paste
          </button>
          <label className="flex-1 md:flex-none px-3 py-2 bg-zinc-800 text-zinc-300 font-bold rounded-xl hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 cursor-pointer text-xs md:text-sm">
            <input type="file" className="hidden" accept=".txt,.md,.json" onChange={handleFileUpload} />
            <Search size={16} />
            Upload
          </label>
          <button
            onClick={handleSave}
            className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 text-xs md:text-sm"
          >
            {isSaved ? <Check size={18} /> : <Save size={18} />}
            {isSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Overview */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">
            Company Overview
          </label>
          <textarea
            value={data.overview}
            onChange={(e) => handleChange('overview', e.target.value)}
            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none leading-relaxed"
            placeholder="What does Novalyte AI do?"
          />
          <p className="text-xs text-zinc-500 mt-2">
            The core pitch. Keep it concise and punchy.
          </p>
        </div>

        {/* Traction & Progress */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-bold text-green-400 uppercase tracking-wider mb-3">
            Traction & Progress
          </label>
          <textarea
            value={data.traction}
            onChange={(e) => handleChange('traction', e.target.value)}
            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all resize-none leading-relaxed"
            placeholder="Prove that the product is real and working."
          />
          <p className="text-xs text-zinc-500 mt-2">
            Metrics, users, pilot programs, or "product is live" statements.
          </p>
        </div>

        {/* The Ask */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-bold text-purple-400 uppercase tracking-wider mb-3">
            The Ask & Needs
          </label>
          <textarea
            value={data.ask}
            onChange={(e) => handleChange('ask', e.target.value)}
            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none leading-relaxed"
            placeholder="What do you need money for?"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Emphasize scaling and growth, not just "building".
          </p>
        </div>

        {/* Unique Selling Points */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-bold text-yellow-400 uppercase tracking-wider mb-3">
            Unique Selling Points (USPs)
          </label>
          <textarea
            value={data.usps}
            onChange={(e) => handleChange('usps', e.target.value)}
            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all resize-none leading-relaxed"
            placeholder="Why are you 10x better?"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Proprietary tech, accuracy stats, patents, etc.
          </p>
        </div>

        {/* Calendly Link */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-bold text-orange-400 uppercase tracking-wider mb-3">
            Calendly / Booking Link
          </label>
          <input
            type="text"
            value={data.calendlyLink}
            onChange={(e) => handleChange('calendlyLink', e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
            placeholder="https://calendly.com/..."
          />
          <p className="text-xs text-zinc-500 mt-2">
            Used for the Call to Action in emails.
          </p>
        </div>

        {/* Recent Updates */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-bold text-pink-400 uppercase tracking-wider mb-3">
            Recent Updates / News
          </label>
          <textarea
            value={data.updates}
            onChange={(e) => handleChange('updates', e.target.value)}
            className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all resize-none leading-relaxed"
            placeholder="Any new wins to mention?"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Good for making emails feel timely and relevant.
          </p>
        </div>
      </div>
    </div>
  );
}
