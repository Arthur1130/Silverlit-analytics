import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Package, Store, MapPin } from 'lucide-react';
import { PRODUITS, DISTRIBUTEURS, MAGASINS } from '../data';
import { classNames } from '../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (href: string) => void;
}

type Item =
  | { kind: 'produit'; ean: string; label: string; subtitle: string }
  | { kind: 'distributeur'; id: string; label: string; subtitle: string }
  | { kind: 'magasin'; code: string; distributeurId: string; label: string; subtitle: string };

export function CommandPalette({ open, onClose, onPick }: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items: Item[] = useMemo(() => {
    const term = q.toLowerCase().trim();
    if (!term) {
      return [
        ...PRODUITS.slice(0, 5).map<Item>((p) => ({
          kind: 'produit', ean: p.ean, label: p.libelle, subtitle: `EAN ${p.ean} · ${p.gamme}`,
        })),
        ...DISTRIBUTEURS.slice(0, 3).map<Item>((d) => ({
          kind: 'distributeur', id: d.id, label: d.nom, subtitle: `${d.nbMagasins} magasins · ${d.type}`,
        })),
      ];
    }
    const out: Item[] = [];
    for (const p of PRODUITS) {
      if (
        p.libelle.toLowerCase().includes(term) ||
        p.ean.includes(term) ||
        p.refFournisseur.toLowerCase().includes(term)
      ) {
        out.push({ kind: 'produit', ean: p.ean, label: p.libelle, subtitle: `EAN ${p.ean} · ${p.gamme}` });
      }
      if (out.length > 8) break;
    }
    for (const d of DISTRIBUTEURS) {
      if (d.nom.toLowerCase().includes(term)) {
        out.push({ kind: 'distributeur', id: d.id, label: d.nom, subtitle: `${d.nbMagasins} magasins · ${d.type}` });
      }
    }
    for (const m of MAGASINS) {
      if (m.libelle.toLowerCase().includes(term) || m.ville.toLowerCase().includes(term)) {
        out.push({
          kind: 'magasin', code: m.code, distributeurId: m.distributeurId,
          label: m.libelle, subtitle: `${m.ville} · ${m.region}`,
        });
      }
      if (out.length > 14) break;
    }
    return out.slice(0, 14);
  }, [q]);

  function pick(it: Item) {
    if (it.kind === 'produit') onPick(`/produits/${it.ean}`);
    else if (it.kind === 'distributeur') onPick(`/distributeurs/${it.id}`);
    else onPick(`/distributeurs/${it.distributeurId}`);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const it = items[active];
      if (it) pick(it);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-w-[92vw] bg-white dark:bg-night-surface border border-hair hairline rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b border-hair hairline">
          <Search size={16} className="text-ink-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="Rechercher un produit, EAN, magasin, distributeur…"
            className="flex-1 bg-transparent text-sm text-ink dark:text-night-ink placeholder:text-ink-muted outline-none"
          />
          <span className="text-2xs text-ink-muted border border-hair hairline rounded px-1.5">esc</span>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto py-2">
          {items.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-ink-muted dark:text-night-muted">
              Aucun résultat
            </li>
          )}
          {items.map((it, i) => {
            const Icon = it.kind === 'produit' ? Package : it.kind === 'distributeur' ? Store : MapPin;
            return (
              <li key={`${it.kind}-${i}`}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(it)}
                  className={classNames(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                    i === active ? 'bg-surface-alt dark:bg-night-alt' : '',
                  )}
                >
                  <Icon size={14} className="text-ink-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink dark:text-night-ink truncate">{it.label}</p>
                    <p className="text-2xs text-ink-muted dark:text-night-muted truncate">
                      {it.subtitle}
                    </p>
                  </div>
                  <span className="text-2xs text-ink-muted uppercase">{it.kind}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
