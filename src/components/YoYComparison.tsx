import { useMemo, useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  Legend, ReferenceLine,
} from 'recharts';
import {
  CalendarRange, TrendingUp, TrendingDown, Minus, ChevronDown, Check, BarChart3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, SectionHeader, Empty, Segmented } from './ui';
import { formatMoney, formatNumber } from '../utils/currency';
import { classNames, dateFromWeek } from '../utils/format';
import { scopeVentes, compareYoY } from '../utils/selectors';

const RED = '#E30613';      // année N (en cours)
const GRAY = '#86868b';     // année N-1 (référence)

// Petit affichage d'évolution : flèche + couleur, « — » si non comparable
// (règle anti-faux-chiffre : jamais de +0,0 % trompeur sans base N-1).
function Evolution({ pct, size = 'md' }: { pct: number | null; size?: 'sm' | 'md' }) {
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

// Sélecteur de semaine de référence (point d'ancrage du cumul N vs N-1).
function RefWeekDropdown({
  weeks, value, annee, onChange,
}: {
  weeks: number[];
  value: number;
  annee: number;
  onChange: (s: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const dateHint = (s: number) =>
    new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(dateFromWeek(annee, s));

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
        <CalendarRange size={12} className="text-ink-muted dark:text-night-muted" />
        <span className="text-2xs uppercase tracking-wider text-ink-muted dark:text-night-muted">Réf.</span>
        <span className="tabular">S{String(value).padStart(2, '0')}</span>
        <ChevronDown size={11} className={classNames('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-40 min-w-[180px] max-h-[280px] overflow-auto py-1 bg-white dark:bg-night-surface border border-hair hairline rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] animate-slide-up">
          {weeks.map((s) => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false); }}
              className={classNames(
                'w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-alt dark:hover:bg-night-alt transition-colors',
                s === value ? 'text-silverlit-red font-medium' : 'text-ink dark:text-night-ink',
              )}
            >
              <span className="flex items-center gap-2 tabular">
                S{String(s).padStart(2, '0')}
                <span className="text-2xs text-ink-muted dark:text-night-muted">{dateHint(s)}</span>
              </span>
              {s === value && <Check size={12} className="text-silverlit-red" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Metric = 'ca' | 'qte';

export function YoYComparison() {
  const { devise, filters } = useApp();
  const [refWeek, setRefWeek] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>('ca');

  const scoped = useMemo(() => scopeVentes(filters), [filters]);
  // compareYoY borne lui-même la semaine de réf. aux semaines comparables : si
  // un changement de filtre rend `refWeek` invalide, la fonction retombe sur la
  // dernière semaine comparable (pas besoin de resynchroniser l'état ici).
  const yoy = useMemo(() => compareYoY(scoped, refWeek ?? undefined), [scoped, refWeek]);

  const { anneeN, anneeN1, hasN, hasN1, reference } = yoy;

  const fmtCa = (v: number) => formatMoney(v, devise, { compact: true });
  const fmtQte = (v: number) => `${formatNumber(v, { compact: true })} u.`;

  const header = (
    <SectionHeader
      title="Comparatif année sur année"
      subtitle={`${anneeN} (N) vs ${anneeN1} (N-1) · même semaine, d'une année sur l'autre · indépendant du filtre de période`}
      action={
        reference ? (
          <RefWeekDropdown
            weeks={yoy.matchedWeeks}
            value={reference.semaine}
            annee={anneeN}
            onChange={setRefWeek}
          />
        ) : undefined
      }
    />
  );

  // Aucune donnée N du tout sur le périmètre.
  if (!hasN) {
    return (
      <Card>
        {header}
        <Empty
          title="Aucune donnée à comparer"
          hint="Importez des semaines de ventes pour activer le comparatif."
          icon={<BarChart3 size={20} />}
        />
      </Card>
    );
  }

  // Données N présentes mais aucune semaine N-1 → comparatif impossible (honnête).
  if (!hasN1) {
    return (
      <Card>
        {header}
        <div className="rounded-xl border border-dashed border-hair hairline bg-surface-alt/40 dark:bg-night-alt/40 px-5 py-6 text-center">
          <CalendarRange size={20} className="mx-auto text-ink-muted dark:text-night-muted mb-2" />
          <p className="text-sm text-ink dark:text-night-ink">
            Comparatif {anneeN} / {anneeN1} indisponible
          </p>
          <p className="text-xs text-ink-muted dark:text-night-muted mt-1 max-w-md mx-auto">
            Aucune semaine {anneeN1} (N-1) chargée sur ce périmètre. Importez les semaines {anneeN1}
            {' '}correspondantes pour afficher l'évolution d'une année sur l'autre.
          </p>
        </div>
      </Card>
    );
  }

  // `reference` est null quand N et N-1 n'ont aucune semaine commune : on affiche
  // alors les deux courbes (informatif) mais aucun cumul comparable.
  const refLabel = reference ? `S${String(reference.semaine).padStart(2, '0')}` : null;
  const matchedCount = reference ? reference.matchedWeeks.length : 0;

  // Tuile de synthèse : valeur N en grand, évolution, base N-1 en dessous.
  const Tile = ({
    label, valN, valN1, evolution, fmt,
  }: {
    label: string; valN: number; valN1: number; evolution: number | null;
    fmt: (v: number) => string;
  }) => (
    <div className="rounded-xl border border-hair hairline bg-surface-alt/40 dark:bg-night-alt/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wider text-ink-muted dark:text-night-muted">
          {label}
        </span>
        <Evolution pct={evolution} size="sm" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[26px] leading-none font-medium tracking-tighter2 tabular text-ink dark:text-night-ink">
          {fmt(valN)}
        </span>
        <span className="text-2xs text-ink-muted dark:text-night-muted">{anneeN}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted dark:text-night-muted">
        <span className="w-2.5 h-0 border-t-2 border-dashed shrink-0" style={{ borderColor: GRAY }} />
        <span className="tabular">{fmt(valN1)}</span>
        <span>· {anneeN1}</span>
      </div>
    </div>
  );

  const chartFmtY = metric === 'ca'
    ? (v: number) => formatMoney(v, devise, { compact: true })
    : (v: number) => formatNumber(v, { compact: true });

  return (
    <Card>
      {header}

      {reference ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <Tile
            label={`CA cumulé · S01 → ${refLabel}`}
            valN={reference.caN}
            valN1={reference.caN1}
            evolution={reference.caEvolution}
            fmt={fmtCa}
          />
          <Tile
            label={`Quantités cumulées · S01 → ${refLabel}`}
            valN={reference.qteN}
            valN1={reference.qteN1}
            evolution={reference.qteEvolution}
            fmt={fmtQte}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-hair hairline bg-surface-alt/40 dark:bg-night-alt/40 px-5 py-4 mb-5 text-center">
          <p className="text-sm text-ink dark:text-night-ink">
            Pas encore de semaine comparable
          </p>
          <p className="text-xs text-ink-muted dark:text-night-muted mt-1 max-w-md mx-auto">
            {anneeN} et {anneeN1} ne partagent aucun même numéro de semaine pour l'instant.
            {' '}Le cumul d'évolution s'affichera dès qu'une semaine existera dans les deux années.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-ink-muted dark:text-night-muted">
          Courbes superposées sur 52 semaines
        </p>
        <Segmented<Metric>
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'ca', label: 'CA' },
            { value: 'qte', label: 'Quantités' },
          ]}
        />
      </div>

      <div className="h-[300px] -ml-3">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <LineChart data={yoy.weeks} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#d2d2d7" strokeDasharray="2 2" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="semaine"
              tick={{ fontSize: 11, fill: '#86868b' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
              tickFormatter={(s) => `S${String(s).padStart(2, '0')}`}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#86868b' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => chartFmtY(v as number)}
              width={70}
            />
            <Tooltip
              labelFormatter={(s) => `Semaine S${String(s).padStart(2, '0')}`}
              formatter={(v: unknown, name: unknown) => {
                if (typeof v !== 'number') return ['—', String(name ?? '')];
                const txt = metric === 'ca'
                  ? formatMoney(v, devise, { compact: false, decimals: 0 })
                  : `${formatNumber(v)} u.`;
                return [txt, String(name ?? '')];
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="plainline"
              wrapperStyle={{ fontSize: 12 }}
            />
            {reference && (
              <ReferenceLine
                x={reference.semaine}
                stroke={GRAY}
                strokeDasharray="3 3"
                strokeOpacity={0.7}
                label={{ value: 'Réf.', position: 'top', fontSize: 10, fill: GRAY }}
              />
            )}
            {/* Pas de connectNulls : une semaine sans donnée reste un trou, jamais
                une ligne « inventée » qui suggérerait une tendance inexistante. */}
            <Line
              type="monotone"
              dataKey={metric === 'ca' ? 'caN1' : 'qteN1'}
              name={`${anneeN1} (N-1)`}
              stroke={GRAY}
              strokeWidth={1.4}
              strokeDasharray="4 3"
              dot={{ r: 2, fill: GRAY }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey={metric === 'ca' ? 'caN' : 'qteN'}
              name={`${anneeN} (N)`}
              stroke={RED}
              strokeWidth={1.8}
              dot={{ r: 2.5, fill: RED }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-2xs text-ink-muted dark:text-night-muted leading-relaxed">
        {reference ? (
          <>
            Évolution calculée sur {matchedCount} semaine{matchedCount > 1 ? 's' : ''} comparable
            {matchedCount > 1 ? 's' : ''} (présente{matchedCount > 1 ? 's' : ''} en {anneeN} et {anneeN1})
            {' '}jusqu'à {refLabel} incluse. Les semaines sans donnée n'inventent jamais de zéro.
          </>
        ) : (
          <>
            Aucune semaine commune à {anneeN} et {anneeN1} pour l'instant : l'évolution reste « — »
            tant que les deux années ne partagent pas un même numéro de semaine.
          </>
        )}
      </p>
    </Card>
  );
}
