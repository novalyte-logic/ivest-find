import { useState, useEffect } from 'react';
import { Save, Database, Sparkles, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface VaultData {
  overview: string;
  traction: string;
  ask: string;
  updates: string;
  usps: string;
}

const DEFAULT_DATA: VaultData = {
  overview: "Novalyte AI is a pre-seed health tech startup focused on AI-driven diagnostics. We have developed a proprietary algorithm that detects early signs of anomalies with 99% accuracy.",
  traction: "Our product is live and market-ready. Google Ads campaigns are active and generating significant traffic, validating strong market demand. We have secured 2 pilot programs with local clinics.",
  ask: "We are seeking pre-seed capital specifically to scale our operations and user base. We are not looking for R&D funding; the tech is built. We need fuel for growth.",
  updates: "Just released v2.0 of the diagnostic engine. User retention is up 40% MoM.",
  usps: "Proprietary AI algorithm with 99% accuracy. HIPAA-compliant architecture. Zero-latency inference."
};

export function NovalyteVault() {
  const [data, setData] = useState<VaultData>(DEFAULT_DATA);
  const [isSaved, setIsSaved] = useState(false);

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
    setData(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('novalyte_vault', JSON.stringify(data));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Database className="text-blue-500" />
            Novalyte Vault
          </h2>
          <p className="text-zinc-400">
            Central intelligence for Novalyte AI. The AI Engine uses this data to personalize every outreach.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20"
        >
          {isSaved ? <Check size={20} /> : <Save size={20} />}
          {isSaved ? 'Saved!' : 'Save Vault'}
        </button>
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

        {/* Recent Updates */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
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
