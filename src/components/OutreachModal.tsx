import { useState } from 'react';
import { Investor } from '../data/investors';
import { X, Send, Sparkles, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clientGemini as ai } from '../lib/env';

interface OutreachModalProps {
  investor: Investor | null;
  onClose: () => void;
}

export function OutreachModal({ investor, onClose }: OutreachModalProps) {
  const [startupDetails, setStartupDetails] = useState(
    "Novalyte AI is a pre-seed health tech startup focused on AI-driven diagnostics. We have developed a proprietary algorithm that detects early signs of anomalies with 99% accuracy. Our Google Ads campaigns are live and generating significant traffic, validating market interest. However, we are currently out of funds and need capital to sustain operations and scale our user base."
  );
  const [usps, setUsps] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!investor) return;
    if (!ai) {
      setGeneratedEmail("VITE_GEMINI_API_KEY is not configured.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const prompt = `
        Act as a professional startup fundraiser.
        
        I need you to draft a compelling, concise cold email to an angel investor.
        
        **Investor Details:**
        - Name: ${investor.name}
        - Focus Areas: ${investor.focus.join(', ')}
        - Bio: ${investor.bio}
        - Investment Thesis: ${investor.investmentThesis}
        
        **My Startup Details (Novalyte AI):**
        ${startupDetails}

        **Unique Selling Points:**
        ${usps}
        
        **Key Context to Include (MANDATORY):**
        - Novalyte AI is ready and the product is live.
        - Google Ads are live and generating significant traffic (traction).
        - **Unique Selling Point:** Proprietary AI algorithm with 99% accuracy in early anomaly detection.
        - We are currently out of funds and need pre-seed investment to scale.
        - **Call to Action:** Request a 10-minute introductory call. Explicitly ask them to schedule via my Calendly link: [Insert Calendly Link].
        
        **Tone:**
        - Professional, appreciative, and urgent but not desperate.
        - Respectful of their time.
        - Show confidence in the product's readiness.
        
        **Output:**
        Return ONLY the email subject and body. Format it clearly.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setGeneratedEmail(response.text || "Failed to generate email.");
    } catch (error) {
      console.error("Error generating email:", error);
      setGeneratedEmail("An error occurred while generating the email. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {investor && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 z-50 shadow-2xl overflow-y-auto"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white">Draft Outreach</h2>
                  <p className="text-zinc-400">to {investor.name}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    About Novalyte AI
                  </label>
                  <textarea
                    value={startupDetails}
                    onChange={(e) => setStartupDetails(e.target.value)}
                    className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                    placeholder="Paste details about your startup here..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Unique Selling Points (USPs)
                  </label>
                  <textarea
                    value={usps}
                    onChange={(e) => setUsps(e.target.value)}
                    className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                    placeholder="List your key differentiators..."
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !startupDetails.trim()}
                  className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Generate with Gemini
                    </>
                  )}
                </button>

                {generatedEmail && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative mt-8 p-6 bg-zinc-900 rounded-xl border border-zinc-800"
                  >
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={handleCopy}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                      </button>
                    </div>
                    <h3 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider">Generated Draft</h3>
                    <div className="prose prose-invert max-w-none whitespace-pre-wrap text-zinc-300 font-mono text-sm">
                      {generatedEmail}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
