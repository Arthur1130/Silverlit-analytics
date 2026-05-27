import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, Check, SlidersHorizontal } from 'lucide-react';
import { useApp, type Period } from '../context/AppContext';
import type { Devise, Gamme } from '../types';
import { DEVISE_LIST, getExchangeRate } from '../utils/currency';
import { DISTRIBUTEURS } from '../data';
import { classNames } from '../utils/format';
import { filtersForPath, hasAnyFilter } from '../utils/pageConfig';

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'S-1', label: 'Semaine S-1' },
  { value: '4S', label: '4 semaines' },
  { value: '13S', label: '13 semaines' },
  { value: '52S', label: '12 mois' },
  { value: '24M', label: '24 mois' },
];

const GAMMES: Array<{ value: Gamme | 'all'; label: string }> = [
  { value: 'all', label: 'Toutes les marques' },
  { value: 'EXOST', label: 'EXOST' },
  { value: 'FLYBOTIC', label: 'FLYBOTIC' },
  { value: 'YCOO', label: 'YCOO' },
  { value: 'ROBOCAR POLI', label: 'ROBOCAR POLI' },
  { value: 'OUAPS', label: 'OUAPS' },
  { value: 'SPIROGRAPH', label: 'SPIROGRAPH' },
  { value: 'LAZER MAD', label: 'LAZER MAD' },
  { value: 'TOOKO', label: 'TOOKO' },
  { value: 'Autres marques', label: 'Autres marques' },
];

interface DropdownProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (v: T) => void;
  align?: 'left' | 'right';
  label?: string;
}

function Dropdown<T extends string>({ value, options, onChange, align = 'left', label }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={classNames(
          'flex items-center gap-1.5 text-xs px-3 h-9 rounded-full border transition-all',
          open
            ? 'border-silverlit-red bg-silverlit-red-soft text-silverlit-red'
            : 'border-hair hairline bg-white dark:bg-night-surface text-ink dark:text-night-ink hover:border-ink/30 dark:hover:border-night-muted',
        )}
      >
        {label && <span className="text-2xs uppercase tracking-wider text-ink-muted dark:text-night-muted">{label}</span>}
        <span>{current?.label}</span>
        <ChevronDown size={11} className={classNames('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className={classNames(
            'absolute top-full mt-1.5 z-40 min-w-[200px] py-1 bg-white dark:bg-night-surface border border-hair hairline rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] animate-slide-up',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={classNames(
                'w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-alt dark:hover:bg-night-alt transition-colors',
                o.value === value ? 'text-silverlit-red font-medium' : 'text-ink dark:text-night-ink',
              )}
            >
              <span className="flex items-center gap-2">
                {o.label}
                {o.hint && (
                  <span className="text-2xs text-ink-muted dark:text-night-muted">{o.hint}</span>
                )}
              </span>
              {o.value === value && <Check size={12} className="text-silverlit-red" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterBar() {
  const { devise, setDevise, filters, setFilters, exchangeRates } = useApp();
  const loc = useLocation();
  const cfg = filtersForPath(loc.pathname);

  const distribOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'Tous les distributeurs' },
      ...DISTRIBUTEURS.map((d) => ({ value: d.id, label: d.nom })),
    ],
    [],
  );

  const deviseOptions = useMemo(
    () =>
      DEVISE_LIST.map((d) => ({
        value: d.code,
        label: `${d.symbol} ${d.code}`,
        hint: d.code !== 'EUR'
          ? `1 € = ${getExchangeRate(d.code).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ${d.code}`
          : undefined,
      })),
    // Recalculé quand les taux changent (édités dans Paramètres)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exchangeRates],
  );

  if (!hasAnyFilter(cfg)) return null;

  // "Filtres modifiés" = un filtre applicable ≠ valeur par défaut
  const hasDirty =
    (cfg.period && filters.period !== '13S') ||
    (cfg.distributeur && filters.distributeurId !== 'all') ||
    (cfg.gamme && filters.gamme !== 'all');

  function reset() {
    const next = { ...filters };
    if (cfg.period) next.period = '13S';
    if (cfg.distributeur) next.distributeurId = 'all';
    if (cfg.gamme) next.gamme = 'all';
    setFilters(next);
  }

  return (
    <div className="sticky top-14 z-20 bg-surface-alt/80 dark:bg-night-surface/80 backdrop-blur-xl border-b border-hair hairline animate-fade-in">
      <div className="px-4 sm:px-6 py-2.5 max-w-[1320px] mx-auto flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wider text-ink-muted dark:text-night-muted mr-1">
          <SlidersHorizontal size={11} />
          <span className="hidden sm:inline">Filtres</span>
        </div>
        {cfg.period && (
          <Dropdown
            value={filters.period}
            options={PERIODS}
            onChange={(v) => setFilters({ ...filters, period: v as Period })}
          />
        )}
        {cfg.distributeur && (
          <Dropdown
            value={filters.distributeurId}
            options={distribOptions}
            onChange={(v) => setFilters({ ...filters, distributeurId: v })}
          />
        )}
        {cfg.gamme && (
          <Dropdown
            value={filters.gamme}
            options={GAMMES}
            onChange={(v) => setFilters({ ...filters, gamme: v as Gamme | 'all' })}
          />
        )}
        {cfg.devise && (
          <Dropdown
            value={devise}
            options={deviseOptions}
            onChange={(v) => setDevise(v as Devise)}
            align="right"
          />
        )}
        {hasDirty && (
          <button
            onClick={reset}
            className="text-2xs text-ink-muted hover:text-silverlit-red transition-colors ml-1 animate-fade-in"
          >
            Réinitialiser
          </button>
        )}
        {cfg.devise && devise !== 'EUR' && (
          <span className="ml-auto text-2xs text-ink-muted dark:text-night-muted tabular">
            1 € = {getExchangeRate(devise).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} {devise}
          </span>
        )}
      </div>
    </div>
  );
}
