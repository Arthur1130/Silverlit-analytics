import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts';
import {
  TrendingUp, Package, Receipt, Store, ArrowRight, AlertTriangle, BarChart3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, SectionHeader, Badge, ProgressBar } from '../components/ui';
import { KPIYoYCard, Evolution } from '../components/metrics';
import { formatMoney, formatNumber, formatPct } from '../utils/currency';
import {
  scopeVentes, aggregateKPIYoY, monthlyYoY, caByDistributeurYoY, topProduitsYoY,
  type TopProduitYoY,
} from '../utils/selectors';
import { monthShort, shortDistribName } from '../utils/format';

// Couleurs ANIZIA pour les graphes N vs N-1 (pas le rouge .online).
const N_COLOR = '#2266dd';     // année N (en cours)
const N1_COLOR = '#c7c7cc';    // année N-1 (référence)

export function Pilotage() {
  const { devise, filters, alertes } = useApp();
  const scope = useMemo(() => scopeVentes(filters), [filters]);
  const kpis = useMemo(() => aggregateKPIYoY(scope), [scope]);
  const months = useMemo(() => monthlyYoY(scope), [scope]);
  const distrib = useMemo(() => caByDistributeurYoY(scope), [scope]);
  const topCA = useMemo(() => topProduitsYoY(scope, 8, 'ca'), [scope]);

  const isHT = filters.priceMode === 'HT';
  const fmtMoney = (v: number, o: { compact?: boolean; decimals?: number } = {}) =>
    formatMoney(v, devise, { ...o, ht: isHT });
  // Affiche le N-1 uniquement si l'utilisateur le veut ET qu'il existe vraiment.
  const showN1 = filters.vsN1 && kpis.hasN1;
  const { anneeN, anneeN1 } = months;

  const alertesOuvertes = alertes.filter((a) => a.statut === 'ouverte');
  const haute = alertesOuvertes.filter((a) => a.severite === 'haute').length;

  const maxValN = topCA.items.length ? topCA.items[0].valN : 1;

  // Mois réellement présents (évite 12 colonnes dont 9 vides).
  const activeMonths = months.months.filter((m) => m.qteN !== null || m.qteN1 !== null);

  // Top produits regroupés par famille (gamme), rang global conservé, familles
  // triées par CA cumulé décroissant.
  const familles = useMemo(() => {
    const groups = new Map<string, TopProduitYoY[]>();
    for (const it of topCA.items) {
      const arr = groups.get(it.gamme) ?? [];
      arr.push(it);
      groups.set(it.gamme, arr);
    }
    return Array.from(groups.entries())
      .map(([gamme, items]) => ({ gamme, items, total: items.reduce((s, x) => s + x.valN, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [topCA]);

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
          Vue d'ensemble
        </h1>
        <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
          {anneeN}{showN1 ? ` vs ${anneeN1}` : ''} · {scope.length.toLocaleString('fr-FR')} lignes agrégées · {isHT ? 'HT estimé (TVA 20 %)' : 'TTC'}
        </p>
      </div>

      {scope.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <BarChart3 size={28} className="text-ink-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm text-ink dark:text-night-ink">Aucune donnée à afficher</p>
            <p className="text-xs text-ink-muted dark:text-night-muted mt-1">
              Importez des semaines de ventes pour alimenter la vue d'ensemble.
            </p>
            <Link to="/import" className="text-xs text-silverlit-red hover:underline mt-3 inline-block">
              Aller à l'import →
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* 4 cartes KPI — CA et Volume montrent le N-1 ; Transactions/Distributeurs non */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="animate-card-in" style={{ animationDelay: '0ms' }}>
              <KPIYoYCard
                label="Chiffre d'affaires"
                valN={kpis.ca.valN} valN1={kpis.ca.valN1} evolution={kpis.ca.evolution}
                fmt={(v) => fmtMoney(v, { compact: true })}
                anneeN={anneeN} anneeN1={anneeN1} showN1={showN1}
                icon={<TrendingUp size={14} />}
              />
            </div>
            <div className="animate-card-in" style={{ animationDelay: '60ms' }}>
              <KPIYoYCard
                label="Volume (quantités)"
                valN={kpis.qte.valN} valN1={kpis.qte.valN1} evolution={kpis.qte.evolution}
                fmt={(v) => formatNumber(v, { compact: true })}
                anneeN={anneeN} anneeN1={anneeN1} showN1={showN1}
                icon={<Package size={14} />}
              />
            </div>
            <div className="animate-card-in" style={{ animationDelay: '120ms' }}>
              <KPIYoYCard
                label="Transactions (lignes)"
                valN={kpis.transactions.valN} valN1={kpis.transactions.valN1} evolution={kpis.transactions.evolution}
                fmt={(v) => formatNumber(v)}
                anneeN={anneeN} anneeN1={anneeN1} showN1={false}
                icon={<Receipt size={14} />}
              />
            </div>
            <div className="animate-card-in" style={{ animationDelay: '180ms' }}>
              <KPIYoYCard
                label="Distributeurs actifs"
                valN={kpis.distributeursActifs.valN} valN1={kpis.distributeursActifs.valN1} evolution={kpis.distributeursActifs.evolution}
                fmt={(v) => String(v)}
                anneeN={anneeN} anneeN1={anneeN1} showN1={false}
                icon={<Store size={14} />}
              />
            </div>
          </div>

          {/* 2 graphiques : volumes mensuels N/N-1 + CA par distributeur N/N-1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card>
              <SectionHeader
                title="Volumes vendus"
                subtitle={showN1 ? `Mensuel · ${anneeN} vs ${anneeN1}` : `Mensuel · ${anneeN}`}
              />
              <div className="h-[280px] -ml-3">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={activeMonths} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barGap={2} barCategoryGap="26%">
                    <CartesianGrid stroke="#d2d2d7" strokeDasharray="2 2" strokeOpacity={0.5} vertical={false} />
                    <XAxis
                      dataKey="mois"
                      tickFormatter={(m) => monthShort(m as number)}
                      tick={{ fontSize: 11, fill: '#86868b' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatNumber(v as number, { compact: true })}
                      tick={{ fontSize: 11, fill: '#86868b' }}
                      axisLine={false} tickLine={false} width={44}
                    />
                    <Tooltip
                      labelFormatter={(m) => monthShort(m as number)}
                      formatter={(v: unknown, name: unknown) =>
                        typeof v === 'number' ? [`${formatNumber(v)} u.`, String(name ?? '')] : ['—', String(name ?? '')]}
                    />
                    <Legend verticalAlign="top" align="right" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    {showN1 && <Bar dataKey="qteN1" name={`${anneeN1} (N-1)`} fill={N1_COLOR} radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false} />}
                    <Bar dataKey="qteN" name={`${anneeN} (N)`} fill={N_COLOR} radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Répartition par distributeur"
                subtitle={showN1 ? `CA par enseigne · ${anneeN} vs ${anneeN1}` : `CA par enseigne · ${anneeN}`}
              />
              {distrib.rows.length === 0 ? (
                <p className="text-sm text-ink-muted dark:text-night-muted py-12 text-center">
                  Aucun chiffre d'affaires sur le périmètre.
                </p>
              ) : (
                <>
                  <div className="h-[230px] -ml-2">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart data={distrib.rows} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                        <CartesianGrid stroke="#e5e5e5" strokeDasharray="2 2" strokeOpacity={0.5} horizontal={false} />
                        <XAxis
                          type="number"
                          tickFormatter={(v) => fmtMoney(v as number, { compact: true })}
                          tick={{ fontSize: 10, fill: '#86868b' }}
                          axisLine={false} tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="nom"
                          tickFormatter={(v) => shortDistribName(String(v))}
                          tick={{ fontSize: 11, fill: '#86868b' }}
                          axisLine={false} tickLine={false} width={120} interval={0}
                        />
                        <Tooltip formatter={(v: unknown, name: unknown) =>
                          typeof v === 'number' ? [fmtMoney(v, { decimals: 0 }), String(name ?? '')] : ['', String(name ?? '')]} />
                        {showN1 && <Bar dataKey="caN1" name="N-1" fill="#e5e5ea" radius={[0, 4, 4, 0]} barSize={9} isAnimationActive={false} />}
                        <Bar dataKey="caN" name="N" radius={[0, 4, 4, 0]} barSize={showN1 ? 9 : 14} isAnimationActive={false}>
                          {distrib.rows.map((d) => <Cell key={d.id} fill={d.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {distrib.rows.slice(0, 6).map((d) => (
                      <li key={d.id} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <Link to={`/distributeurs/${d.id}`} className="text-ink dark:text-night-ink hover:underline truncate flex-1">
                          {d.nom}
                        </Link>
                        <span className="tabular text-ink-muted dark:text-night-muted">{fmtMoney(d.caN, { compact: true })}</span>
                        {showN1 && <span className="w-16 text-right shrink-0"><Evolution pct={d.evolution} size="sm" /></span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>

          {/* Top produits par famille + Alertes récentes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="lg:col-span-2">
              <SectionHeader
                title="Top produits"
                subtitle={`Classement par chiffre d'affaires · ${anneeN}`}
                action={
                  <Link to="/produits" className="text-xs text-silverlit-red hover:underline inline-flex items-center gap-1">
                    Voir tous <ArrowRight size={12} />
                  </Link>
                }
              />
              {topCA.items.length === 0 ? (
                <p className="text-sm text-ink-muted dark:text-night-muted py-8 text-center">
                  Aucune vente sur le périmètre sélectionné.
                </p>
              ) : (
                <div className="space-y-4">
                  {familles.map((f) => (
                    <div key={f.gamme}>
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge tone="info">{f.gamme}</Badge>
                        <span className="text-2xs text-ink-muted dark:text-night-muted tabular">
                          {f.items.length} réf. · {fmtMoney(f.total, { compact: true })}
                        </span>
                      </div>
                      {f.items.map((it) => {
                        const w = (it.valN / maxValN) * 100;
                        return (
                          <Link key={it.ean} to={`/produits/${it.ean}`} className="block group">
                            <div className="flex items-start gap-3 py-1.5">
                              <span className="text-2xs tabular text-ink-muted w-6 text-right shrink-0 mt-0.5">
                                {String(it.rang).padStart(2, '0')}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[13px] text-ink dark:text-night-ink group-hover:underline truncate">
                                    {it.libelle}
                                  </p>
                                  <span className="text-[13px] tabular text-ink dark:text-night-ink shrink-0">
                                    {fmtMoney(it.valN, { compact: true })}
                                  </span>
                                </div>
                                <p className="text-2xs text-ink-muted dark:text-night-muted truncate">
                                  Réf. {it.refFournisseur} · EAN {it.ean}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1"><ProgressBar value={w} /></div>
                                  <span className="text-2xs tabular text-ink-muted dark:text-night-muted w-16 text-right shrink-0">
                                    Part {formatPct(it.partPct)}
                                  </span>
                                  <span className="w-20 text-right shrink-0">
                                    {showN1
                                      ? (it.nouveau
                                        ? <Badge tone="success">Nouveau</Badge>
                                        : <Evolution pct={it.evolution} size="sm" />)
                                      : <span className="text-2xs tabular text-ink-muted dark:text-night-muted">{formatNumber(Math.round(it.qteN))} u.</span>}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <SectionHeader
                title="Alertes ouvertes"
                subtitle={`${alertesOuvertes.length} active${alertesOuvertes.length > 1 ? 's' : ''}, dont ${haute} à priorité haute`}
                action={<Link to="/alertes" className="text-xs text-silverlit-red hover:underline">Voir tout</Link>}
              />
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
        </>
      )}
    </div>
  );
}
