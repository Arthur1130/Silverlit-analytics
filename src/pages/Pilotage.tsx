import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, Package, Store, Layers, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, KPICard, SectionHeader, Badge } from '../components/ui';
import { formatMoney, formatNumber, formatPct } from '../utils/currency';
import {
  filteredVentes, previousPeriodVentes, aggregateKPI, caByWeek,
  caByDistributeur, caByGamme, topProduits,
} from '../utils/selectors';
import { weekShort } from '../utils/format';
import { YoYComparison } from '../components/YoYComparison';
import { PRODUITS } from '../data';

export function Pilotage() {
  const { devise, filters, alertes } = useApp();
  const ventes = useMemo(() => filteredVentes(filters), [filters]);
  const prev = useMemo(() => previousPeriodVentes(filters), [filters]);
  const kpi = useMemo(() => aggregateKPI(ventes), [ventes]);
  const kpiPrev = useMemo(() => aggregateKPI(prev), [prev]);

  const weekSerie = useMemo(() => caByWeek(ventes), [ventes]);
  const distrib = useMemo(() => caByDistributeur(ventes), [ventes]);
  const gammes = useMemo(() => caByGamme(ventes), [ventes]);
  const top = useMemo(() => topProduits(ventes, 8), [ventes]);

  // Renvoie undefined s'il n'y a pas de période précédente à comparer
  // (évite d'afficher un faux « +0,0 % » trompeur).
  const delta = (a: number, b: number): number | undefined => (b > 0 ? ((a - b) / b) * 100 : undefined);
  const hasPrev = prev.length > 0;
  const prevLabel = hasPrev ? 'vs période précédente' : undefined;

  const alertesOuvertes = alertes.filter((a) => a.statut === 'ouverte');
  const haute = alertesOuvertes.filter((a) => a.severite === 'haute').length;
  const totalCaGamme = gammes.reduce((s, g) => s + g.ca, 0) || 1;

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
          Pilotage
        </h1>
        <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
          Vue consolidée des ventes Silverlit · {ventes.length.toLocaleString('fr-FR')} lignes agrégées
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="animate-card-in" style={{ animationDelay: '0ms' }}>
          <KPICard
            label="Chiffre d'affaires"
            value={formatMoney(kpi.ca, devise, { compact: true })}
            delta={delta(kpi.ca, kpiPrev.ca)}
            deltaLabel={prevLabel}
            icon={<TrendingUp size={14} />}
          />
        </div>
        <div className="animate-card-in" style={{ animationDelay: '60ms' }}>
          <KPICard
            label="Quantités vendues"
            value={formatNumber(kpi.qte, { compact: true })}
            delta={delta(kpi.qte, kpiPrev.qte)}
            deltaLabel={prevLabel}
            icon={<Package size={14} />}
          />
        </div>
        <div className="animate-card-in" style={{ animationDelay: '120ms' }}>
          <KPICard
            label="Références actives"
            value={String(kpi.refs)}
            deltaLabel={`sur ${formatNumber(PRODUITS.length)} au catalogue`}
            icon={<Layers size={14} />}
          />
        </div>
        <div className="animate-card-in" style={{ animationDelay: '180ms' }}>
          <KPICard
            label="Panier moyen"
            value={formatMoney(kpi.panierMoyen, devise, { decimals: 2 })}
            delta={delta(kpi.panierMoyen, kpiPrev.panierMoyen)}
            deltaLabel={prevLabel}
            icon={<Store size={14} />}
          />
        </div>
      </div>

      <div className="mb-6">
        <YoYComparison />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Évolution du chiffre d'affaires"
            subtitle="Courbe hebdomadaire, période sélectionnée"
            action={
              <Badge tone="info">
                {weekSerie.length} semaine{weekSerie.length > 1 ? 's' : ''}
              </Badge>
            }
          />
          <div className="h-[280px] -ml-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={weekSerie} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="ca-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d1d1f" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#1d1d1f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#d2d2d7" strokeDasharray="2 2" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey={(d) => weekShort(d.annee, d.semaine)}
                  tick={{ fontSize: 11, fill: '#86868b' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#86868b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(v as number, devise, { compact: true })}
                  width={70}
                />
                <Tooltip
                  formatter={(v: unknown) => typeof v === "number" ? formatMoney(v, devise, { compact: false, decimals: 0 }) : ""}
                  labelFormatter={(_, p) => {
                    const d = p?.[0]?.payload;
                    return d ? `${weekShort(d.annee, d.semaine)} · ${d.annee}` : '';
                  }}
                />
                <Area type="monotone" dataKey="ca" stroke="#1d1d1f" strokeWidth={1.2} fill="url(#ca-gradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Répartition par enseigne" subtitle="Part du CA" />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={distrib}
                  dataKey="ca"
                  nameKey="nom"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={1}
                  stroke="none"
                >
                  {distrib.map((d) => (
                    <Cell key={d.id} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: unknown, name: unknown) =>
                    typeof v === 'number'
                      ? [formatMoney(v, devise, { compact: true }), String(name ?? '')]
                      : ['', String(name ?? '')]
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {distrib.map((d) => {
              const pct = kpi.ca > 0 ? (d.ca / kpi.ca) * 100 : 0;
              return (
                <li key={d.id} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <Link to={`/distributeurs/${d.id}`} className="text-ink dark:text-night-ink hover:underline truncate flex-1">
                    {d.nom}
                  </Link>
                  <span className="tabular text-ink-muted dark:text-night-muted">
                    {pct.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Top produits"
            subtitle="Triés par chiffre d'affaires sur la période"
            action={
              <Link to="/produits" className="text-xs text-silverlit-red hover:underline inline-flex items-center gap-1">
                Voir tous <ArrowRight size={12} />
              </Link>
            }
          />
          <div className="space-y-2">
            {top.map((t, i) => {
              const maxCa = top[0].ca;
              const w = (t.ca / maxCa) * 100;
              return (
                <Link
                  key={t.ean}
                  to={`/produits/${t.ean}`}
                  className="block group"
                >
                  <div className="flex items-center gap-3 py-1.5">
                    <span className="text-2xs tabular text-ink-muted w-5 text-right">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[13px] text-ink dark:text-night-ink group-hover:underline truncate">
                          {t.produit!.libelle}
                        </p>
                        <span className="text-[13px] tabular text-ink dark:text-night-ink ml-3">
                          {formatMoney(t.ca, devise, { compact: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-0.5 bg-surface-alt dark:bg-night-alt rounded overflow-hidden">
                          <div className="h-full bg-ink dark:bg-night-ink" style={{ width: `${w}%` }} />
                        </div>
                        <span className="text-2xs tabular text-ink-muted dark:text-night-muted w-16 text-right">
                          {formatNumber(t.qte)} u.
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Alertes ouvertes" subtitle={`${alertesOuvertes.length} active${alertesOuvertes.length > 1 ? 's' : ''}, dont ${haute} à priorité haute`} action={
            <Link to="/alertes" className="text-xs text-silverlit-red hover:underline">Voir tout</Link>
          } />
          <ul className="space-y-2.5">
            {alertesOuvertes.slice(0, 5).map((a) => {
              const tone = a.severite === 'haute' ? 'danger' : a.severite === 'moyenne' ? 'warn' : 'neutral';
              return (
                <li key={a.id} className="flex items-start gap-2.5">
                  <div className={
                    'mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ' +
                    (a.severite === 'haute' ? 'bg-brand-red' : a.severite === 'moyenne' ? 'bg-brand-orange' : 'bg-ink-muted')
                  } />
                  <div className="min-w-0 flex-1">
                    <Link to={`/produits/${a.ean}`} className="text-[13px] text-ink dark:text-night-ink hover:underline block truncate">
                      {a.libelle}
                    </Link>
                    <p className="text-xs text-ink-muted dark:text-night-muted line-clamp-2">{a.message}</p>
                    <div className="mt-1">
                      <Badge tone={tone}>{a.type}</Badge>
                    </div>
                  </div>
                </li>
              );
            })}
            {alertesOuvertes.length === 0 && (
              <li className="text-xs text-ink-muted py-4 text-center flex flex-col items-center gap-2">
                <AlertTriangle size={20} className="opacity-30" />
                Aucune alerte ouverte
              </li>
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Répartition par gamme" subtitle="Concentration commerciale" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={gammes} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#e5e5e5" strokeDasharray="2 2" strokeOpacity={0.5} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#86868b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(v as number, devise, { compact: true })}
                />
                <YAxis
                  type="category"
                  dataKey="gamme"
                  tick={{ fontSize: 11, fill: '#1d1d1f' }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                  interval={0}
                />
                <Tooltip formatter={(v: unknown, name: unknown) => typeof v === 'number' ? [formatMoney(v, devise, { compact: false }), String(name ?? '')] : ['', String(name ?? '')]} />
                <Bar dataKey="ca" fill="#1d1d1f" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2">
            {gammes.map((g) => (
              <li key={g.gamme} className="flex items-center justify-between text-sm">
                <span className="text-ink dark:text-night-ink">{g.gamme}</span>
                <div className="flex items-center gap-3">
                  <span className="tabular text-ink dark:text-night-ink">
                    {formatMoney(g.ca, devise, { compact: true })}
                  </span>
                  <span className="tabular text-2xs text-ink-muted w-10 text-right">
                    {formatPct((g.ca / totalCaGamme) * 100)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
