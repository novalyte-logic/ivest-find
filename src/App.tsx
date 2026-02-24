import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { InvestorFinder } from './components/InvestorFinder';
import { EmailList } from './components/EmailList';
import { ComposeEmailModal } from './components/ComposeEmailModal';
import { NovalyteVault } from './components/NovalyteVault';
import { initialEmails, Email } from './data/emails';
import { Investor } from './data/investors';

type View = 'investors' | 'inbox' | 'drafts' | 'sent' | 'vault';

export default function App() {
  const [activeView, setActiveView] = useState<View>('investors');
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeInitialInvestor, setComposeInitialInvestor] = useState<Investor | null>(null);
  const [composeInitialDraft, setComposeInitialDraft] = useState<string>('');

  const handleDraftOutreach = (investor: Investor) => {
    setComposeInitialInvestor(investor);
    setComposeInitialDraft(''); // Clear previous draft
    setIsComposeOpen(true);
  };

  const handleCompose = () => {
    setComposeInitialInvestor(null);
    setComposeInitialDraft('');
    setIsComposeOpen(true);
  };

  const unreadCount = emails.filter(e => e.folder === 'inbox' && !e.read).length;

  const filteredEmails = emails.filter(e => e.folder === activeView);

  return (
    <div className="min-h-screen bg-black text-white font-sans flex">
      <Sidebar 
        activeView={activeView} 
        onNavigate={setActiveView} 
        onCompose={handleCompose}
        unreadCount={unreadCount}
      />

      <main className="flex-1 ml-64 min-h-screen bg-black relative">
        {activeView === 'investors' ? (
          <div className="p-8">
            <InvestorFinder onDraftOutreach={handleDraftOutreach} />
          </div>
        ) : activeView === 'vault' ? (
          <div className="p-8">
            <NovalyteVault />
          </div>
        ) : (
          <div className="h-screen flex flex-col">
            <div className="h-16 border-b border-zinc-800 flex items-center px-6 bg-zinc-950/50 backdrop-blur">
              <h2 className="text-xl font-bold capitalize text-white">{activeView}</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EmailList 
                emails={filteredEmails} 
                folder={activeView as 'inbox' | 'drafts' | 'sent'}
                onSelectEmail={(email) => console.log('Selected email:', email)}
              />
            </div>
          </div>
        )}
      </main>

      <ComposeEmailModal 
        isOpen={isComposeOpen} 
        onClose={() => setIsComposeOpen(false)}
        initialInvestor={composeInitialInvestor}
        initialDraft={composeInitialDraft}
      />
    </div>
  );
}
