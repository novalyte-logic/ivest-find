import { Email } from '../data/emails';
import { ArrowLeft, Trash2, Reply, Star, MoreHorizontal, User, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  onDelete: (id: string) => void;
  onReply: (email: Email) => void;
}

export function EmailDetail({ email, onBack, onDelete, onReply }: EmailDetailProps) {
  return (
    <div className="flex flex-col h-full bg-black">
      {/* Toolbar */}
      <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
              <Star size={18} />
            </button>
            <button 
              onClick={() => onDelete(email.id)}
              className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-red-400 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onReply(email)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-500 transition-colors"
          >
            <Reply size={16} />
            Reply
          </button>
          <button className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-8">{email.subject}</h1>
          
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                <User size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{email.from}</span>
                  <span className="text-xs text-zinc-500">&lt;{email.from}&gt;</span>
                </div>
                <div className="text-xs text-zinc-500">
                  to {email.to}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-sm text-zinc-400 flex items-center gap-1">
                <Clock size={14} />
                {format(new Date(email.date), 'MMM d, yyyy h:mm a')}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 text-zinc-200 leading-relaxed whitespace-pre-wrap font-mono text-sm">
            <div dangerouslySetInnerHTML={{ __html: email.body }} />
          </div>

          {email.scheduledFor && (
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3 text-blue-400 text-sm">
              <Clock size={16} />
              Scheduled to be sent on {format(new Date(email.scheduledFor), 'MMM d, yyyy h:mm a')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
