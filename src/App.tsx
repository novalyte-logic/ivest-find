import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { InvestorFinder } from './components/InvestorFinder';
import { EmailList } from './components/EmailList';
import { NovalyteVault } from './components/NovalyteVault';
import { InvestorDetailModal } from './components/InvestorDetailModal';
import { ComposeView } from './components/ComposeView';
import { EmailDetail } from './components/EmailDetail';
import { AccessGate } from './components/AccessGate';
import { initialEmails, Email, isLegacyMockEmail } from './data/emails';
import { Investor, isLegacyMockInvestor } from './data/investors';
import { InvestorAvatar } from './components/InvestorAvatar';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseJsonResponse } from './lib/http';

type View = 'finder' | 'investors' | 'inbox' | 'drafts' | 'sent' | 'vault' | 'compose';

const MAILBOX_FROM_EMAIL =
  import.meta.env.VITE_MAIL_FROM_EMAIL ||
  import.meta.env.VITE_SMTP_FROM_EMAIL ||
  'novalyte-ai@echoclips.dev';
const MAILBOX_FROM = MAILBOX_FROM_EMAIL.includes('<')
  ? MAILBOX_FROM_EMAIL
  : `Novalyte AI <${MAILBOX_FROM_EMAIL}>`;

export default function App() {
  const [activeView, setActiveView] = useState<View>('finder');
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [interestedInvestors, setInterestedInvestors] = useState<Investor[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isAccessLoaded, setIsAccessLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const checkAccess = async () => {
      try {
        const response = await fetch('/api/access/status', {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        });
        const result = await parseJsonResponse<{ authenticated?: boolean }>(response);
        if (!isCancelled) {
          setHasAccess(Boolean(result.authenticated));
        }
      } catch (error) {
        console.error('Failed to load access state', error);
        if (!isCancelled) {
          setHasAccess(false);
        }
      } finally {
        if (!isCancelled) {
          setIsAccessLoaded(true);
        }
      }
    };

    checkAccess();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const savedInvestors = localStorage.getItem('interested_investors');
    if (savedInvestors) {
      try {
        const parsed = JSON.parse(savedInvestors) as Investor[];
        const cleaned = parsed.filter((investor) => !isLegacyMockInvestor(investor));
        setInterestedInvestors(cleaned);
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('interested_investors', JSON.stringify(cleaned));
        }
      } catch (e) {
        console.error("Failed to parse interested investors", e);
      }
    }

    const savedEmails = localStorage.getItem('novalyte_emails');
    if (savedEmails) {
      try {
        const parsed = JSON.parse(savedEmails) as Email[];
        const cleaned = parsed.filter((email) => !isLegacyMockEmail(email));
        setEmails(cleaned);
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('novalyte_emails', JSON.stringify(cleaned));
        }
      } catch (e) {
        console.error("Failed to parse emails", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('interested_investors', JSON.stringify(interestedInvestors));
  }, [interestedInvestors]);

  useEffect(() => {
    localStorage.setItem('novalyte_emails', JSON.stringify(emails));
  }, [emails]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [composeInitialInvestor, setComposeInitialInvestor] = useState<Investor | null>(null);
  const [composeInitialDraft, setComposeInitialDraft] = useState<string>('');

  const handleDraftOutreach = (investor: Investor) => {
    setComposeInitialInvestor(investor);
    setComposeInitialDraft(''); // Clear previous draft
    setSelectedEmail(null);
    setActiveView('compose');
  };

  const handleCompose = () => {
    setComposeInitialInvestor(null);
    setComposeInitialDraft('');
    setSelectedEmail(null);
    setActiveView('compose');
    setIsSidebarOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/access/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Failed to clear access session', error);
    } finally {
      setHasAccess(false);
      setIsSidebarOpen(false);
      setSelectedInvestor(null);
      setSelectedEmail(null);
      setComposeInitialInvestor(null);
      setComposeInitialDraft('');
      setActiveView('finder');
    }
  };

  const handleNavigate = (view: View) => {
    setActiveView(view);
    setSelectedEmail(null);
    setIsSidebarOpen(false);
  };

  const handleToggleInterested = (investor: Investor) => {
    setInterestedInvestors(prev => {
      const exists = prev.find(i => i.id === investor.id);
      if (exists) {
        setToast({ message: `Removed ${investor.name} from your list`, type: 'info' });
        return prev.filter(i => i.id !== investor.id);
      }
      setToast({ message: `Added ${investor.name} to your list!`, type: 'success' });
      return [investor, ...prev];
    });
  };

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSendEmail = async (email: Partial<Email> & { scheduledFor?: string }) => {
    try {
      if (!email.scheduledFor) {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            to: email.to,
            subject: email.subject,
            body: email.body,
          }),
        });
        await parseJsonResponse<{ success?: boolean; error?: string }>(response);
      }

      const newEmail: Email = {
        id: `sent-${Date.now()}`,
        from: MAILBOX_FROM,
        to: email.to || '',
        subject: email.subject || '',
        body: email.body || '',
        date: new Date().toISOString(),
        read: true,
        folder: 'sent',
        scheduledFor: email.scheduledFor
      };
      
      setEmails(prev => [newEmail, ...prev]);
      setToast({ 
        message: email.scheduledFor 
          ? `Email scheduled for ${new Date(email.scheduledFor).toLocaleString()}!` 
          : 'Email sent successfully.', 
        type: 'success' 
      });
      
      // Navigate to sent folder to show the user the email was added
      setActiveView('sent');
    } catch (error: any) {
      console.error('Email send error:', error);
      setToast({ message: `Error: ${error.message}`, type: 'info' });
    }
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    // Mark as read if it's in inbox
    if (email.folder === 'inbox' && !email.read) {
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
    }
  };

  const handleDeleteEmail = (id: string) => {
    if (confirm('Are you sure you want to delete this email?')) {
      setEmails(prev => prev.filter(e => e.id !== id));
      setSelectedEmail(null);
      setToast({ message: 'Email deleted', type: 'info' });
    }
  };

  const handleReplyEmail = (email: Email) => {
    setComposeInitialInvestor(null);
    setComposeInitialDraft(`Subject: Re: ${email.subject}\n\n\n--- Original Message ---\nFrom: ${email.from}\nDate: ${new Date(email.date).toLocaleString()}\n\n${email.body.replace(/<[^>]*>/g, '')}`);
    setSelectedEmail(null);
    setActiveView('compose');
  };

  const unreadCount = emails.filter(e => e.folder === 'inbox' && !e.read).length;

  const filteredEmails = emails.filter(e => e.folder === activeView);

  if (!isAccessLoaded) {
    return <div className="min-h-screen bg-black" />;
  }

  if (!hasAccess) {
    return <AccessGate onUnlock={() => setHasAccess(true)} />;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Menu className="text-white" size={18} />
          </div>
          <span className="font-bold text-white text-sm">Outreach Engine</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-zinc-400 hover:text-white"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Responsive */}
      <div className={`fixed inset-0 z-40 md:relative md:z-auto transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="absolute inset-0 bg-black/50 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        <Sidebar 
          activeView={activeView} 
          onNavigate={handleNavigate} 
          onCompose={handleCompose}
          onLogout={handleLogout}
          unreadCount={unreadCount}
        />
      </div>

      <main className="flex-1 min-h-screen bg-black relative">
        {activeView === 'finder' ? (
          <div className="p-4 md:p-8">
            <InvestorFinder 
              onDraftOutreach={handleDraftOutreach} 
              onToggleInterested={handleToggleInterested}
              interestedIds={new Set(interestedInvestors.map(i => i.id))}
            />
          </div>
        ) : activeView === 'investors' ? (
          <div className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">My Investors</h2>
                <p className="text-zinc-400">Track and manage the investors you're interested in.</p>
              </div>
              
              {interestedInvestors.length === 0 ? (
                <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl p-12 text-center">
                  <p className="text-zinc-500 mb-4">You haven't added any investors yet.</p>
                  <button 
                    onClick={() => setActiveView('finder')}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-50 transition-colors"
                  >
                    Find Investors
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {interestedInvestors.map(investor => (
                    <div 
                      key={investor.id} 
                      onClick={() => setSelectedInvestor(investor)}
                      className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-all group cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <InvestorAvatar
                            imageUrl={investor.imageUrl}
                            name={investor.name}
                            className="h-12 w-12 border-2 border-zinc-800 object-cover"
                          />
                          <div>
                            <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">{investor.name}</h3>
                            <p className="text-xs text-zinc-500">{investor.firm}</p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleInterested(investor);
                          }}
                          className="text-blue-500 hover:text-blue-400 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {investor.focus.slice(0, 2).map(f => (
                          <span key={f} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px] uppercase font-bold tracking-wider">
                            {f}
                          </span>
                        ))}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDraftOutreach(investor);
                        }}
                        className="w-full py-2 bg-zinc-800 text-white text-sm font-bold rounded-xl hover:bg-zinc-700 transition-colors"
                      >
                        Draft Outreach
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal for My Investors view */}
            <InvestorDetailModal
              investor={selectedInvestor}
              isOpen={!!selectedInvestor}
              onClose={() => setSelectedInvestor(null)}
              onSave={(updated) => {
                setInterestedInvestors(prev => prev.map(i => i.id === updated.id ? updated : i));
                setSelectedInvestor(updated);
              }}
              onDraftOutreach={(inv) => {
                setSelectedInvestor(null);
                handleDraftOutreach(inv);
              }}
              onToggleInterested={handleToggleInterested}
              isInterested={selectedInvestor ? interestedInvestors.some(i => i.id === selectedInvestor.id) : false}
            />
          </div>
        ) : activeView === 'vault' ? (
          <div className="p-4 md:p-8">
            <NovalyteVault />
          </div>
        ) : activeView === 'compose' ? (
          <ComposeView 
            onSend={handleSendEmail}
            initialInvestor={composeInitialInvestor}
            initialDraft={composeInitialDraft}
            interestedInvestors={interestedInvestors}
          />
        ) : (
          <div className="h-[calc(100vh-64px)] md:h-screen flex flex-col">
            {selectedEmail ? (
              <EmailDetail 
                email={selectedEmail}
                onBack={() => setSelectedEmail(null)}
                onDelete={handleDeleteEmail}
                onReply={handleReplyEmail}
              />
            ) : (
              <>
                <div className="h-14 md:h-16 border-b border-zinc-800 flex items-center px-4 md:px-6 bg-zinc-950/50 backdrop-blur">
                  <h2 className="text-lg md:text-xl font-bold capitalize text-white">{activeView}</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <EmailList 
                    emails={filteredEmails} 
                    folder={activeView as 'inbox' | 'drafts' | 'sent'}
                    onSelectEmail={handleSelectEmail}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full animate-pulse ${toast.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`} />
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
