import { Layout, Inbox, Send, File, PenSquare, Users, Database, LogOut } from 'lucide-react';

interface SidebarProps {
  activeView: 'finder' | 'investors' | 'inbox' | 'drafts' | 'sent' | 'vault' | 'compose';
  onNavigate: (view: 'finder' | 'investors' | 'inbox' | 'drafts' | 'sent' | 'vault' | 'compose') => void;
  onCompose: () => void;
  onLogout: () => void;
  unreadCount: number;
}

export function Sidebar({ activeView, onNavigate, onCompose, onLogout, unreadCount }: SidebarProps) {
  const itemClass = (isActive: boolean) =>
    `w-full rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-500/10 text-blue-400'
        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
    }`;

  const itemInnerClass =
    'flex items-center gap-3 px-4 py-2.5 md:justify-center md:group-hover/sidebar:justify-start';

  const labelClass =
    'overflow-hidden whitespace-nowrap md:max-w-0 md:opacity-0 md:group-hover/sidebar:ml-0 md:group-hover/sidebar:max-w-[180px] md:group-hover/sidebar:opacity-100 transition-all duration-200';

  return (
    <div className="group/sidebar w-64 bg-zinc-950 border-r border-zinc-800 h-full flex flex-col relative z-40 md:w-20 md:hover:w-64 md:overflow-x-hidden transition-[width] duration-300">
      <div className="p-6 flex items-center gap-3 md:px-4 md:justify-center md:group-hover/sidebar:justify-start">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <Layout className="text-white" size={18} />
        </div>
        <span className={`font-bold text-white tracking-tight ${labelClass}`}>Outreach Engine</span>
      </div>

      <div className="px-4 mb-6">
        <button
          onClick={onCompose}
          title="Compose"
          className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg md:px-0 md:group-hover/sidebar:px-4 ${
            activeView === 'compose'
              ? 'bg-blue-600 text-white shadow-blue-600/20'
              : 'bg-white text-zinc-900 hover:bg-zinc-200 shadow-white/5'
          }`}
        >
          <PenSquare size={18} className="shrink-0" />
          <span className={labelClass}>Compose</span>
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        <button
          onClick={() => onNavigate('finder')}
          title="Find Investors"
          className={itemClass(activeView === 'finder')}
        >
          <div className={itemInnerClass}>
            <Layout size={18} className="shrink-0" />
            <span className={labelClass}>Find Investors</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('investors')}
          title="Investors"
          className={itemClass(activeView === 'investors')}
        >
          <div className={itemInnerClass}>
            <Users size={18} className="shrink-0" />
            <span className={labelClass}>Investors</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('vault')}
          title="Novalyte Vault"
          className={itemClass(activeView === 'vault')}
        >
          <div className={itemInnerClass}>
            <Database size={18} className="shrink-0" />
            <span className={labelClass}>Novalyte Vault</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('compose')}
          title="Compose"
          className={itemClass(activeView === 'compose')}
        >
          <div className={itemInnerClass}>
            <PenSquare size={18} className="shrink-0" />
            <span className={labelClass}>Compose</span>
          </div>
        </button>

        <div className={`pt-4 pb-2 px-4 text-xs font-semibold text-zinc-600 uppercase tracking-wider md:text-center md:group-hover/sidebar:text-left ${labelClass}`}>
          Mailbox
        </div>

        <button
          onClick={() => onNavigate('inbox')}
          title="Inbox"
          className={itemClass(activeView === 'inbox')}
        >
          <div className="flex items-center justify-between px-4 py-2.5 md:justify-center md:group-hover/sidebar:justify-between">
            <div className="flex items-center gap-3">
              <Inbox size={18} className="shrink-0" />
              <span className={labelClass}>Inbox</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full md:ml-0 md:group-hover/sidebar:ml-2">
                {unreadCount}
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => onNavigate('sent')}
          title="Sent"
          className={itemClass(activeView === 'sent')}
        >
          <div className={itemInnerClass}>
            <Send size={18} className="shrink-0" />
            <span className={labelClass}>Sent</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('drafts')}
          title="Drafts"
          className={itemClass(activeView === 'drafts')}
        >
          <div className={itemInnerClass}>
            <File size={18} className="shrink-0" />
            <span className={labelClass}>Drafts</span>
          </div>
        </button>
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 md:justify-center md:group-hover/sidebar:justify-start">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 shrink-0" />
          <div className={`flex-1 min-w-0 ${labelClass}`}>
            <p className="text-sm font-medium text-white truncate">Novalyte AI</p>
            <p className="text-xs text-zinc-500 truncate">founder@novalyte.ai</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Log Out"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white md:px-0 md:group-hover/sidebar:px-4"
        >
          <LogOut size={16} className="shrink-0" />
          <span className={labelClass}>Log Out</span>
        </button>
      </div>
    </div>
  );
}
