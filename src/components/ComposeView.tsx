import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Paperclip, Trash2, ThumbsUp, ThumbsDown, Loader2, FileText, ChevronDown, Users, Search, X, Bold, Italic, List, Link2, Type as TypeIcon, Smile, Calendar, Clock, Wand2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { format, addHours, addDays, startOfHour } from 'date-fns';
import { Investor } from '../data/investors';
import { Email } from '../data/emails';
import { clientGemini as ai } from '../lib/env';
import { buildVaultPromptContext, loadVaultData } from '../lib/vault';

interface ComposeViewProps {
  onSend?: (email: Partial<Email> & { scheduledFor?: string }) => void;
  initialInvestor?: Investor | null;
  initialDraft?: string;
  interestedInvestors: Investor[];
}

const EMAIL_TEMPLATES = [
  {
    id: 'intro',
    name: 'Cold Intro (Traction Focused)',
    subject: 'Novalyte AI x [Firm Name] - Pre-seed Round',
    body: "Hi [Investor Name],<br><br>I've been following [Firm Name]'s investments in [Industry] and noticed your focus on [Specific Area].<br><br>I'm the founder of Novalyte AI. We've developed a proprietary diagnostic engine with 99% accuracy that's already live and generating revenue. We're currently raising a pre-seed round to scale our user base.<br><br>Would you be open to a 15-minute intro call next week?<br><br>Best,<br>[My Name]"
  },
  {
    id: 'follow-up',
    name: 'Quick Follow-up',
    subject: 'Re: Novalyte AI - Pre-seed Round',
    body: "Hi [Investor Name],<br><br>Just wanted to circle back on my previous note. We just secured another pilot program since my last email, further validating our market-ready diagnostic engine.<br><br>I'd love to share more about our growth plans if you have a moment.<br><br>Best,<br>[My Name]"
  },
  {
    id: 'update',
    name: 'Monthly Progress Update',
    subject: 'Novalyte AI: Monthly Update - [Month] [Year]',
    body: "Hi [Investor Name],<br><br>I wanted to share a quick update on Novalyte AI's progress this month:<br><br>- <b>Traction:</b> [Metric 1]<br>- <b>Product:</b> [Metric 2]<br>- <b>Team:</b> [Metric 3]<br><br>We're moving fast and would love to keep you in the loop as we scale.<br><br>Best,<br>[My Name]"
  }
];

const QUILL_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'image'],
    ['clean']
  ],
};

const QUILL_FORMATS = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list',
  'link', 'image'
];

