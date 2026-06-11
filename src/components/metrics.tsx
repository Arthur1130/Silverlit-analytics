import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { classNames } from '../utils/format';
import { Card } from './ui';

// Affichage d'évolution : flèche + couleur, « — » si non comparable.
// Règle anti-faux-chiffre : jamais de +0,0 % trompeur sans base N-1 réelle.
export function Evolution({ pct, size = 'md' }: { pct: number | null; size?: 'sm' | 'md' }) {
  if (pct === null) {
    return <span className="text-ink-muted dark:text-night-muted tabular">—</span>;
  }
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const color = flat
    ? 'text-ink-muted dark:text-night-muted'
    : up ? 'text-brand-green' : 'text-brand-red';
  return (
    <span className={classNames(
      'inline-flex items-center gap-1 tabular font-medium',
      size === 'sm' ? 'text-xs' : 'text-sm',
      color,
    )}>
      <Icon size={size === 'sm' ? 12 : 14} />
      {up && !flat ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

// Carte KPI avec valeur N en grand + (optionnel) valeur N-1 dessous + évolution.
// showN1=false → on affiche seulement la valeur N (et l'icône), sans N-1 ni %.
export function KPIYoYCard({
  label, valN, valN1, evolution, fmt, anneeN, anneeN1, showN1, icon,
}: {
  label: string;
  valN: number;
  valN1: number;
  evolution: number | null;
  fmt: (v: number) => string;
  anneeN: number;
  anneeN1: number;
  showN1: boolean;
  icon?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wider text-ink-muted dark:text-night-muted">
          {label}
        </span>
        {showN1
          ? <Evolution pct={evolution} size="sm" />
          : icon && <span className="text-ink-muted dark:text-night-muted">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[28px] leading-none font-medium tracking-tighter2 tabular text-ink dark:text-night-ink">
          {fmt(valN)}
        </span>
        {showN1 && <span className="text-2xs text-ink-muted dark:text-night-muted">{anneeN}</span>}
      </div>
      {showN1 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted dark:text-night-muted">
          <span className="w-2.5 h-0 border-t-2 border-dashed border-ink-muted shrink-0" />
          <span className="tabular">{fmt(valN1)}</span>
          <span>· {anneeN1}</span>
        </div>
      )}
    </Card>
  );
}
