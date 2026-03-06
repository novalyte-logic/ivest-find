import { useState, useEffect } from 'react';
import { Investor } from '../data/investors';
import { X, Save, Edit2, Trash2, Plus, Tag, Linkedin, ExternalLink, Sparkles, Search, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InvestorAvatar } from './InvestorAvatar';
import { parseJsonResponse } from '../lib/http';
import {
  InvestorContactResponse,
  InvestorIntelProviderStatus,
  loadProviderPreferences,
  pickContactProvider,
  pickSearchProvider,
  ProviderPreferences,
  saveProviderPreferences,
} from '../lib/investor-intel';

interface InvestorDetailModalProps {
  investor: Investor | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedInvestor: Investor) => void;
  onDraftOutreach: (investor: Investor) => void;
  onToggleInterested?: (investor: Investor) => void;
  isInterested?: boolean;
}

const CONTACT_PREFERENCES = ['Email', 'LinkedIn', 'Twitter / X', 'Warm Intro', 'Other'];

export function InvestorDetailModal({ 
  investor, 
  isOpen, 
  onClose, 
  onSave,
  onDraftOutreach,
  onToggleInterested,
  isInterested
}: InvestorDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInvestor, setEditedInvestor] = useState<Investor | null>(null);
  const [newTag, setNewTag] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [isFindingContact, setIsFindingContact] = useState(false);
  const [providerStatus, setProviderStatus] = useState<InvestorIntelProviderStatus | null>(null);
  const [providerPreferences, setProviderPreferences] = useState<ProviderPreferences>(() => loadProviderPreferences());

  useEffect(() => {
    if (investor) {
      setEditedInvestor({ ...investor });
      setIsEditing(false);
      setNewTag('');
    }
  }, [investor]);

  useEffect(() => {
    const loadProviderStatus = async () => {
      if (!isOpen) return;

      try {
        const response = await fetch('/api/investor-intel/providers', {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        });
        const result = await parseJsonResponse<InvestorIntelProviderStatus>(response);
        setProviderStatus(result);
        setProviderPreferences((current) => ({
          searchProvider: pickSearchProvider(result.searchProviders, current.searchProvider),
          contactProvider: pickContactProvider(result.contactProviders, current.contactProvider),
        }));
      } catch (error) {
        console.error('Failed to load provider status', error);
      }
    };

    void loadProviderStatus();
  }, [isOpen]);

  useEffect(() => {
    saveProviderPreferences(providerPreferences);
  }, [providerPreferences]);

  if (!investor || !editedInvestor) return null;

  const handleResearch = async () => {
    setIsResearching(true);
    try {
      const response = await fetch('/api/investor-intel/research', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          investor: editedInvestor,
          searchProvider: providerPreferences.searchProvider,
        }),
      });
      const result = await parseJsonResponse<InvestorContactResponse>(response);
      const updated = result.investor;
      
      setEditedInvestor(updated);
      onSave(updated);
      alert("Investor profile enriched with live market and news data.");
    } catch (error) {
      console.error("Research error:", error);
      alert(error instanceof Error ? error.message : "Failed to research investor. Please try again.");
    } finally {
      setIsResearching(false);
    }
  };

  const handleFindContact = async () => {
    if (providerPreferences.contactProvider === 'none') {
      alert('Choose a contact verification provider first.');
      return;
    }

    setIsFindingContact(true);
    try {
      const response = await fetch('/api/investor-intel/contact', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          investor: editedInvestor,
          contactProvider: providerPreferences.contactProvider,
        }),
      });
      const result = await parseJsonResponse<InvestorContactResponse>(response);
      setEditedInvestor(result.investor);
      onSave(result.investor);
    } catch (error) {
      console.error('Contact lookup error:', error);
      alert(error instanceof Error ? error.message : 'Failed to find contact.');
    } finally {
      setIsFindingContact(false);
    }
  };

  const handleSave = () => {
    onSave(editedInvestor);
    setIsEditing(false);
  };

  const handleChange = (field: keyof Investor, value: any) => {
    setEditedInvestor(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleArrayChange = (field: 'focus' | 'industryExpertise' | 'notableInvestments', value: string) => {
    const array = value.split(',').map(s => s.trim());
    handleChange(field, array);
  };

  const addTag = () => {
    if (newTag.trim() && !editedInvestor.tags.includes(newTag.trim())) {
      const updatedTags = [...editedInvestor.tags, newTag.trim()];
      handleChange('tags', updatedTags);
      setNewTag('');
      // Auto-save tags for better UX
      if (!isEditing) {
        onSave({ ...editedInvestor, tags: updatedTags });
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = editedInvestor.tags.filter(t => t !== tagToRemove);
    handleChange('tags', updatedTags);
    if (!isEditing) {
      onSave({ ...editedInvestor, tags: updatedTags });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-zinc-950 border border-zinc-800 md:rounded-2xl w-full max-w-3xl h-full md:h-auto md:max-h-[90vh] overflow-y-auto shadow-2xl pointer-events-auto flex flex-col">
              
              {/* Header */}
              <div className="p-4 md:p-6 border-b border-zinc-800 flex justify-between items-start sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
                <div className="flex items-center gap-3 md:gap-4">
                  <InvestorAvatar
                    imageUrl={editedInvestor.imageUrl}
                    name={editedInvestor.name}
                    className="h-12 w-12 border-2 border-zinc-800 object-cover md:h-16 md:w-16"
                  />
                  <div>
                    {isEditing ? (
                      <input 
                        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-lg md:text-xl font-bold text-white w-full mb-1"
                        value={editedInvestor.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl md:text-2xl font-bold text-white">{investor?.name}</h2>
                        {investor?.linkedinUrl && (
                          <a 
                            href={investor.linkedinUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <Linkedin size={18} />
                          </a>
                        )}
                      </div>
                    )}
                    
                    {isEditing ? (
                      <input 
                        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-400 w-full"
                        value={editedInvestor.role}
                        onChange={(e) => handleChange('role', e.target.value)}
                      />
                    ) : (
                      <p className="text-zinc-400">{investor.role} {investor.firm && `at ${investor.firm}`}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isEditing && (
                    <button 
                      onClick={() => onToggleInterested?.(investor)}
                      className={`p-2 rounded-lg transition-colors border ${
                        isInterested ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border-zinc-800'
                      }`}
                      title={isInterested ? "Remove from interested" : "Mark as interested"}
                    >
                      <Star size={18} fill={isInterested ? "currentColor" : "none"} />
                    </button>
                  )}
                  {!isEditing && (
                    <button 
                      onClick={handleResearch}
                      disabled={isResearching}
                      className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors flex items-center gap-2 border border-blue-500/20 disabled:opacity-50"
                      title="Research with the selected provider"
                    >
                      {isResearching ? (
                        <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      ) : (
                        <Sparkles size={18} />
                      )}
                      <span className="hidden md:inline">Research & Enrich</span>
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      onClick={handleFindContact}
                      disabled={isFindingContact || providerPreferences.contactProvider === 'none'}
                      className="p-2 bg-zinc-900 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2 border border-zinc-800 disabled:opacity-50"
                      title="Find the right contact with the selected provider"
                    >
                      {isFindingContact ? (
                        <div className="w-4 h-4 border-2 border-zinc-400/30 border-t-zinc-200 rounded-full animate-spin" />
                      ) : (
                        <Search size={18} />
                      )}
                      <span className="hidden md:inline">Find Contact</span>
                    </button>
                  )}
                  {isEditing ? (
                    <button 
                      onClick={handleSave}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Save size={18} /> Save
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="p-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2"
                    >
                      <Edit2 size={18} /> Edit
                    </button>
                  )}
                  <button 
                    onClick={onClose}
                    className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 md:p-8 space-y-6 md:space-y-8">
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Research Provider
                      </span>
                      <select
                        value={providerPreferences.searchProvider}
                        onChange={(event) =>
                          setProviderPreferences((current) => ({
                            ...current,
                            searchProvider: event.target.value as ProviderPreferences['searchProvider'],
                          }))
                        }
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        {(providerStatus?.searchProviders || []).filter((provider) => provider.implemented && provider.configured).map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Contact Provider
                      </span>
                      <select
                        value={providerPreferences.contactProvider}
                        onChange={(event) =>
                          setProviderPreferences((current) => ({
                            ...current,
                            contactProvider: event.target.value as ProviderPreferences['contactProvider'],
                          }))
                        }
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        {(providerStatus?.contactProviders || []).filter((provider) => provider.implemented && provider.configured).map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                {editedInvestor.latestSummary && (
                  <section>
                    <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Live Summary</h3>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-zinc-300 leading-relaxed">
                      {editedInvestor.latestSummary}
                    </div>
                  </section>
                )}

                {(editedInvestor.latestNews?.length || editedInvestor.painPoints?.length || editedInvestor.financialGoals?.length) && (
                  <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Latest News</h3>
                      <div className="space-y-2">
                        {(editedInvestor.latestNews || []).map((item) => (
                          <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Pain Points</h3>
                      <div className="space-y-2">
                        {(editedInvestor.painPoints || []).map((item) => (
                          <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Financial Goals</h3>
                      <div className="space-y-2">
                        {(editedInvestor.financialGoals || []).map((item) => (
                          <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
                
                {/* Tags Section */}
                <section>
                  <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Tag size={14} /> Tags
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editedInvestor.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30 flex items-center gap-2">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-white">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Add a tag (e.g., 'Met in person')"
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 w-full max-w-xs"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    />
                    <button 
                      onClick={addTag}
                      disabled={!newTag.trim()}
                      className="p-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </section>

                {/* Bio */}
                <section>
                  <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Biography</h3>
                  {isEditing ? (
                    <textarea 
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-zinc-200 min-h-[100px]"
                      value={editedInvestor.bio}
                      onChange={(e) => handleChange('bio', e.target.value)}
                    />
                  ) : (
                    <p className="text-zinc-300 leading-relaxed">{investor.bio}</p>
                  )}
                </section>

                {/* Investment Thesis */}
                <section>
                  <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Investment Thesis</h3>
                  {isEditing ? (
                    <textarea 
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-zinc-200"
                      value={editedInvestor.investmentThesis}
                      onChange={(e) => handleChange('investmentThesis', e.target.value)}
                    />
                  ) : (
                    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl italic text-zinc-300">
                      "{investor.investmentThesis}"
                    </div>
                  )}
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Focus Areas */}
                  <section>
                    <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Focus Areas</h3>
                    {isEditing ? (
                      <input 
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
                        value={editedInvestor.focus.join(', ')}
                        onChange={(e) => handleArrayChange('focus', e.target.value)}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {investor.focus.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Industry Expertise */}
                  <section>
                    <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Industry Expertise</h3>
                    {isEditing ? (
                      <input 
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
                        value={editedInvestor.industryExpertise.join(', ')}
                        onChange={(e) => handleArrayChange('industryExpertise', e.target.value)}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {investor.industryExpertise.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Notable Investments */}
                  <section>
                    <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Notable Investments</h3>
                    {isEditing ? (
                      <input 
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
                        value={editedInvestor.notableInvestments.join(', ')}
                        onChange={(e) => handleArrayChange('notableInvestments', e.target.value)}
                      />
                    ) : (
                      <ul className="list-disc list-inside text-zinc-300 space-y-1">
                        {investor.notableInvestments.map(inv => (
                          <li key={inv}>{inv}</li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Contact & Details */}
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">Location</h3>
                      {isEditing ? (
                        <input 
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
                          value={editedInvestor.location}
                          onChange={(e) => handleChange('location', e.target.value)}
                        />
                      ) : (
                        <p className="text-zinc-300">{investor.location}</p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">Investment Range</h3>
                      {isEditing ? (
                        <input 
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
                          value={editedInvestor.investmentRange}
                          onChange={(e) => handleChange('investmentRange', e.target.value)}
                        />
                      ) : (
                        <p className="text-zinc-300">{investor.investmentRange}</p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">Preferred Contact</h3>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <select
                            className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 flex-1"
                            value={CONTACT_PREFERENCES.includes(editedInvestor.contactPreference) ? editedInvestor.contactPreference : 'Other'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val !== 'Other') handleChange('contactPreference', val);
                              else handleChange('contactPreference', '');
                            }}
                          >
                            {CONTACT_PREFERENCES.map(pref => (
                              <option key={pref} value={pref}>{pref}</option>
                            ))}
                          </select>
                          {(!CONTACT_PREFERENCES.includes(editedInvestor.contactPreference) || editedInvestor.contactPreference === '') && (
                            <input 
                              className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 flex-1"
                              placeholder="Custom preference..."
                              value={editedInvestor.contactPreference}
                              onChange={(e) => handleChange('contactPreference', e.target.value)}
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-zinc-300">{investor.contactPreference}</p>
                      )}
                    </div>
                    {!isEditing && editedInvestor.contactVerificationStatus && (
                      <div>
                        <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">Verification</h3>
                        <p className="text-zinc-300">
                          {editedInvestor.contactVerificationProvider || 'contact'}: {editedInvestor.contactVerificationStatus}
                        </p>
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">Email</h3>
                      {isEditing ? (
                        <input
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
                          placeholder="investor@firm.com"
                          value={editedInvestor.email || ''}
                          onChange={(e) => handleChange('email', e.target.value)}
                        />
                      ) : investor.email ? (
                        <p className="text-zinc-300">{investor.email}</p>
                      ) : (
                        <p className="text-zinc-500 italic">No public email saved</p>
                      )}
                    </div>
                    
                    {/* LinkedIn URL - New Field */}
                    <div>
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">LinkedIn Profile</h3>
                      {isEditing ? (
                        <input 
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
                          placeholder="https://linkedin.com/in/..."
                          value={editedInvestor.linkedinUrl || ''}
                          onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                        />
                      ) : (
                        investor.linkedinUrl ? (
                          <a 
                            href={investor.linkedinUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"
                          >
                            <Linkedin size={16} />
                            <span className="truncate">{investor.linkedinUrl}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <p className="text-zinc-500 italic">No LinkedIn profile added</p>
                        )
                      )}
                    </div>
                  </section>
                </div>

                {editedInvestor.sourceUrls && editedInvestor.sourceUrls.length > 0 && (
                  <section>
                    <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Sources</h3>
                    <div className="space-y-2">
                      {editedInvestor.sourceUrls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-blue-400 hover:border-zinc-700 hover:text-blue-300"
                        >
                          <span className="truncate pr-4">{url}</span>
                          <ExternalLink size={14} className="shrink-0" />
                        </a>
                      ))}
                    </div>
                  </section>
                )}

              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-zinc-800 bg-zinc-900/30 flex justify-end">
                <button
                  onClick={() => onDraftOutreach(investor)}
                  className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10"
                >
                  Draft Outreach Email
                </button>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