export function ComposeView({ onSend, initialInvestor, initialDraft, interestedInvestors }: ComposeViewProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(initialInvestor || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showInvestorPicker, setShowInvestorPicker] = useState(false);
  const [investorSearch, setInvestorSearch] = useState('');
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>(format(addHours(startOfHour(new Date()), 1), "yyyy-MM-dd'T'HH:mm"));
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (to || subject || body) {
        saveDraft();
      }
    }, 2000);
    
    return () => {
      clearTimeout(timer);
      // Save on unmount if there's content
      if (to || subject || body) {
        const draft = { to, subject, body, selectedInvestorId: selectedInvestor?.id, timestamp: new Date().toISOString() };
        localStorage.setItem('outreach_draft_autosave', JSON.stringify(draft));
      }
    };
  }, [to, subject, body, selectedInvestor]);

  const saveDraft = () => {
    setIsAutoSaving(true);
    const draft = { to, subject, body, selectedInvestorId: selectedInvestor?.id, timestamp: new Date().toISOString() };
    localStorage.setItem('outreach_draft_autosave', JSON.stringify(draft));
    setTimeout(() => {
      setLastSaved(new Date());
      setIsAutoSaving(false);
    }, 500);
  };

  useEffect(() => {
    if (initialInvestor) {
      setSelectedInvestor(initialInvestor);
      setTo(initialInvestor.contactPreference === 'Email' ? 'email@example.com' : initialInvestor.name);
      setSubject(`Intro: Novalyte AI x ${initialInvestor.firm || initialInvestor.name}`);
    }
    
    if (initialDraft) {
      const subjectMatch = initialDraft.match(/Subject: (.*)/);
      if (subjectMatch) {
        setSubject(subjectMatch[1]);
        setBody(initialDraft.replace(/Subject: .*\n/, '').trim().replace(/\n/g, '<br>'));
      } else {
        setBody(initialDraft.replace(/\n/g, '<br>'));
      }
    } else {
      // Try to load autosave if no initial data
      const saved = localStorage.getItem('outreach_draft_autosave');
      if (saved && !initialInvestor && !initialDraft) {
        try {
          const parsed = JSON.parse(saved);
          setTo(parsed.to || '');
          setSubject(parsed.subject || '');
          setBody(parsed.body || '');
          if (parsed.selectedInvestorId) {
            const inv = interestedInvestors.find(i => i.id === parsed.selectedInvestorId);
            if (inv) setSelectedInvestor(inv);
          }
        } catch (e) {
          console.error("Failed to load autosave", e);
        }
      }
    }
  }, [initialInvestor, initialDraft, interestedInvestors]);

  const applyTemplate = (template: typeof EMAIL_TEMPLATES[0]) => {
    let newSubject = template.subject;
    let newBody = template.body;

    const firmName = selectedInvestor?.firm || selectedInvestor?.name || '[Firm Name]';
    const investorName = selectedInvestor?.name ? selectedInvestor.name.split(' ')[0] : '[Investor Name]';
    const industry = selectedInvestor?.focus?.[0] || 'your sector';
    const specificArea = selectedInvestor?.focus?.[1] || 'your focus areas';

    newSubject = newSubject
      .replace(/\[Firm Name\]/g, firmName)
      .replace(/\[Investor Name\]/g, investorName)
      .replace(/\[Industry\]/g, industry)
      .replace(/\[Specific Area\]/g, specificArea);

    newBody = newBody
      .replace(/\[Firm Name\]/g, firmName)
      .replace(/\[Investor Name\]/g, investorName)
      .replace(/\[Industry\]/g, industry)
      .replace(/\[Specific Area\]/g, specificArea)
      .replace(/\[My Name\]/g, 'Founder'); // Default fallback

    setSubject(newSubject);
    setBody(newBody);
    setShowTemplates(false);
  };

  const handleAiAction = async (action: 'generate' | 'refine' | 'subject') => {
    if (!ai) {
      alert("VITE_GEMINI_API_KEY is not configured.");
      return;
    }

    setIsGenerating(true);
    setFeedback(null);
    try {
      const vaultData = loadVaultData();
      const context = buildVaultPromptContext(vaultData, {
        documentLimit: 5,
        charsPerDocument: 1000,
      });

      let prompt = '';
      if (action === 'generate') {
        prompt = `Draft a professional investor outreach email for Novalyte AI based on this request: "${aiPrompt}".

        Critical instructions:
        1. Treat the company vault below as the source of truth for Novalyte AI.
        2. Do not invent traction, metrics, customers, pilots, partnerships, or claims that are not present in the vault.
        3. If a target investor profile is provided, use Google Search to find recent, factual context about that investor or firm and tailor the email to their thesis.
        4. Use the strongest proof points from the vault when they are relevant.
        5. Keep the email concise, credible, and written for a real investor.
        6. Return only the email body as HTML.

        Company vault:
        ${context}`;
      } else if (action === 'refine') {
        prompt = `Refine and improve this investor outreach email body: "${body}".

        Instructions:
        1. Keep the company facts aligned with the vault below.
        2. Do not add claims that are not supported by the vault.
        3. Make it more personalized to the target investor if a profile is provided.
        4. Improve clarity, confidence, and the call to action.
        5. Return only the email body as HTML.

        Company vault:
        ${context}`;
      } else if (action === 'subject') {
        prompt = `Suggest 3 compelling subject lines for this investor email body: "${body}".

        Instructions:
        1. Use the target investor's firm name or focus area if provided.
        2. Keep them personal and credible, not spammy.
        3. Align them with the company vault below.
        4. Return only the 3 subject lines separated by newlines.

        Company vault:
        ${context}`;
      }

      if (selectedInvestor) {
        prompt += `\nTarget investor profile:
        - Name: ${selectedInvestor.name}
        - Firm: ${selectedInvestor.firm}
        - Focus: ${selectedInvestor.focus.join(', ')}
        - Bio: ${selectedInvestor.bio}`;
      }

      prompt += `\nKeep the response grounded in the provided information.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const result = response.text || "";
      
      if (action === 'subject') {
        const subjects = result.split('\n').filter(s => s.trim());
        if (subjects.length > 0) {
          setSubject(subjects[0].replace(/^\d+\.\s*/, '').replace(/^Subject:\s*/i, ''));
        }
      } else {
        setBody(result.replace(/\n/g, '<br>'));
      }
      
      setAiPrompt('');
    } catch (error) {
      console.error("AI error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async (isScheduled: boolean = false) => {
    if (!to || !subject || !body) {
      alert("Please fill in all fields.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      alert("Please enter a valid email address.");
      return;
    }

    setIsSending(true);
    try {
      await onSend?.({ 
        to, 
        subject, 
        body, 
        scheduledFor: isScheduled ? scheduledDate : undefined 
      });
      
      // Clear autosave on success
      localStorage.removeItem('outreach_draft_autosave');
      
      setTo('');
      setSubject('');
      setBody('');
      setSelectedInvestor(null);
      setShowSchedule(false);
    } catch (error) {
      console.error("Failed to send email", error);
    } finally {
      setIsSending(false);
    }
  };

  const filteredInvestors = interestedInvestors.filter(inv => 
    inv.name.toLowerCase().includes(investorSearch.toLowerCase()) ||
    inv.firm.toLowerCase().includes(investorSearch.toLowerCase())
  );

  const selectInvestor = (inv: Investor) => {
    setSelectedInvestor(inv);
    setTo(inv.contactPreference === 'Email' ? 'email@example.com' : inv.name);
    setSubject(`Intro: Novalyte AI x ${inv.firm || inv.name}`);
    setShowInvestorPicker(false);
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white">Compose</h2>
          {selectedInvestor && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <img src={selectedInvestor.imageUrl} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
              <span className="text-xs font-medium text-blue-400">{selectedInvestor.name}</span>
              <button onClick={() => setSelectedInvestor(null)} className="text-blue-400 hover:text-white">
                <X size={12} />
              </button>
            </div>
          )}
          <AnimatePresence mode="wait">
            {lastSaved && (
              <motion.span 
                key={lastSaved.getTime()}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-[10px] text-zinc-500 italic flex items-center gap-1"
              >
                <CheckCircle2 size={10} className="text-green-500" />
                Draft saved at {format(lastSaved, 'HH:mm:ss')}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white text-sm transition-colors border border-zinc-800"
          >
            <FileText size={16} />
            Templates
            <ChevronDown size={14} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowInvestorPicker(!showInvestorPicker)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white text-sm transition-colors border border-zinc-800"
            >
              <Users size={16} />
              Choose Investor
            </button>

            <AnimatePresence>
              {showInvestorPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-zinc-800">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                      <input 
                        type="text"
                        placeholder="Search your list..."
                        value={investorSearch}
                        onChange={(e) => setInvestorSearch(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredInvestors.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-xs text-zinc-500">No investors found in your list.</p>
                      </div>
                    ) : (
                      filteredInvestors.map(inv => (
                        <button
                          key={inv.id}
                          onClick={() => selectInvestor(inv)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800/50 last:border-0"
                        >
                          <img src={inv.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                          <div>
                            <p className="text-sm font-bold text-white">{inv.name}</p>
                            <p className="text-[10px] text-zinc-500">{inv.firm}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Templates Dropdown */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-zinc-900 border-b border-zinc-800 overflow-hidden"
          >
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {EMAIL_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="text-left p-4 rounded-xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group"
                >
                  <p className="text-sm font-bold text-white mb-1 group-hover:text-blue-400">{template.name}</p>
                  <p className="text-xs text-zinc-500 line-clamp-2">{template.subject}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col bg-zinc-950 p-6 overflow-hidden">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col bg-zinc-900/30 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-500 w-16">To</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-zinc-700"
              placeholder="investor@firm.com"
            />
          </div>
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-500 w-16">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-zinc-700"
              placeholder="The next big thing in HealthTech..."
            />
            <button 
              onClick={() => handleAiAction('subject')}
              disabled={isGenerating || !body}
              className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-30"
              title="Suggest Subject Line"
            >
              <Wand2 size={16} />
            </button>
          </div>
          
          <div className="flex-1 relative overflow-hidden flex flex-col">
            <ReactQuill
              theme="snow"
              value={body}
              onChange={setBody}
              modules={QUILL_MODULES}
              formats={QUILL_FORMATS}
              placeholder="Start writing your masterpiece..."
              className="flex-1 text-zinc-200"
            />

            {/* AI Assistant Floating Bar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-10">
              <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-700 rounded-2xl p-2 shadow-2xl flex items-center gap-2">
                <div className="p-2 text-blue-400">
                  <Sparkles size={20} />
                </div>
                <input 
                  type="text"
                  placeholder="Ask Gemini to draft, refine, or research..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiAction('generate')}
                  className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                />
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleAiAction('refine')}
                    disabled={isGenerating || !body}
                    className="px-3 py-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                  >
                    Refine
                  </button>
                  <button 
                    onClick={() => handleAiAction('generate')}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                    {isGenerating ? 'Thinking...' : 'Generate'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white rounded-2xl shadow-lg overflow-hidden">
                <button 
                  onClick={() => handleSend(false)}
                  disabled={isSending}
                  className="px-8 py-3 bg-white text-zinc-900 text-sm font-bold hover:bg-zinc-200 transition-all flex items-center gap-2 disabled:opacity-50 border-r border-zinc-200"
                >
                  {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  {isSending ? 'Sending...' : 'Send'}
                </button>
                <button 
                  onClick={() => setShowSchedule(!showSchedule)}
                  className="px-3 py-3 bg-white text-zinc-900 hover:bg-zinc-200 transition-all"
                  title="Schedule Send"
                >
                  <ChevronDown size={18} />
                </button>
              </div>

              {/* Schedule Dropdown */}
              <AnimatePresence>
                {showSchedule && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-20 left-6 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50"
                  >
                    <div className="flex items-center gap-2 mb-4 text-white font-bold text-sm">
                      <Calendar size={16} className="text-blue-400" />
                      Schedule Send
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Date & Time</span>
                        <input 
                          type="datetime-local"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => setScheduledDate(format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"))}
                          className="px-2 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] transition-colors"
                        >
                          In 1 hour
                        </button>
                        <button 
                          onClick={() => setScheduledDate(format(addDays(new Date(), 1), "yyyy-MM-dd'T'09:00"))}
                          className="px-2 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] transition-colors"
                        >
                          Tomorrow 9 AM
                        </button>
                      </div>
                      <button 
                        onClick={() => handleSend(true)}
                        className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 transition-colors"
                      >
                        Schedule for {format(new Date(scheduledDate), 'MMM d, h:mm a')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex items-center gap-1 ml-4 border-l border-zinc-800 pl-4">
                <button className="p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors" title="Attach files">
                  <Paperclip size={18} />
                </button>
                <button className="p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors" title="Insert emoji">
                  <Smile size={18} />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {isAutoSaving && (
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" />
                  Saving...
                </span>
              )}
              {body && (
                <div className="flex items-center gap-2 border-r border-zinc-800 pr-4">
                  <button 
                    onClick={() => setFeedback('positive')}
                    className={`p-2 rounded-lg transition-colors ${feedback === 'positive' ? 'text-green-400 bg-green-500/10' : 'text-zinc-500 hover:text-green-400'}`}
                  >
                    <ThumbsUp size={18} />
                  </button>
                  <button 
                    onClick={() => setFeedback('negative')}
                    className={`p-2 rounded-lg transition-colors ${feedback === 'negative' ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 hover:text-red-400'}`}
                  >
                    <ThumbsDown size={18} />
                  </button>
                </div>
              )}
              <button 
                onClick={() => {
                  if (confirm("Discard this draft?")) {
                    localStorage.removeItem('outreach_draft_autosave');
                    setBody('');
                    setSubject('');
                    setTo('');
                    setSelectedInvestor(null);
                  }
                }}
                className="p-3 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quill Custom Styles */}
      <style>{`
        .quill {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid #27272a;
          background: rgba(24, 24, 27, 0.5);
          padding: 8px 16px;
        }
        .ql-container.ql-snow {
          border: none;
          flex: 1;
          font-family: 'JetBrains Mono', monospace;
          font-size: 16px;
        }
        .ql-editor {
          padding: 32px;
          line-height: 1.6;
        }
        .ql-editor.ql-blank::before {
          color: #3f3f46;
          font-style: normal;
          left: 32px;
        }
        .ql-snow .ql-stroke {
          stroke: #71717a;
        }
        .ql-snow .ql-fill {
          fill: #71717a;
        }
        .ql-snow .ql-picker {
          color: #71717a;
        }
        .ql-snow.ql-toolbar button:hover .ql-stroke,
        .ql-snow.ql-toolbar button.ql-active .ql-stroke {
          stroke: #3b82f6;
        }
      `}</style>
    </div>
  );
}
