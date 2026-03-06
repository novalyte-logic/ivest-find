import { useState, useEffect, useMemo, useRef } from 'react';
import { Send, Sparkles, Paperclip, Trash2, ThumbsUp, ThumbsDown, Loader2, FileText, ChevronDown, Users, Search, X, Bold, Italic, List, Link2, Type as TypeIcon, Smile, Calendar, Clock, Wand2, CheckCircle2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { format, addHours, addDays, startOfHour } from 'date-fns';
import { Investor } from '../data/investors';
import { Email } from '../data/emails';
import { clientGemini as ai } from '../lib/env';
import {
  DEFAULT_EMAIL_TEMPLATES,
  EmailTemplate,
  getTemplateLibrary,
  isCustomTemplate,
  loadCustomTemplates,
  saveCustomTemplates,
} from '../lib/template-library';
import { parseJsonResponse } from '../lib/http';
import { buildVaultPromptContext, loadVaultData, subscribeToVaultChanges, VaultData } from '../lib/vault';
import { InvestorAvatar } from './InvestorAvatar';

const BRAND_NAME = 'Novalyte AI';
const SENDER_EMAIL =
  import.meta.env.VITE_MAIL_FROM_EMAIL ||
  import.meta.env.VITE_SMTP_FROM_EMAIL ||
  'novalyte-ai@echoclips.dev';
const SENDER_IDENTITY = SENDER_EMAIL.includes('<')
  ? SENDER_EMAIL
  : `${BRAND_NAME} <${SENDER_EMAIL}>`;

interface ComposeViewProps {
  onSend?: (email: Partial<Email> & { scheduledFor?: string }) => void;
  initialInvestor?: Investor | null;
  initialDraft?: string;
  interestedInvestors: Investor[];
}

interface EditableTemplate {
  id: string | null;
  name: string;
  description: string;
  subject: string;
  body: string;
  origin: 'default' | 'custom';
}

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

const TEMPLATE_QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic'],
    [{ list: 'bullet' }],
    ['link'],
  ],
};

const TEMPLATE_QUILL_FORMATS = ['bold', 'italic', 'list', 'link'];

function createEmptyTemplate(): EditableTemplate {
  return {
    id: null,
    name: '',
    description: '',
    subject: '',
    body: '',
    origin: 'custom',
  };
}

function toEditableTemplate(template: EmailTemplate): EditableTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    subject: template.subject,
    body: template.body,
    origin: template.origin,
  };
}

