import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts';
import { ArrowLeft, Store, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, KPICard, SectionHeader, Badge } from '../components/ui';
import {
  findDistributeur, magasinsByDistributeur, magasinRealShare,
  VENTES, findProduit, PRODUITS, isEcommerce,
} from '../data';
import { formatMoney, formatNumber } from '../utils/currency';
import { weekShort } from '../utils/format';
import { caByWeek, topProduits, periodWeeks } from '../utils/selectors';
import { exportDistributeurXlsx } from '../utils/exportDistribTable';

const PERIOD_LABEL: Record<string, string> = {
  'S-1': 'S-1',
  '4S': '4 semaines',
  '13S': '13 semaines',
  '52S': '12 mois',
  '24M': '24 mois',
};

export function DistributeurDetail() {
  const { id = '' } = useParams();
  const { devise, filters } = useApp();
  const distributeur = findDistributeur(id);
  const magasins = magasinsByDistributeur(id);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!id || exporting) return;
    setExporting(true);
    try {
      await exportDistributeurXlsx(id);
    } catch (e) {
      console.error('Export Excel échoué', e);
    } finally {
      setExporting(false);
    }
  }

  // Historique complet pour le graphique (contexte)
  const ventesAll = useMemo(() => VENTES.filter((v) => v.distributeurId === id), [id]);
  const weekSerie = useMemo(() => caByWeek(ventesAll), [ventesAll]);

  // Ventes filtrées (période + gamme — distributeur déjà fixé par la route)
  const ventes = useMemo(() => {
    const weekSet = new Set(periodWeeks(filters.period).map((w) => `${w.annee}-${w.semaine}`));
    const gammeEans = filters.gamme === 'all'
      ? null
      : new Set(PRODUITS.filter((p) => p.gamme === filters.gamme).map((p) => p.ean));
    return ventesAll.filter((v) => {
      if (!weekSet.has(`${v.annee}-${v.semaine}`)) return false;
      if (gammeEans && !gammeEans.has(v.ean)) return false;
      return true;
    });
  }, [ventesAll, filters.period, filters.gamme]);

  const top = useMemo(() => topProduits(ventes, 8), [ventes]);

  // Répartition par gamme (utilisée notamment pour les enseignes e-commerce)
  const byGamme = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of ventes) {
      const p = findProduit(v.ean);
      if (!p) continue;
      map.set(p.gamme, (map.get(p.gamme) ?? 0) + v.caTTC);
    }
    const tot = Array.from(map.values()).reduce((s, x) => s + x, 0) || 1;
    return Array.from(map.entries())
      .map(([gamme, ca]) => ({ gamme, ca, pct: (ca / tot) * 100 }))
      .sort((a, b) => b.ca - a.ca);
  }, [ventes]);

  const totals = useMemo(() => {
    let ca = 0, qte = 0;
    const refs = new Set<string>();
    for (const v of ventes) { ca += v.caTTC; qte += v.qteVendue; refs.add(v.ean); }
    return { ca, qte, refs: refs.size };
  }, [ventes]);

  const prev4 = weekSerie.slice(-8, -4).reduce((s, w) => s + w.ca, 0);
  const last4 = weekSerie.slice(-4).reduce((s, w) => s + w.ca, 0);
  // undefined s'il n'y a pas de période précédente (pas de faux 0 %)
  const delta4 = prev4 > 0 ? ((last4 - prev4) / prev4) * 100 : undefined;
  const periodLabel = PERIOD_LABEL[filters.period] ?? filters.period;
  const ecom = distributeur ? isEcommerce(distributeur) : false;

  const byRegion = useMemo(() => {
    if (ecom) return [];
    const map = new Map<string, { region: string; ca: number; stores: number }>();
    for (const m of magasins) {
      const cur = map.get(m.region) ?? { region: m.region, ca: 0, stores: 0 };
      cur.stores += 1;
      map.set(m.region, cur);
    }
    // Ventes ne sont pas attribuées au magasin individuellement (agrégé), on distribue proportionnellement
    const totalCa = totals.ca;
    const totalStores = magasins.length;
    return Array.from(map.values())
      .map((r) => ({ ...r, ca: (totalCa * r.stores) / Math.max(1, totalStores) }))
      .sort((a, b) => b.ca - a.ca);
  }, [magasins, totals.ca, ecom]);

  // "Top magasins" — on alloue le CA du distributeur magasin par magasin
  // via `magasinRealShare()`, qui tient compte du parc réel (nbMagasins).
  // Les valeurs ici sont donc DIRECTEMENT comparables à celles affichées
  // sur la page détail du magasin (cohérence garantie).
  const topMagasins = useMemo(() => {
    if (ecom || !distributeur) return [];
    const totalCa = totals.ca;
    const totalQte = totals.qte;
    return magasins
      .map((m) => {
        const share = magasinRealShare(m, distributeur);
        // % de rupture déterministe diversifié (cohérent avec MagasinDetail)
        const ruptSeed = (m.code.charCodeAt(0)
          + m.code.charCodeAt(m.code.length - 1) * 7) % 100;
        return {
          ...m,
          ca: totalCa * share,
          qte: Math.round(totalQte * share),
          rupture: Math.round((ruptSeed / 100) * 22),
        };
      })
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 8);
  }, [magasins, totals, ecom, distributeur]);

  if (!distributeur) {
    return (
      <div className="max-w-[1320px] mx-auto py-12 text-center">
        <Store size={32} className="text-ink-muted mx-auto mb-3" />
        <p className="text-sm text-ink-muted">Distributeur introuvable</p>
        <Link to="/distributeurs" className="text-xs text-silverlit-red hover:underline mt-2 inline-block">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  const tauxRuptureGlobal = topMagasins.length > 0
    ? topMagasins.reduce((s, m) => s + m.rupture, 0) / topMagasins.length
    : 0;

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <Link to="/distributeurs" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink">
          <ArrowLeft size={12} />
          Tous les distributeurs
        </Link>
        <div className="mt-3 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${distributeur.logoColor}14` }}>
            <Store size={20} style={{ color: distributeur.logoColor }} />
          </div>
          <div className="flex-1">
            <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
              {distributeur.nom}
            </h1>
            <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
              {distributeur.type === 'GSS' ? 'Grande surface spécialisée' : distributeur.type === 'GMS' ? 'Grande & moyenne surface' : 'E-commerce'}
              {' · '}
              {ecom ? 'Plateforme nationale' : `${formatNumber(distributeur.nbMagasins)} magasins`}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            title="Génère un fichier .xlsx reproduisant la structure des tableaux internes Silverlit"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-ink dark:bg-night-ink text-white dark:text-black text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
          >
            <FileSpreadsheet size={13} />
            {exporting ? 'Export…' : 'Exporter le tableau des ventes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label={`CA · ${periodLabel}`} value={formatMoney(totals.ca, devise, { compact: true })} />
        <KPICard label={`Quantités · ${periodLabel}`} value={formatNumber(totals.qte, { compact: true })} />
        <KPICard label="Références distribuées" value={String(totals.refs)} deltaLabel={`sur la période`} />
        <KPICard
          label="Taux de rupture moyen"
          value={`${tauxRuptureGlobal.toFixed(1)}%`}
          intent={tauxRuptureGlobal > 15 ? 'danger' : tauxRuptureGlobal > 8 ? 'warn' : 'success'}
          deltaLabel="moyenne magasins"
        />
      </div>

      <Card className="mb-6">
        <SectionHeader
          title="Performance hebdomadaire"
          subtitle="Évolution du CA par semaine, sur les données importées"
          action={
            delta4 !== undefined ? (
              <Badge tone="info">
                Récent {delta4 > 0 ? '+' : ''}{delta4.toFixed(1)}%
              </Badge>
            ) : (
              <Badge>{weekSerie.length} semaine{weekSerie.length > 1 ? 's' : ''}</Badge>
            )
          }
        />
        <div className="h-[260px] -ml-4">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={weekSerie} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="distrib-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={distributeur.logoColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={distributeur.logoColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#d2d2d7" strokeDasharray="2 2" strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey={(d) => weekShort(d.annee, d.semaine)}
                tick={{ fontSize: 11, fill: '#86868b' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#86868b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatMoney(v as number, devise, { compact: true })}
                width={70}
              />
              <Tooltip
                formatter={(v: unknown) => typeof v === "number" ? formatMoney(v, devise, { decimals: 0 }) : ""}
                labelFormatter={(_, p) => {
                  const d = p?.[0]?.payload;
                  return d ? `${weekShort(d.annee, d.semaine)} · ${d.annee}` : '';
                }}
              />
              <Area type="monotone" dataKey="ca" stroke={distributeur.logoColor} strokeWidth={1.4} fill="url(#distrib-grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <SectionHeader title="Top produits chez ce distributeur" />
          <div className="space-y-1">
            {top.map((t, i) => {
              const maxCa = top[0].ca;
              const w = (t.ca / maxCa) * 100;
              return (
                <Link key={t.ean} to={`/produits/${t.ean}`} className="block group">
                  <div className="flex items-center gap-3 py-1.5">
                    <span className="text-2xs tabular text-ink-muted w-5 text-right">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[13px] text-ink dark:text-night-ink truncate group-hover:underline">
                          {findProduit(t.ean)?.libelle}
                        </p>
                        <span className="text-[13px] tabular text-ink dark:text-night-ink ml-3">
                          {formatMoney(t.ca, devise, { compact: true })}
                        </span>
                      </div>
                      <div className="h-0.5 bg-surface-alt dark:bg-night-alt rounded overflow-hidden">
                        <div className="h-full" style={{ background: distributeur.logoColor, width: `${w}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        {!ecom ? (
          <Card>
            <SectionHeader
              title="Top magasins"
              subtitle="Cliquez sur un magasin pour voir son détail"
            />
            <ul className="space-y-1">
              {topMagasins.map((m) => (
                <li key={m.code}>
                  <Link
                    to={`/distributeurs/${distributeur.id}/magasins/${m.code}`}
                    className="flex items-center justify-between gap-3 py-1.5 px-1 rounded hover:bg-surface-alt dark:hover:bg-night-alt group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink dark:text-night-ink truncate group-hover:underline">
                        {m.libelle}
                      </p>
                      <p className="text-2xs text-ink-muted">{m.ville} · {m.region}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] tabular text-ink dark:text-night-ink">
                        {formatMoney(m.ca, devise, { compact: true })}
                      </p>
                      <p className="text-2xs tabular text-ink-muted">
                        {formatNumber(m.qte)} u. · {m.rupture}% rupture
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <SectionHeader
              title="Répartition par gamme"
              subtitle={`Mix produit · ${periodLabel}`}
            />
            {byGamme.length === 0 ? (
              <p className="text-xs text-ink-muted py-8 text-center">
                Aucune vente sur la période sélectionnée.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {byGamme.map((g) => (
                  <li key={g.gamme}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-ink dark:text-night-ink">{g.gamme}</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular text-ink dark:text-night-ink">
                          {formatMoney(g.ca, devise, { compact: true })}
                        </span>
                        <span className="tabular text-2xs text-ink-muted w-9 text-right">
                          {g.pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1 bg-surface-alt dark:bg-night-alt rounded overflow-hidden">
                      <div
                        className="h-full"
                        style={{ background: distributeur.logoColor, width: `${g.pct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {byRegion.length > 0 && (
        <Card>
          <SectionHeader title="Performance par région" subtitle="Estimation au prorata du nombre de magasins" />
          <div className="h-[240px] -ml-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={byRegion} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
                <CartesianGrid stroke="#d2d2d7" strokeDasharray="2 2" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="region"
                  tick={{ fontSize: 10, fill: '#86868b' }}
                  axisLine={false}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#86868b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(v as number, devise, { compact: true })}
                  width={70}
                />
                <Tooltip formatter={(v: unknown) => typeof v === "number" ? formatMoney(v, devise, { decimals: 0 }) : ""} />
                <Bar dataKey="ca" fill={distributeur.logoColor} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
