import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Type } from '@google/genai';
import {
  Check,
  Clipboard,
  Database,
  FileText,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { clientGemini as ai } from '../lib/env';
import {
  buildVaultPromptContext,
  loadVaultData,
  saveVaultData,
  subscribeToVaultChanges,
  VaultData,
  VaultDocument,
  VaultDocumentSource,
} from '../lib/vault';

interface DocumentDraft {
  title: string;
  content: string;
  editingDocumentId: string | null;
}

const DOCUMENT_DRAFT_STORAGE_KEY = 'novalyte_vault_document_draft';
const EMPTY_DOCUMENT_DRAFT: DocumentDraft = {
  title: '',
  content: '',
  editingDocumentId: null,
};

function loadDocumentDraft(): DocumentDraft {
  if (typeof window === 'undefined') {
    return EMPTY_DOCUMENT_DRAFT;
  }

  try {
    const raw = window.localStorage.getItem(DOCUMENT_DRAFT_STORAGE_KEY);
    if (!raw) {
      return EMPTY_DOCUMENT_DRAFT;
    }

    const parsed = JSON.parse(raw) as Partial<DocumentDraft>;
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      content: typeof parsed.content === 'string' ? parsed.content : '',
      editingDocumentId:
        typeof parsed.editingDocumentId === 'string' ? parsed.editingDocumentId : null,
    };
  } catch (error) {
    console.error('Failed to load document draft', error);
    return EMPTY_DOCUMENT_DRAFT;
  }
}