export function ComposeView({ onSend, initialInvestor, initialDraft, interestedInvestors }: ComposeViewProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(initialInvestor || null);
  const [vaultData, setVaultData] = useState<VaultData>(() => loadVaultData());
  const [customTemplates, setCustomTemplates] = useState<EmailTemplate[]>(() => loadCustomTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    DEFAULT_EMAIL_TEMPLATES[0]?.id || null,
  );
  const [templateDraft, setTemplateDraft] = useState<EditableTemplate>(() =>
    DEFAULT_EMAIL_TEMPLATES[0]
      ? toEditableTemplate(DEFAULT_EMAIL_TEMPLATES[0])
      : createEmptyTemplate(),
  );
  const [templateNotice, setTemplateNotice] = useState('');
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
  const templateLibrary = useMemo(
    () => getTemplateLibrary(customTemplates),
    [customTemplates],
  );
  const selectedTemplate = useMemo(
    () =>
      selectedTemplateId
        ? templateLibrary.find((template) => template.id === selectedTemplateId) || null
        : null,
    [selectedTemplateId, templateLibrary],
  );

  useEffect(() => {
    setVaultData(loadVaultData());
    return subscribeToVaultChanges(setVaultData);
  }, []);

  useEffect(() => {
    saveCustomTemplates(customTemplates);
  }, [customTemplates]);

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateDraft((current) => {
        if (
          current.id === selectedTemplate.id &&
          current.name === selectedTemplate.name &&
          current.description === selectedTemplate.description &&
          current.subject === selectedTemplate.subject &&
          current.body === selectedTemplate.body &&
          current.origin === selectedTemplate.origin
        ) {
          return current;
        }

        return toEditableTemplate(selectedTemplate);
      });
    }
  }, [selectedTemplate, selectedTemplateId, templateLibrary]);

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
      setTo(initialInvestor.email || '');
      setSubject(`Intro: ${BRAND_NAME} x ${initialInvestor.firm || initialInvestor.name}`);
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
          setTo(parsed.to === 'email@example.com' ? '' : (parsed.to || ''));
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

  useEffect(() => {
    if (!templateNotice) return;

    const timer = window.setTimeout(() => setTemplateNotice(''), 2400);
    return () => window.clearTimeout(timer);
  }, [templateNotice]);

  const applyTemplate = (template: Pick<EditableTemplate, 'name' | 'subject' | 'body'>) => {
    const firmName = selectedInvestor?.firm || selectedInvestor?.name || '[Firm Name]';
    const investorName = selectedInvestor?.name ? selectedInvestor.name.split(' ')[0] : '[Investor Name]';
    const industry = selectedInvestor?.focus?.[0] || 'your sector';
    const specificArea = selectedInvestor?.focus?.[1] || 'your focus areas';
    const investorFullName = selectedInvestor?.name || '[Investor Full Name]';

    const newSubject = template.subject
      .replace(/\[Firm Name\]/g, firmName)
      .replace(/\[Investor Name\]/g, investorName)
      .replace(/\[Investor Full Name\]/g, investorFullName)
      .replace(/\[Industry\]/g, industry)
      .replace(/\[Specific Area\]/g, specificArea)
      .replace(/\[Brand Name\]/g, BRAND_NAME);

    const newBody = template.body
      .replace(/\[Firm Name\]/g, firmName)
      .replace(/\[Investor Name\]/g, investorName)
      .replace(/\[Investor Full Name\]/g, investorFullName)
      .replace(/\[Industry\]/g, industry)
      .replace(/\[Specific Area\]/g, specificArea)
      .replace(/\[Brand Name\]/g, BRAND_NAME)
      .replace(/\[My Name\]/g, BRAND_NAME);

    setSubject(newSubject);
    setBody(newBody);
    setTemplateNotice(`Applied "${template.name}"`);
    setShowTemplates(false);
  };

  const selectTemplateForEditing = (template: EmailTemplate) => {
    setSelectedTemplateId(template.id);
    setTemplateDraft(toEditableTemplate(template));
  };

  const updateTemplateDraft = (patch: Partial<EditableTemplate>) => {
    setTemplateDraft((current) => ({
      ...current,
      ...patch,
    }));
  };

  const handleNewTemplate = () => {
    setSelectedTemplateId(null);
    setTemplateDraft(createEmptyTemplate());
    setTemplateNotice('New template started');
  };

  const handleSaveCurrentDraftAsTemplate = () => {
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    if (!trimmedSubject || !trimmedBody) {
      alert('Write a subject and body first, then save the draft as a template.');
      return;
    }

    const now = new Date().toISOString();
    const templateId = `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextTemplate: EmailTemplate = {
      id: templateId,
      name: trimmedSubject.slice(0, 48),
      description: 'Saved from a live outreach draft.',
      subject: trimmedSubject,
      body: trimmedBody,
      origin: 'custom',
      createdAt: now,
      updatedAt: now,
    };

    setCustomTemplates((current) => [nextTemplate, ...current]);
    setSelectedTemplateId(templateId);
    setTemplateDraft(toEditableTemplate(nextTemplate));
    setTemplateNotice('Draft saved to template library');
    setShowTemplates(true);
  };

  const handleSaveTemplate = () => {
    const name = templateDraft.name.trim();
    const subjectValue = templateDraft.subject.trim();
    const bodyValue = templateDraft.body.trim();

    if (!name || !subjectValue || !bodyValue) {
      alert('Template name, subject, and body are required.');
      return;
    }

    const now = new Date().toISOString();

    if (templateDraft.origin === 'custom' && templateDraft.id) {
      const updatedTemplate: EmailTemplate = {
        id: templateDraft.id,
        name,
        description: templateDraft.description.trim(),
        subject: subjectValue,
        body: bodyValue,
        origin: 'custom',
        createdAt:
          customTemplates.find((template) => template.id === templateDraft.id)?.createdAt ||
          now,
        updatedAt: now,
      };

      setCustomTemplates((current) =>
        current.map((template) =>
          template.id === updatedTemplate.id ? updatedTemplate : template,
        ),
      );
      setSelectedTemplateId(updatedTemplate.id);
      setTemplateDraft(toEditableTemplate(updatedTemplate));
      setTemplateNotice('Template updated');
      return;
    }

    const newTemplate: EmailTemplate = {
      id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      description: templateDraft.description.trim(),
      subject: subjectValue,
      body: bodyValue,
      origin: 'custom',
      createdAt: now,
      updatedAt: now,
    };

    setCustomTemplates((current) => [newTemplate, ...current]);
    setSelectedTemplateId(newTemplate.id);
    setTemplateDraft(toEditableTemplate(newTemplate));
    setTemplateNotice(
      templateDraft.origin === 'default'
        ? 'Saved as a custom copy'
        : 'Template saved',
    );
  };

  const handleDeleteTemplate = () => {
    if (!selectedTemplate || !isCustomTemplate(selectedTemplate)) {
      return;
    }

    if (!confirm(`Delete template "${selectedTemplate.name}"?`)) {
      return;
    }

    setCustomTemplates((current) =>
      current.filter((template) => template.id !== selectedTemplate.id),
    );
    const fallbackTemplate = templateLibrary.find(
      (template) => template.id !== selectedTemplate.id,
    );
    setSelectedTemplateId(fallbackTemplate?.id || null);
    setTemplateDraft(
      fallbackTemplate ? toEditableTemplate(fallbackTemplate) : createEmptyTemplate(),
    );
    setTemplateNotice('Template deleted');
  };

  const handleAiAction = async (action: 'generate' | 'refine' | 'subject' | 'follow-up') => {
    if (action === 'follow-up') {
      setIsGenerating(true);
      setFeedback(null);

      try {
        const response = await fetch('/api/ai/follow-up', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            subject,
            body,
            instruction: aiPrompt,
            investor: selectedInvestor,
            vaultData,
          }),
        });

        const result = await parseJsonResponse<{
          provider: string;
          subject: string;
          body: string;
        }>(response);

        setSubject(result.subject);
        setBody(result.body);
        setAiPrompt('');
        setTemplateNotice('Vertex follow-up draft ready');
      } catch (error) {
        console.error('Follow-up AI error:', error);
        alert(error instanceof Error ? error.message : 'Failed to generate a follow-up email.');
      } finally {
        setIsGenerating(false);
      }

      return;
    }

    if (!ai) {
      alert("VITE_GEMINI_API_KEY is not configured.");
      return;
    }

    setIsGenerating(true);
    setFeedback(null);
    try {
      const context = buildVaultPromptContext(vaultData, {
        documentLimit: 5,
        charsPerDocument: 1000,
      });

      let prompt = '';
      if (action === 'generate') {
        prompt = `Draft a professional investor outreach email for ${BRAND_NAME} based on this request: "${aiPrompt}".

        Critical instructions:
        1. Treat the company vault below as the source of truth for ${BRAND_NAME}.
        2. Do not invent traction, metrics, customers, pilots, partnerships, or claims that are not present in the vault.
        3. If a target investor profile is provided, use Google Search to find recent, factual context about that investor or firm and tailor the email to their thesis.
        4. Use the strongest proof points from the vault when they are relevant.
        5. Keep the email concise, credible, and written for a real investor.
        6. Write from the perspective of ${BRAND_NAME}.
        7. If you include a sign-off, sign it as ${BRAND_NAME}.
        8. Return only the email body as HTML.

        Company vault:
        ${context}`;
      } else if (action === 'refine') {
        prompt = `Refine and improve this investor outreach email body: "${body}".

        Instructions:
        1. Keep the company facts aligned with the vault below.
        2. Do not add claims that are not supported by the vault.
        3. Make it more personalized to the target investor if a profile is provided.
        4. Improve clarity, confidence, and the call to action.
        5. Keep the sender identity aligned with ${BRAND_NAME}.
        6. Return only the email body as HTML.

        Company vault:
        ${context}`;
      } else if (action === 'subject') {
        prompt = `Suggest 3 compelling subject lines for this investor email body: "${body}".

        Instructions:
        1. Use the target investor's firm name or focus area if provided.
        2. Keep them personal and credible, not spammy.
        3. Align them with the company vault below.
        4. Make them clearly about ${BRAND_NAME}, not a generic startup.
        5. Return only the 3 subject lines separated by newlines.

        Company vault:
        ${context}`;
      }

      if (selectedInvestor) {
        prompt += `\nTarget investor profile:
        - Name: ${selectedInvestor.name}
        - Firm: ${selectedInvestor.firm}
        - Focus: ${selectedInvestor.focus.join(', ')}
        - Bio: ${selectedInvestor.bio}
        - Latest summary: ${selectedInvestor.latestSummary || 'Not available'}
        - Latest news: ${(selectedInvestor.latestNews || []).join('; ') || 'Not available'}
        - Pain points: ${(selectedInvestor.painPoints || []).join('; ') || 'Not available'}
        - Financial goals: ${(selectedInvestor.financialGoals || []).join('; ') || 'Not available'}`;
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
    (inv.firm || '').toLowerCase().includes(investorSearch.toLowerCase())
  );

  const selectInvestor = (inv: Investor) => {
    setSelectedInvestor(inv);
    setTo(inv.email || '');
    setSubject(`Intro: ${BRAND_NAME} x ${inv.firm || inv.name}`);
    setShowInvestorPicker(false);
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="min-h-16 border-b border-zinc-800 bg-zinc-950/50 px-4 py-3 backdrop-blur md:h-16 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <h2 className="text-xl font-bold text-white">Compose</h2>
          {selectedInvestor && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <InvestorAvatar
                imageUrl={selectedInvestor.imageUrl}
                name={selectedInvestor.name}
                className="h-4 w-4 object-cover"
              />
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:justify-end">
          <button 
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-white sm:w-auto"
          >
            <FileText size={16} />
            Templates
            <ChevronDown size={14} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowInvestorPicker(!showInvestorPicker)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-white sm:w-auto"
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
                  className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
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
                          <InvestorAvatar
                            imageUrl={inv.imageUrl}
                            name={inv.name}
                            className="h-8 w-8 object-cover"
                          />
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
      </div>

      {/* Templates Dropdown */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="max-h-[78vh] overflow-y-auto border-b border-zinc-800 bg-zinc-900"
          >
            <div className="p-4 md:p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Template Library</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Choose, edit, save, and reuse outreach templates directly from Compose.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {templateNotice && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
                      {templateNotice}
                    </span>
                  )}
                  <button
                    onClick={handleNewTemplate}
                    className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                  >
                    <FileText size={14} />
                    New Template
                  </button>
                  <button
                    onClick={handleSaveCurrentDraftAsTemplate}
                    className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-500/20"
                  >
                    <Plus size={14} />
                    Save Draft as Template
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60">
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      Saved Templates
                    </p>
                  </div>
                  <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
                    {templateLibrary.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => selectTemplateForEditing(template)}
                        className={`w-full rounded-2xl border p-4 text-left transition-all ${
                          selectedTemplateId === template.id
                            ? 'border-blue-500/40 bg-blue-500/10'
                            : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 hover:bg-zinc-800/70'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-white">{template.name}</p>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                              template.origin === 'custom'
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {template.origin === 'custom' ? 'Custom' : 'Starter'}
                          </span>
                        </div>
                        <p className="mb-2 text-xs text-zinc-500">{template.description || 'No description yet.'}</p>
                        <p className="line-clamp-2 text-xs text-zinc-400">{template.subject}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60">
                  <div className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Inline Editor
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Edit here, then use the template directly in outreach.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => applyTemplate({
                          name: templateDraft.name || 'Untitled Template',
                          subject: templateDraft.subject,
                          body: templateDraft.body,
                        })}
                        disabled={!templateDraft.subject.trim() || !templateDraft.body.trim()}
                        className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-40"
                      >
                        Use in Compose
                      </button>
                      <button
                        onClick={handleSaveTemplate}
                        disabled={!templateDraft.name.trim() || !templateDraft.subject.trim() || !templateDraft.body.trim()}
                        className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-40"
                      >
                        Save Template
                      </button>
                      <button
                        onClick={handleDeleteTemplate}
                        disabled={!selectedTemplate || !isCustomTemplate(selectedTemplate)}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    {selectedTemplate?.origin === 'default' && (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                        You are editing a starter template. Saving will create a custom copy in your library.
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                          Template Name
                        </span>
                        <input
                          type="text"
                          value={templateDraft.name}
                          onChange={(event) => updateTemplateDraft({ name: event.target.value })}
                          placeholder="Founder intro, thesis fit, follow-up..."
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                          Description
                        </span>
                        <input
                          type="text"
                          value={templateDraft.description}
                          onChange={(event) => updateTemplateDraft({ description: event.target.value })}
                          placeholder="When to use this template"
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Subject Template
                      </span>
                      <input
                        type="text"
                        value={templateDraft.subject}
                        onChange={(event) => updateTemplateDraft({ subject: event.target.value })}
                        placeholder="[Brand Name] x [Firm Name]"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </label>

                    <div>
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Body Template
                      </span>
                      <div className="template-library-editor overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                        <ReactQuill
                          theme="snow"
                          value={templateDraft.body}
                          onChange={(value) => updateTemplateDraft({ body: value })}
                          modules={TEMPLATE_QUILL_MODULES}
                          formats={TEMPLATE_QUILL_FORMATS}
                          placeholder="Hi [Investor Name], ..."
                        />
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Placeholders
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['[Brand Name]', '[My Name]', '[Investor Name]', '[Investor Full Name]', '[Firm Name]', '[Industry]', '[Specific Area]'].map((token) => (
                          <span
                            key={token}
                            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400"
                          >
                            {token}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden bg-zinc-950 p-3 md:p-6">
        <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/30 shadow-2xl">
          <div className="flex flex-col gap-2 border-b border-zinc-800 px-4 py-4 md:flex-row md:items-center md:gap-4 md:px-6">
            <span className="text-sm font-medium text-zinc-500 md:w-16">From</span>
            <div className="flex-1">
              <p className="text-sm text-white">{SENDER_IDENTITY}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Outbound emails are drafted and sent as {BRAND_NAME}.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-b border-zinc-800 px-4 py-4 md:flex-row md:items-center md:gap-4 md:px-6">
            <span className="text-sm font-medium text-zinc-500 md:w-16">To</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-zinc-700"
              placeholder="investor@firm.com"
            />
          </div>
          {(vaultData.emailGuidance || vaultData.proofPoints.length > 0) && (
            <div className="border-b border-zinc-800 bg-zinc-950/60 px-4 py-4 md:px-6">
              <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Novalyte AI Email Guidance
                  </p>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {vaultData.emailGuidance || 'Analyze the Novalyte Vault to generate tighter outreach guidance.'}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Proof Points To Use
                  </p>
                  {vaultData.proofPoints.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Analyze the vault to pull the strongest proof points into compose.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {vaultData.proofPoints.slice(0, 4).map((point) => (
                        <span
                          key={point}
                          className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 border-b border-zinc-800 px-4 py-4 md:flex-row md:items-center md:gap-4 md:px-6">
            <span className="text-sm font-medium text-zinc-500 md:w-16">Subject</span>
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
            <div className="compose-ai-bar">
              <div className="compose-ai-shell bg-zinc-900/90 backdrop-blur-xl border border-zinc-700 rounded-2xl p-2 shadow-2xl flex items-center gap-2">
                <div className="p-2 text-blue-400">
                  <Sparkles size={20} />
                </div>
                <input 
                  type="text"
                  placeholder="Ask AI to draft, refine, or create a follow-up..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiAction('generate')}
                  className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                />
                <div className="compose-ai-actions flex items-center gap-1">
                  <button 
                    onClick={() => handleAiAction('follow-up')}
                    disabled={isGenerating}
                    className="px-3 py-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                  >
                    Follow Up
                  </button>
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
          <div className="flex flex-col gap-4 border-t border-zinc-800 bg-zinc-900/50 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex w-full items-center overflow-hidden rounded-2xl bg-white shadow-lg sm:w-auto">
                <button 
                  onClick={() => handleSend(false)}
                  disabled={isSending}
                  className="flex flex-1 items-center justify-center gap-2 border-r border-zinc-200 bg-white px-6 py-3 text-sm font-bold text-zinc-900 transition-all hover:bg-zinc-200 disabled:opacity-50 sm:flex-none sm:px-8"
                >
                  {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  {isSending ? 'Sending...' : 'Send'}
                </button>
                <button 
                  onClick={() => setShowSchedule(!showSchedule)}
                  className="bg-white px-3 py-3 text-zinc-900 transition-all hover:bg-zinc-200"
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
                    className="absolute bottom-24 left-3 right-3 z-50 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl sm:left-6 sm:right-auto sm:w-72"
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
              
              <div className="flex items-center gap-1 border-zinc-800 sm:ml-4 sm:border-l sm:pl-4">
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
          padding: 24px 24px 160px;
          line-height: 1.6;
        }
        .ql-editor.ql-blank::before {
          color: #3f3f46;
          font-style: normal;
          left: 24px;
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
        .template-library-editor .ql-toolbar.ql-snow {
          padding: 10px 12px;
          background: rgba(9, 9, 11, 0.9);
        }
        .template-library-editor .ql-container.ql-snow {
          min-height: 220px;
          font-size: 14px;
        }
        .template-library-editor .ql-editor {
          min-height: 220px;
          padding: 18px;
        }
        .template-library-editor .ql-editor.ql-blank::before {
          left: 18px;
        }
        .compose-ai-bar {
          position: absolute;
          left: 50%;
          bottom: 1.5rem;
          width: 100%;
          max-width: 42rem;
          transform: translateX(-50%);
          padding: 0 1rem;
          z-index: 10;
        }
        @media (max-width: 767px) {
          .ql-editor {
            padding: 18px 16px 24px;
          }
          .ql-editor.ql-blank::before {
            left: 16px;
          }
          .compose-ai-bar {
            position: static;
            max-width: none;
            transform: none;
            padding: 0.75rem;
          }
          .compose-ai-shell {
            flex-direction: column;
            align-items: stretch;
          }
          .compose-ai-actions {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}
