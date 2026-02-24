import { useState } from 'react';
import { Email } from '../data/emails';
import { Star, Trash2, Reply, MoreHorizontal } from 'lucide-react';

interface EmailListProps {
  emails: Email[];
  folder: 'inbox' | 'drafts' | 'sent';
  onSelectEmail: (email: Email) => void;
}

export function EmailList({ emails, folder, onSelectEmail }: EmailListProps) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <p>No emails in {folder}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900/30">
      {emails.map((email) => (
        <div
          key={email.id}
          onClick={() => onSelectEmail(email)}
          className={`group flex items-center gap-4 p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors ${
            !email.read ? 'bg-zinc-900' : ''
          }`}
        >
          <div className="flex-shrink-0">
            <button className="text-zinc-600 hover:text-yellow-500 transition-colors">
              <Star size={18} />
            </button>
          </div>
          
          <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
            <div className={`col-span-3 truncate text-sm ${!email.read ? 'font-bold text-white' : 'text-zinc-300'}`}>
              {folder === 'sent' || folder === 'drafts' ? email.to : email.from}
            </div>
            
            <div className="col-span-7 flex items-center gap-2 min-w-0">
              <span className={`text-sm truncate ${!email.read ? 'font-bold text-white' : 'text-zinc-300'}`}>
                {email.subject}
              </span>
              <span className="text-sm text-zinc-500 truncate">
                - {email.body.substring(0, 50)}...
              </span>
            </div>

            <div className="col-span-2 text-right text-xs text-zinc-500 font-mono">
              {new Date(email.date).toLocaleDateString()}
            </div>
          </div>

          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
            <button className="p-2 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