function saveDocumentDraft(draft: DocumentDraft) {
  if (typeof window === 'undefined') return;

  if (!draft.title.trim() && !draft.content.trim() && !draft.editingDocumentId) {
    window.localStorage.removeItem(DOCUMENT_DRAFT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(DOCUMENT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function createVaultDocument(
  title: string,
  content: string,
  source: VaultDocumentSource,
): VaultDocument {
  const now = new Date().toISOString();
  return {
    id: `vault-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    content,
    source,
    createdAt: now,
    updatedAt: now,
  };
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function suggestDocumentTitle(content: string, fallbackPrefix: string): string {
  const firstMeaningfulLine = content
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find(Boolean);

  if (firstMeaningfulLine) {
    return firstMeaningfulLine.length > 70
      ? `${firstMeaningfulLine.slice(0, 67)}...`
      : firstMeaningfulLine;
  }

  return `${fallbackPrefix} ${new Date().toLocaleString()}`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString();
}

function sourceLabel(source: VaultDocumentSource): string {
  if (source === 'paste') return 'Pasted';
  if (source === 'upload') return 'Uploaded';
  if (source === 'research') return 'Research';
  return 'Manual note';
}

function uniqueTrimmedStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
}

export function NovalyteVault() {
  const [data, setData] = useState<VaultData>(() => loadVaultData());
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft>(() => loadDocumentDraft());
  const [isSaved, setIsSaved] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    setData(loadVaultData());
    return subscribeToVaultChanges(setData);
  }, []);

  useEffect(() => {
    saveDocumentDraft(documentDraft);
  }, [documentDraft]);

  useEffect(() => {
    if (!isSaved) return;
    const timeout = window.setTimeout(() => setIsSaved(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [isSaved]);

  const documentCountLabel = useMemo(() => {
    const count = data.documents.length;
    return `${count} document${count === 1 ? '' : 's'} saved`;
  }, [data.documents.length]);

  const persistVault = (nextData: VaultData) => {
    const savedData = saveVaultData(nextData);
    setData(savedData);
    setIsSaved(true);
    return savedData;
  };

  const handleFieldChange = (field: keyof VaultData, value: string) => {
    persistVault({
      ...data,
      [field]: value,
    });
  };

  const handleSave = () => {
    persistVault(data);
  };

  const handlePasteDocument = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        alert('Clipboard is empty.');
        return;
      }

      const document = createVaultDocument(
        suggestDocumentTitle(text, 'Pasted document'),
        text,
        'paste',
      );
      const latestData = loadVaultData();

      persistVault({
        ...latestData,
        documents: [document, ...latestData.documents],
      });
    } catch (error) {
      console.error('Failed to read clipboard contents', error);
      alert('Failed to read clipboard. Please allow clipboard access or paste into the editor below.');
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const inputFiles = event.target.files;
    if (!inputFiles || inputFiles.length === 0) return;

    const files: File[] = Array.from(inputFiles);

    try {
      const loadedDocuments = await Promise.all(
        files.map(async (file) => {
          const text = await readFileAsText(file);
          if (!text.trim()) return null;
          return createVaultDocument(file.name, text, 'upload');
        }),
      );

      const nextDocuments = loadedDocuments.filter(
        (document): document is VaultDocument => Boolean(document),
      );

      if (nextDocuments.length === 0) {
        alert('No readable text content was found in the selected files.');
        return;
      }
      const latestData = loadVaultData();

      persistVault({
        ...latestData,
        documents: [...nextDocuments, ...latestData.documents],
      });
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to import one or more files.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveDocument = (source: VaultDocumentSource = 'note') => {
    const title = documentDraft.title.trim();
    const content = documentDraft.content.trim();

    if (!content) {
      alert('Add document content before saving.');
      return;
    }

    if (documentDraft.editingDocumentId) {
      const nextDocuments = data.documents.map((document) =>
        document.id === documentDraft.editingDocumentId
          ? {
              ...document,
              title: title || document.title,
              content,
              updatedAt: new Date().toISOString(),
            }
          : document,
      );

      persistVault({
        ...data,
        documents: nextDocuments.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      });
    } else {
      const document = createVaultDocument(
        title || suggestDocumentTitle(content, 'Vault note'),
        content,
        source,
      );

      persistVault({
        ...data,
        documents: [document, ...data.documents],
      });
    }

    setDocumentDraft(EMPTY_DOCUMENT_DRAFT);
  };

  const handleEditDocument = (document: VaultDocument) => {
    setDocumentDraft({
      title: document.title,
      content: document.content,
      editingDocumentId: document.id,
    });
  };

  const handleDeleteDocument = (documentId: string) => {
    const document = data.documents.find((item) => item.id === documentId);
    if (!document) return;

    if (!confirm(`Delete "${document.title}" from the vault?`)) {
      return;
    }

    persistVault({
      ...data,
      documents: data.documents.filter((item) => item.id !== documentId),
    });

    if (documentDraft.editingDocumentId === documentId) {
      setDocumentDraft(EMPTY_DOCUMENT_DRAFT);
    }
  };

  const handleIndustryResearch = async () => {
    if (!ai) {
      alert('VITE_GEMINI_API_KEY is not configured.');
      return;
    }

    setIsResearching(true);
    try {
      const context = buildVaultPromptContext(data, {
        documentLimit: 4,
        charsPerDocument: 900,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Research current market and investor trends that matter for Novalyte AI.

Use the company context below to focus the research.
Return concise bullet points covering:
1. Market movements or category tailwinds.
2. Recent regulatory or policy shifts.
3. Investor behavior or funding themes that matter for this company.
4. Messaging angles Novalyte AI should emphasize in investor outreach.

Company context:
${context}`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const researchText = response.text || '';
      if (!researchText.trim()) {
        alert('No research was returned.');
        return;
      }

      const researchDocument = createVaultDocument(
        `Market research ${new Date().toLocaleDateString()}`,
        researchText,
        'research',
      );
      const latestData = loadVaultData();

      persistVault({
        ...latestData,
        documents: [researchDocument, ...latestData.documents],
      });
    } catch (error) {
      console.error('Research error:', error);
      alert('Failed to research the market. Please try again.');
    } finally {
      setIsResearching(false);
    }
  };

  const handleAnalyzeVault = async () => {
    if (!ai) {
      alert('VITE_GEMINI_API_KEY is not configured.');
      return;
    }

    const hasContext =
      data.documents.length > 0 ||
      data.overview.trim() ||
      data.traction.trim() ||
      data.ask.trim() ||
      data.usps.trim() ||
      data.updates.trim();

    if (!hasContext) {
      alert('Add company information or documents before running analysis.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const context = buildVaultPromptContext(data, {
        documentLimit: 8,
        charsPerDocument: 1500,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this Novalyte AI company vault.

Rules:
1. Use only the information in the vault.
2. Do not invent metrics, claims, partnerships, customers, or clinical outcomes.
3. Consolidate repeated facts and keep the output investor-ready.
4. Focus on what helps investor matching and outreach.

Return JSON with:
- knowledgeSummary: a clear company summary for internal use.
- investorFitSummary: what types of investors are best aligned.
- emailGuidance: how to position the company in investor outreach.
- investorKeywords: 8 to 12 short phrases for investor matching.
- proofPoints: 4 to 8 concrete proof points taken from the vault.

Company vault:
${context}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              knowledgeSummary: { type: Type.STRING },
              investorFitSummary: { type: Type.STRING },
              emailGuidance: { type: Type.STRING },
              investorKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              proofPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'knowledgeSummary',
              'investorFitSummary',
              'emailGuidance',
              'investorKeywords',
              'proofPoints',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}') as Record<string, unknown>;
      const latestData = loadVaultData();

      persistVault({
        ...latestData,
        knowledgeSummary:
          typeof parsed.knowledgeSummary === 'string' ? parsed.knowledgeSummary.trim() : '',
        investorFitSummary:
          typeof parsed.investorFitSummary === 'string' ? parsed.investorFitSummary.trim() : '',
        emailGuidance:
          typeof parsed.emailGuidance === 'string' ? parsed.emailGuidance.trim() : '',
        investorKeywords: uniqueTrimmedStrings(parsed.investorKeywords).slice(0, 12),
        proofPoints: uniqueTrimmedStrings(parsed.proofPoints).slice(0, 8),
        lastAnalyzedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Vault analysis error:', error);
      alert('Failed to analyze the vault. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mb-2 flex items-center gap-3 text-2xl font-bold text-white md:text-3xl">
            <Database className="text-blue-500" size={24} />
            Novalyte Vault
          </h2>
          <p className="max-w-3xl text-sm text-zinc-400 md:text-base">
            Save every Novalyte AI note, spec, and research document in local storage. The vault
            intelligence feeds both investor matching and email drafting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAnalyzeVault}
            disabled={isAnalyzing}
            className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50 md:text-sm"
          >
            {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Analyze Vault
          </button>
          <button
            onClick={handleIndustryResearch}
            disabled={isResearching}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50 md:text-sm"
          >
            {isResearching ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Research
          </button>
          <button
            onClick={handlePasteDocument}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-zinc-700 md:text-sm"
          >
            <Clipboard size={16} />
            Paste & Save
          </button>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-zinc-700 md:text-sm">
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.json,.csv,text/plain,text/markdown,application/json"
              multiple
              onChange={handleFileUpload}
            />
            <Upload size={16} />
            Upload Files
          </label>
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-blue-500 md:text-sm"
          >
            {isSaved ? <Check size={16} /> : <Save size={16} />}
            {isSaved ? 'Saved' : 'Save Fields'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Storage</p>
          <p className="mt-2 text-sm font-medium text-white">Local browser storage</p>
          <p className="mt-1 text-xs text-zinc-500">Every vault field auto-saves as you type.</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Documents</p>
          <p className="mt-2 text-sm font-medium text-white">{documentCountLabel}</p>
          <p className="mt-1 text-xs text-zinc-500">New notes stack onto the existing company context.</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Last Saved</p>
          <p className="mt-2 text-sm font-medium text-white">{formatTimestamp(data.lastSavedAt)}</p>
          <p className="mt-1 text-xs text-zinc-500">Current browser copy of the vault.</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Last Analyzed</p>
          <p className="mt-2 text-sm font-medium text-white">{formatTimestamp(data.lastAnalyzedAt)}</p>
          <p className="mt-1 text-xs text-zinc-500">Refresh this after adding new material.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="mb-5">
              <h3 className="text-lg font-bold text-white">Structured Company Profile</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Keep the core pitch current. These fields are part of the persistent vault.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-blue-400">
                  Overview
                </label>
                <textarea
                  value={data.overview}
                  onChange={(event) => handleFieldChange('overview', event.target.value)}
                  className="h-36 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="What Novalyte AI does, who it serves, and why it matters."
                />
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-green-400">
                  Traction
                </label>
                <textarea
                  value={data.traction}
                  onChange={(event) => handleFieldChange('traction', event.target.value)}
                  className="h-36 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200 outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder="Validated pilots, revenue, users, partnerships, launch signals, or measurable momentum."
                />
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-purple-400">
                  Ask
                </label>
                <textarea
                  value={data.ask}
                  onChange={(event) => handleFieldChange('ask', event.target.value)}
                  className="h-36 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200 outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  placeholder="Round, use of funds, and what kind of investor is most relevant."
                />
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">
                  Unique Selling Points
                </label>
                <textarea
                  value={data.usps}
                  onChange={(event) => handleFieldChange('usps', event.target.value)}
                  className="h-36 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200 outline-none transition-all focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
                  placeholder="What is technically or commercially differentiated about Novalyte AI."
                />
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-orange-400">
                  Booking Link
                </label>
                <input
                  type="text"
                  value={data.calendlyLink}
                  onChange={(event) => handleFieldChange('calendlyLink', event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-200 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  placeholder="https://calendly.com/..."
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Used in outreach CTA when you want meetings booked directly.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <label className="mb-3 block text-xs font-bold uppercase tracking-[0.18em] text-pink-400">
                  Recent Updates
                </label>
                <textarea
                  value={data.updates}
                  onChange={(event) => handleFieldChange('updates', event.target.value)}
                  className="h-36 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200 outline-none transition-all focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                  placeholder="Fresh updates worth mentioning in investor outreach."
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {documentDraft.editingDocumentId ? 'Edit Vault Document' : 'Add Vault Document'}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Use this for pasted notes, product docs, investor memos, or anything else the
                  engine should remember.
                </p>
              </div>
              {documentDraft.editingDocumentId && (
                <button
                  onClick={() => setDocumentDraft(EMPTY_DOCUMENT_DRAFT)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={documentDraft.title}
                onChange={(event) =>
                  setDocumentDraft((current) => ({ ...current, title: event.target.value }))
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Document title"
              />
              <textarea
                value={documentDraft.content}
                onChange={(event) =>
                  setDocumentDraft((current) => ({ ...current, content: event.target.value }))
                }
                className="h-72 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Paste or write more Novalyte AI context here. This draft is also kept in local storage until you save it into the vault."
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">
                  Draft state is persisted locally even before you press save.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDocumentDraft(EMPTY_DOCUMENT_DRAFT)}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-bold text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
                  >
                    Clear Draft
                  </button>
                  <button
                    onClick={() => handleSaveDocument('note')}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
                  >
                    {documentDraft.editingDocumentId ? 'Update Document' : 'Add To Vault'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="mb-5 flex items-center gap-3">
              <FileText className="text-blue-400" size={20} />
              <div>
                <h3 className="text-lg font-bold text-white">Saved Documents</h3>
                <p className="text-sm text-zinc-500">
                  Everything here is persisted and included in future analysis.
                </p>
              </div>
            </div>

            {data.documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-8 text-center text-sm text-zinc-500">
                No vault documents yet. Paste, upload, or add a note to start building Novalyte AI
                context.
              </div>
            ) : (
              <div className="space-y-3">
                {data.documents.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{document.title}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                          <span>{sourceLabel(document.source)}</span>
                          <span>Updated {formatTimestamp(document.updatedAt)}</span>
                          <span>{document.content.length.toLocaleString()} chars</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => handleEditDocument(document)}
                          className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
                          title="Edit document"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(document.id)}
                          className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400"
                          title="Delete document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                      {document.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Vault Intelligence</h3>
                <p className="text-sm text-zinc-500">
                  This is the distilled context used for investor search and outreach prompts.
                </p>
              </div>
              <button
                onClick={handleAnalyzeVault}
                disabled={isAnalyzing}
                className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
              >
                {isAnalyzing ? 'Analyzing...' : 'Refresh'}
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Knowledge Summary
                </p>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-relaxed text-zinc-300">
                  {data.knowledgeSummary || 'Run Analyze Vault after adding documents to generate a company summary.'}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Ideal Investor Fit
                </p>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-relaxed text-zinc-300">
                  {data.investorFitSummary || 'Investor-fit guidance will appear here after analysis.'}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Email Guidance
                </p>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-relaxed text-zinc-300">
                  {data.emailGuidance || 'Outreach guidance will appear here after analysis.'}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Match Keywords
                </p>
                {data.investorKeywords.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
                    Analyze the vault to generate investor matching keywords.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.investorKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Proof Points
                </p>
                {data.proofPoints.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
                    Analyze the vault to extract the strongest proof points for email drafting.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.proofPoints.map((point) => (
                      <div
                        key={point}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300"
                      >
                        {point}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
