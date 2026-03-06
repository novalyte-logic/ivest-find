import { Layout, Inbox, Send, File, PenSquare, Users, Database } from 'lucide-react';

interface SidebarProps {
  activeView: 'finder' | 'investors' | 'inbox' | 'drafts' | 'sent' | 'vault' | 'compose';
  onNavigate: (view: 'finder' | 'investors' | 'inbox' | 'drafts' | 'sent' | 'vault' | 'compose') => void;
  onCompose: () => void;
  unreadCount: number;
}

export function Sidebar({ activeView, onNavigate, onCompose, unreadCount }: SidebarProps) {
  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 h-full flex flex-col relative z-40">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Layout className="text-white" size={18} />
        </div>
        <span className="font-bold text-white tracking-tight">Outreach Engine</span>
      </div>

      <div className="px-4 mb-6">
        <button
          onClick={onCompose}
          className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg ${
            activeView === 'compose'
              ? 'bg-blue-600 text-white shadow-blue-600/20'
              : 'bg-white text-zinc-900 hover:bg-zinc-200 shadow-white/5'
          }`}
        >
          <PenSquare size={18} />
          Compose
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        <button
          onClick={() => onNavigate('finder')}
          className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${
            activeView === 'finder'
              ? 'bg-blue-500/10 text-blue-400'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          }`}
        >
          <Layout size={18} />
          Find Investors
        </button>

        <button
          onClick={() => onNavigate('investors')}
          className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${
            activeView === 'investors'
              ? 'bg-blue-500/10 text-blue-400'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          }`}
        >
          <Users size={18} />
          Investors
        </button>

        <button
          onClick={() => onNavigate('vault')}
          className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${
            activeView === 'vault'
              ? 'bg-blue-500/10 text-blue-400'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          }`}
        >
          <Database size={18} />
          Novalyte Vault
        </button>

        <button
          onClick={() => onNavigate('compose')}
          className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${
            activeView === 'compose'
              ? 'bg-blue-500/10 text-blue-400'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          }`}
        >
          <PenSquare size={18} />
          Compose
        </button>

        <div className="pt-4 pb-2 px-4 text-xs font-semibold text-zinc-600 uppercase tracking-wider">
          Mailbox
        </div>

        <button
          onClick={() => onNavigate('inbox')}
          className={`w-full px-4 py-2.5 rounded-lg flex items-center justify-between text-sm font-medium transition-colors ${
            activeView === 'inbox'
              ? 'bg-blue-500/10 text-blue-400'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <Inbox size={18} />
            Inbox
          </div>
          {unreadCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onNavigate('sent')}
          className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${
            activeView === 'sent'
              ? 'bg-blue-500/10 text-blue-400'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          }`}
        >
          <Send size={18} />
          Sent
        </button>

        <button
          onClick={() => onNavigate('drafts')}
          className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${
            activeView === 'drafts'
              ? 'bg-blue-500/10 text-blue-400'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          }`}
        >
          <File size={18} />
          Drafts
        </button>
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Novalyte AI</p>
            <p className="text-xs text-zinc-500 truncate">founder@novalyte.ai</p>
          </div>
        </div>
      </div>
    </div>
  );
}
