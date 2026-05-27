import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts';
import { ArrowLeft, Package } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, KPICard, SectionHeader, Badge } from '../components/ui';
import { DISTRIBUTEURS, findProduit, VENTES } from '../data';
import { formatMoney, formatNumber, formatPct } from '../utils/currency';
import { weekShort, shortDistribName } from '../utils/format';
import { caByWeek, periodWeeks } from '../utils/selectors';

const PERIOD_LABEL: Record<string, string> = {
  'S-1': 'la dernière semaine',
  '4S': '4 semaines',
  '13S': '13 semaines',
  '52S': '12 mois',
  '24M': '24 mois',
};

export function ProduitDetail() {
  const { ean = '' } = useParams();
  const { devise, alertes, filters } = useApp();
  const produit = findProduit(ean);

  // Historique complet : utilisé pour le graphique 24 mois (contexte)
  const ventesAll = useMemo(() => VENTES.filter((v) => v.ean === ean), [ean]);
  const weekSerie = useMemo(() => caByWeek(ventesAll), [ventesAll]);

  // Ventes sur la période sélectionnée (filtre global)
  const ventesPeriode = useMemo(() => {
    const weekSet = new Set(periodWeeks(filters.period).map((w) => `${w.annee}-${w.semaine}`));
    return ventesAll.filter((v) => weekSet.has(`${v.annee}-${v.semaine}`));
  }, [ventesAll, filters.period]);

  const totals = useMemo(() => {
    let ca = 0, qte = 0, stock = 0;
    for (const v of ventesPeriode) { ca += v.caTTC; qte += v.qteVendue; stock = Math.max(stock, v.qteStock); }
    return { ca, qte, stock };
  }, [ventesPeriode]);

  const last4 = weekSerie.slice(-4).reduce((s, w) => s + w.ca, 0);
  const prev4 = weekSerie.slice(-8, -4).reduce((s, w) => s + w.ca, 0);
  const delta4 = prev4 > 0 ? ((last4 - prev4) / prev4) * 100 : 0;

  // Répartition par enseigne sur la période sélectionnée.
  // On ne liste QUE les distributeurs qui référencent réellement le produit.
  const distribSplit = useMemo(() => {
    const map = new Map<string, { ca: number; qte: number; stock: number }>();
    for (const v of ventesPeriode) {
      const cur = map.get(v.distributeurId) ?? { ca: 0, qte: 0, stock: 0 };
      cur.ca += v.caTTC; cur.qte += v.qteVendue; cur.stock = Math.max(cur.stock, v.qteStock);
      map.set(v.distributeurId, cur);
    }
    return DISTRIBUTEURS
      .filter((d) => map.has(d.id))
      .map((d) => ({
        ...d,
        ca: map.get(d.id)!.ca,
        qte: map.get(d.id)!.qte,
        stock: map.get(d.id)!.stock,
      }))
      .sort((a, b) => b.ca - a.ca);
  }, [ventesPeriode]);

  // Distributeurs qui référencent le produit (toutes périodes confondues)
  const nbEnseignesPorteuses = useMemo(
    () => new Set(ventesAll.map((v) => v.distributeurId)).size,
    [ventesAll],
  );

  const alertesProduit = alertes.filter((a) => a.ean === ean);
  const periodLabel = PERIOD_LABEL[filters.period] ?? filters.period;

  if (!produit) {
    return (
      <div className="max-w-[1320px] mx-auto py-12 text-center">
        <Package size={32} className="text-ink-muted mx-auto mb-3" />
        <p className="text-sm text-ink-muted">Produit introuvable</p>
        <Link to="/produits" className="text-xs text-silverlit-red hover:underline mt-2 inline-block">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <Link to="/produits" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink">
          <ArrowLeft size={12} />
          Tous les produits
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
              {produit.libelle}
            </h1>
            <p className="text-sm text-ink-muted dark:text-night-muted mt-1 tabular">
              EAN {produit.ean} · Réf. fournisseur {produit.refFournisseur}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={produit.statut === 'actif' ? 'success' : produit.statut === 'fin_de_vie' ? 'warn' : 'neutral'}>
              {produit.statut === 'actif' ? 'Actif' : produit.statut === 'fin_de_vie' ? 'Fin de vie' : 'Retiré'}
            </Badge>
            <Badge tone="info">{produit.gamme}</Badge>
            <Badge>{produit.categorie}</Badge>
            <span className="text-sm tabular text-ink dark:text-night-ink ml-2">
              PVC {formatMoney(produit.prixConseille, devise, { decimals: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label={`CA · ${periodLabel}`} value={formatMoney(totals.ca, devise, { compact: true })} />
        <KPICard label={`Quantités · ${periodLabel}`} value={formatNumber(totals.qte, { compact: true })} />
        <KPICard
          label="4 semaines glissantes"
          value={formatMoney(last4, devise, { compact: true })}
          delta={delta4}
          deltaLabel="vs 4 semaines précédentes"
        />
        <KPICard label="Stock disponible" value={formatNumber(totals.stock)} deltaLabel="sur tous distributeurs" />
      </div>

      <Card className="mb-6">
        <SectionHeader title="Historique 24 mois" subtitle="Évolution hebdomadaire du chiffre d'affaires" />
        <div className="h-[260px] -ml-4">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={weekSerie} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="prod-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#007aff" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#007aff" stopOpacity={0} />
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
              <Area type="monotone" dataKey="ca" stroke="#007aff" strokeWidth={1.4} fill="url(#prod-grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <SectionHeader
            title="Répartition par enseigne"
            subtitle={`Référencé chez ${distribSplit.length} enseigne${distribSplit.length > 1 ? 's' : ''} · ${periodLabel}`}
          />
          {distribSplit.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-center">
              <div>
                <p className="text-sm text-ink-muted dark:text-night-muted">Aucune vente sur la période</p>
                <p className="text-2xs text-ink-muted mt-1">
                  Référencé chez {nbEnseignesPorteuses} enseigne{nbEnseignesPorteuses > 1 ? 's' : ''} au total —
                  élargissez la période pour visualiser la répartition.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={distribSplit} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
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
                    dataKey="nom"
                    tick={{ fontSize: 11, fill: '#1d1d1f' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => shortDistribName(String(v))}
                    width={130}
                    interval={0}
                  />
                  <Tooltip formatter={(v: unknown, name: unknown) => typeof v === 'number' ? [formatMoney(v, devise, { decimals: 0 }), String(name ?? '')] : ['', String(name ?? '')]} />
                  <Bar dataKey="ca" radius={[0, 4, 4, 0]} barSize={16}>
                    {distribSplit.map((d) => (
                      <Cell key={d.id} fill={d.logoColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Stock par distributeur" subtitle="Couverture estimée en semaines" />
          {distribSplit.length === 0 && (
            <p className="text-xs text-ink-muted dark:text-night-muted py-8 text-center">
              Pas de stock remonté sur la période sélectionnée.
            </p>
          )}
          <ul className="space-y-3">
            {distribSplit.map((d) => {
              const avgWeek = d.qte / Math.max(1, weekSerie.length);
              const couverture = avgWeek > 0 ? d.stock / avgWeek : 0;
              // Échelle adaptée à la distribution jouet :
              //  < 2 sem = risque rupture · 2-12 sem = sain
              //  12-26 sem = lent mais acceptable · > 26 sem = surstockage
              const tone =
                couverture < 2 ? 'danger'
                : couverture <= 12 ? 'success'
                : couverture <= 26 ? 'neutral'
                : 'warn';
              return (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <Link to={`/distributeurs/${d.id}`} className="text-ink dark:text-night-ink hover:underline">
                    {d.nom}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="tabular text-ink-muted dark:text-night-muted">
                      {formatNumber(d.stock)} u.
                    </span>
                    <Badge tone={tone}>{couverture.toFixed(1)} sem.</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {alertesProduit.length > 0 && (
        <Card>
          <SectionHeader title="Alertes liées" subtitle={`${alertesProduit.length} alerte${alertesProduit.length > 1 ? 's' : ''} sur ce produit`} />
          <ul className="space-y-2">
            {alertesProduit.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2 border-b border-hair hairline last:border-b-0">
                <div className={
                  'mt-1 shrink-0 w-1.5 h-1.5 rounded-full ' +
                  (a.severite === 'haute' ? 'bg-brand-red' : a.severite === 'moyenne' ? 'bg-brand-orange' : 'bg-ink-muted')
                } />
                <div className="flex-1">
                  <p className="text-[13px] text-ink dark:text-night-ink">{a.message}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={a.severite === 'haute' ? 'danger' : a.severite === 'moyenne' ? 'warn' : 'neutral'}>
                      {a.type}
                    </Badge>
                    <span className="text-2xs text-ink-muted">
                      {a.delta !== undefined && formatPct(a.delta, { signed: true })}
                    </span>
                    <span className="text-2xs text-ink-muted ml-auto">{a.statut === 'ouverte' ? 'Ouverte' : 'Traitée'}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
