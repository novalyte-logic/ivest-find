import { FormEvent, useState } from 'react';
import { ArrowRight, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';

interface AccessGateProps {
  onUnlock: () => void;
}

export function AccessGate({ onUnlock }: AccessGateProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/access/unlock', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || 'Incorrect access code.');
        return;
      }

      setError('');
      setCode('');
      onUnlock();
    } catch (requestError) {
      console.error('Access check failed', requestError);
      setError('Unable to reach the server right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-[2rem] border border-zinc-800 bg-zinc-950/90 shadow-2xl shadow-black/50 overflow-hidden">
        <div className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.28),_rgba(9,9,11,0.92)_58%)] px-8 py-10">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10">
            <LockKeyhole className="text-blue-400" size={26} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Private Access</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Enter the Novalyte access code to open the investor outreach workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-8 py-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
            <div className="mb-2 flex items-center gap-2 text-zinc-200">
              <ShieldCheck size={16} className="text-emerald-400" />
              Access is validated by the server.
            </div>
            After unlock, the browser keeps a secure session cookie instead of storing the code in the app.
          </div>

          <div className="space-y-2">
            <label htmlFor="access-code" className="block text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Access Code
            </label>
            <input
              id="access-code"
              type="password"
              inputMode="text"
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (error) setError('');
              }}
              className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-lg tracking-[0.3em] text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              placeholder="Enter access code"
            />
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !code.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
            {isSubmitting ? 'Checking Access' : 'Unlock Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
