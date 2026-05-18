import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ArrowUp } from 'lucide-react';
import { PoliLogo } from './PoliLogo';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { answer, type QAAnswer } from '../utils/qa';
import { formatMoney } from '../utils/currency';
import { classNames } from '../utils/format';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  bullets?: string[];
  link?: { label: string; to: string };
  followUps?: string[];
  suggestions?: Array<{ label: string; query: string }>;
  amountsAreEUR?: boolean;
}

const WELCOME: UIMessage = {
  id: 'welcome',
  role: 'assistant',
  text:
    "Bonjour, je suis **Poli**, votre assistant Silverlit. Posez-moi une question sur les ventes, les distributeurs, les ruptures ou la qualité des sources.",
  followUps: [
    'Top 5 produits chez JouéClub sur 4 semaines',
    'Compare Carrefour et Auchan ce trimestre',
    'Quels produits sont en croissance ?',
    'Qualité des sources d\'import',
  ],
};

export function Chatbot() {
  const { user } = useAuth();
  const { devise, alertes } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([WELCOME]);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, thinking]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const reformat = useMemo(
    () => (s: string, isEUR: boolean | undefined) => {
      if (!isEUR) return s;
      return s.replace(/##EUR:([0-9.]+)##/g, (_, n) =>
        formatMoney(parseFloat(n), devise, { compact: true }),
      );
    },
    [devise],
  );

  function send(text: string) {
    if (!text.trim() || thinking) return;
    const userMsg: UIMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((cur) => [...cur, userMsg]);
    setQ('');
    setThinking(true);

    // Latence symbolique pour donner l'impression d'une analyse en cours
    setTimeout(() => {
      const ans: QAAnswer = answer({ question: text, alertes });
      const poliMsg: UIMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: ans.text,
        bullets: ans.bullets,
        link: ans.link,
        followUps: ans.followUps,
        suggestions: ans.suggestions,
        amountsAreEUR: ans.amountsAreEUR,
      };
      setMessages((cur) => [...cur, poliMsg]);
      setThinking(false);
    }, 380);
  }

  if (!user) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant Poli"
          className="group fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-white dark:bg-night-surface border border-hair hairline shadow-[0_8px_28px_rgba(0,0,0,0.12)] hover:shadow-[0_10px_32px_rgba(227,6,19,0.18)] hover:-translate-y-0.5 hover:border-silverlit-red/30 transition-all duration-300 flex items-center justify-center text-ink dark:text-night-ink active:scale-95"
        >
          <span className="animate-bob inline-flex">
            <PoliLogo size={32} />
          </span>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-green rounded-full border-2 border-white dark:border-night-surface animate-pulse-soft" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-white dark:bg-night-surface border border-hair hairline rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden">
          <div className="h-14 px-4 border-b border-hair hairline flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-alt dark:bg-night-alt flex items-center justify-center text-ink dark:text-night-ink">
              <PoliLogo size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink leading-none">
                Poli
              </p>
              <p className="text-2xs text-ink-muted dark:text-night-muted leading-none mt-1 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                Analyse locale · prête
              </p>
            </div>
            <button
              onClick={() => setMessages([WELCOME])}
              className="text-2xs text-ink-muted hover:text-ink dark:hover:text-night-ink px-2 h-7 rounded-md hover:bg-surface-alt dark:hover:bg-night-alt"
              title="Nouvelle conversation"
            >
              Effacer
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-md inline-flex items-center justify-center text-ink-muted hover:bg-surface-alt dark:hover:bg-night-alt"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} m={m} reformat={reformat} onPick={send} />
            ))}
            {thinking && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-alt dark:bg-night-alt flex items-center justify-center shrink-0 text-ink dark:text-night-ink">
                  <PoliLogo size={18} />
                </div>
                <div className="bg-surface-alt dark:bg-night-alt rounded-2xl rounded-tl-md px-3 py-2 inline-flex items-center gap-1">
                  <Dot delay={0} /><Dot delay={140} /><Dot delay={280} />
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-hair hairline">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(q);
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Posez votre question…"
                disabled={thinking}
                className="flex-1 h-9 px-3 rounded-lg border border-hair hairline bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink placeholder:text-ink-muted focus:outline-none focus:border-silverlit-red disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!q.trim() || thinking}
                className="w-9 h-9 rounded-lg bg-ink dark:bg-night-ink text-white dark:text-black inline-flex items-center justify-center disabled:opacity-40 hover:opacity-90"
                aria-label="Envoyer"
              >
                <ArrowUp size={14} strokeWidth={2.4} />
              </button>
            </form>
            <p className="text-2xs text-ink-muted mt-2 text-center">
              Moteur local · analyse des données du dashboard en temps réel
            </p>
          </div>
        </div>
      )}
    </>
  );
}

interface BubbleProps {
  m: UIMessage;
  reformat: (s: string, isEUR: boolean | undefined) => string;
  onPick: (q: string) => void;
}

function Bubble({ m, reformat, onPick }: BubbleProps) {
  return (
    <div className={classNames('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
      {m.role === 'assistant' && (
        <div className="w-7 h-7 rounded-lg bg-surface-alt dark:bg-night-alt flex items-center justify-center shrink-0 text-ink dark:text-night-ink">
          <PoliLogo size={18} />
        </div>
      )}
      <div
        className={classNames(
          'max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed',
          m.role === 'user'
            ? 'bg-ink dark:bg-night-ink text-white dark:text-black rounded-tr-md'
            : 'bg-surface-alt dark:bg-night-alt text-ink dark:text-night-ink rounded-tl-md',
        )}
      >
        <RichText text={reformat(m.text, m.amountsAreEUR)} />
        {m.bullets && m.bullets.length > 0 && (
          <ul className="mt-2 space-y-1 text-2xs">
            {m.bullets.map((b, i) => (
              <li key={i} className="tabular">{reformat(b, m.amountsAreEUR)}</li>
            ))}
          </ul>
        )}
        {m.link && (
          <Link
            to={m.link.to}
            className="mt-2 inline-flex items-center gap-1 text-2xs text-silverlit-red hover:underline"
          >
            → {m.link.label}
          </Link>
        )}
        {m.suggestions && m.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.suggestions.map((s) => (
              <button
                key={s.query}
                onClick={() => onPick(s.query)}
                className="text-2xs px-2 py-1 rounded-md border border-silverlit-red/30 bg-silverlit-red-soft text-silverlit-red hover:bg-silverlit-red hover:text-white transition-colors animate-pop"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {m.followUps && m.followUps.length > 0 && (
          <div className="mt-2 -mb-0.5 flex flex-wrap gap-x-3 gap-y-1">
            {m.followUps.map((s) => (
              <button
                key={s}
                onClick={() => onPick(s)}
                className="text-2xs text-silverlit-red hover:underline"
              >
                › {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => (
        <p key={i}>{renderInline(line)}</p>
      ))}
    </div>
  );
}

function renderInline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) {
      out.push(<strong key={`k${idx++}`} className="font-medium">{m[2]}</strong>);
    } else if (m[3]) {
      out.push(
        <code key={`k${idx++}`} className="text-2xs tabular bg-surface-line/30 px-1 rounded">
          {m[4]}
        </code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-pulse"
      style={{ animationDelay: `${delay}ms`, animationDuration: '1.2s' }}
    />
  );
}
