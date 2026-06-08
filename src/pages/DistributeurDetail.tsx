import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { ArrowLeft, Store, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, KPICard, SectionHeader, Badge } from '../components/ui';
import {
  findDistributeur, VENTES, findProduit, PRODUITS, isEcommerce,
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
          label="Panier moyen"
          value={formatMoney(totals.qte > 0 ? totals.ca / totals.qte : 0, devise, { decimals: 2 })}
          deltaLabel="CA / quantité"
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
      </div>
    </div>
  );
}
