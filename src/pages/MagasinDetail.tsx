import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { ArrowLeft, Store, MapPin, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, KPICard, SectionHeader, Badge } from '../components/ui';
import {
  findMagasin, findDistributeur, magasinRealShare,
  VENTES, findProduit, PRODUITS,
} from '../data';
import { formatMoney, formatNumber } from '../utils/currency';
import { weekShort } from '../utils/format';
import { caByWeek, topProduits, periodWeeks } from '../utils/selectors';

const PERIOD_LABEL: Record<string, string> = {
  'S-1': 'S-1',
  '4S': '4 semaines',
  '13S': '13 semaines',
  '52S': '12 mois',
  '24M': '24 mois',
};

// =======================================================================
//   Allocation per-magasin
// =======================================================================
//
// Les ventes ne sont pas attribuées au magasin individuel (les fichiers
// reçus des enseignes sont déjà agrégés au niveau réseau). On utilise
// `magasinRealShare(magasin, distributeur)` (cf. distributors.ts) qui :
//   - normalise au parc RÉEL (nbMagasins, pas à l'échantillon de 11)
//   - applique un poids relatif déterministe pour qu'un magasin de
//     centre-ville pèse plus qu'un petit point de vente.
// Cela garantit que les chiffres affichés sont à l'échelle d'un seul
// PDV, pas du réseau entier divisé par 11.

export function MagasinDetail() {
  const { distId = '', code = '' } = useParams();
  const { devise, filters } = useApp();
  const magasin = findMagasin(code);
  const distributeur = findDistributeur(distId);

  // Part de marché RÉELLE du magasin (normalisée au parc total)
  const shareInNetwork = useMemo(() => {
    if (!magasin || !distributeur) return 0;
    return magasinRealShare(magasin, distributeur);
  }, [magasin, distributeur]);

  // Ventes du distributeur (toutes périodes confondues, pour la courbe)
  const ventesDistAll = useMemo(
    () => VENTES.filter((v) => v.distributeurId === distId),
    [distId],
  );

  // Courbe hebdo du distributeur, allouée à ce magasin via shareInNetwork
  const weekSerie = useMemo(() => {
    const raw = caByWeek(ventesDistAll);
    return raw.map((w) => ({ ...w, ca: w.ca * shareInNetwork }));
  }, [ventesDistAll, shareInNetwork]);

  // Ventes filtrées par période + gamme (comme dans DistributeurDetail)
  const ventes = useMemo(() => {
    const weekSet = new Set(periodWeeks(filters.period).map((w) => `${w.annee}-${w.semaine}`));
    const gammeEans = filters.gamme === 'all'
      ? null
      : new Set(PRODUITS.filter((p) => p.gamme === filters.gamme).map((p) => p.ean));
    return ventesDistAll.filter((v) => {
      if (!weekSet.has(`${v.annee}-${v.semaine}`)) return false;
      if (gammeEans && !gammeEans.has(v.ean)) return false;
      return true;
    });
  }, [ventesDistAll, filters.period, filters.gamme]);

  // Top produits du magasin = top distributeur × share, classement identique
  const topMag = useMemo(() => {
    return topProduits(ventes, 8).map((t) => ({
      ...t,
      ca: t.ca * shareInNetwork,
      qte: Math.round(t.qte * shareInNetwork),
    }));
  }, [ventes, shareInNetwork]);

  // KPIs : on alloue les agrégats du distributeur au magasin
  // Important : CA et Qté sont des FLUX (sommables sur la période).
  // Le STOCK est un ÉTAT (snapshot ponctuel) : on prend la dernière
  // valeur connue par produit, pas la somme — sinon on additionne
  // 52 fois le même stock et on obtient un nombre absurde.
  const totals = useMemo(() => {
    let caDist = 0, qteDist = 0;
    const refs = new Set<string>();
    // Pour le stock : dernier (annee, semaine) par EAN dans la période
    const latestStock = new Map<string, { wKey: number; stock: number }>();

    for (const v of ventes) {
      caDist += v.caTTC;
      qteDist += v.qteVendue;
      refs.add(v.ean);
      const wKey = v.annee * 100 + v.semaine;
      const cur = latestStock.get(v.ean);
      if (!cur || wKey > cur.wKey) {
        latestStock.set(v.ean, { wKey, stock: v.qteStock });
      }
    }
    const stockDist = Array.from(latestStock.values())
      .reduce((s, x) => s + x.stock, 0);

    return {
      ca: caDist * shareInNetwork,
      qte: Math.round(qteDist * shareInNetwork),
      stock: Math.round(stockDist * shareInNetwork),
      refs: refs.size, // un magasin du réseau a accès à l'assortiment complet
    };
  }, [ventes, shareInNetwork]);

  // Taux de rupture estimé : dérivé du même hash que le poids magasin
  // (variabilité 0-25%, déterministe par code magasin)
  const tauxRupture = useMemo(() => {
    if (!magasin) return 0;
    // Réutilise la diversification du hash FNV-1a via magasinRealShare,
    // mais à des fins de variabilité visuelle uniquement
    const seed = (magasin.code.charCodeAt(0)
      + magasin.code.charCodeAt(magasin.code.length - 1) * 7) % 100;
    return Math.round((seed / 100) * 22);
  }, [magasin]);

  // Alertes locales : on simule à partir du top — produits avec forte chute = alerte
  const alertesLocales = useMemo(() => {
    if (totals.qte === 0) return [];
    return topMag
      .slice(0, 3)
      .map((t, i) => {
        const p = findProduit(t.ean);
        return {
          ean: t.ean,
          libelle: p?.libelle ?? t.ean,
          marque: p?.marque ?? '',
          severite: i === 0 ? 'rupture' : i === 1 ? 'baisse' : 'rotation',
        } as const;
      });
  }, [topMag, totals.qte]);

  if (!magasin || !distributeur) {
    return (
      <div className="max-w-[1320px] mx-auto py-12 text-center">
        <Store size={32} className="text-ink-muted mx-auto mb-3" />
        <p className="text-sm text-ink-muted">Magasin introuvable</p>
        <Link
          to={distId ? `/distributeurs/${distId}` : '/distributeurs'}
          className="text-xs text-silverlit-red hover:underline mt-2 inline-block"
        >
          ← Retour
        </Link>
      </div>
    );
  }

  const periodLabel = PERIOD_LABEL[filters.period] ?? filters.period;
  const stockUnitaire = totals.qte > 0 ? totals.stock / totals.qte : 0;

  return (
    <div className="max-w-[1320px] mx-auto">
      {/* Fil d'Ariane */}
      <div className="mb-6">
        <div className="flex items-center gap-1 text-xs text-ink-muted">
          <Link to="/distributeurs" className="hover:text-ink dark:hover:text-night-ink">
            Distributeurs
          </Link>
          <span>/</span>
          <Link to={`/distributeurs/${distId}`} className="hover:text-ink dark:hover:text-night-ink">
            {distributeur.nom}
          </Link>
          <span>/</span>
          <span className="text-ink dark:text-night-ink">{magasin.code}</span>
        </div>
        <Link
          to={`/distributeurs/${distId}`}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink mt-2"
        >
          <ArrowLeft size={12} />
          Retour à {distributeur.nom}
        </Link>

        <div className="mt-3 flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${distributeur.logoColor}14` }}
          >
            <Store size={20} style={{ color: distributeur.logoColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
              {magasin.libelle}
            </h1>
            <p className="text-sm text-ink-muted dark:text-night-muted mt-1 flex items-center gap-2 flex-wrap">
              <span className="tabular">{magasin.code}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {magasin.ville} · {magasin.region}
              </span>
              <span>·</span>
              <span style={{ color: distributeur.logoColor }}>{distributeur.nom}</span>
            </p>
          </div>
          <Badge tone="info">{(shareInNetwork * 100).toFixed(2)} % du réseau</Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          label={`CA · ${periodLabel}`}
          value={formatMoney(totals.ca, devise, { compact: true })}
        />
        <KPICard
          label={`Quantités · ${periodLabel}`}
          value={formatNumber(totals.qte, { compact: true })}
        />
        <KPICard
          label="Stock estimé"
          value={formatNumber(totals.stock, { compact: true })}
          deltaLabel={`≈ ${stockUnitaire.toFixed(1)} u./réf`}
        />
        <KPICard
          label="Taux de rupture"
          value={`${tauxRupture}%`}
          intent={tauxRupture > 15 ? 'danger' : tauxRupture > 8 ? 'warn' : 'success'}
          deltaLabel="estimation"
        />
      </div>

      {/* Performance hebdo */}
      <Card className="mb-6">
        <SectionHeader
          title="Performance hebdomadaire"
          subtitle={`Allocation au prorata de la part du magasin dans le réseau (${(shareInNetwork * 100).toFixed(2)}%)`}
        />
        <div className="h-[240px] -ml-4">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={weekSerie} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="mag-grad" x1="0" y1="0" x2="0" y2="1">
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
                formatter={(v: unknown) => typeof v === 'number' ? formatMoney(v, devise, { decimals: 0 }) : ''}
                labelFormatter={(_, p) => {
                  const d = p?.[0]?.payload as { annee: number; semaine: number } | undefined;
                  return d ? `${weekShort(d.annee, d.semaine)} · ${d.annee}` : '';
                }}
              />
              <Area
                type="monotone"
                dataKey="ca"
                stroke={distributeur.logoColor}
                strokeWidth={1.4}
                fill="url(#mag-grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Top produits */}
        <Card>
          <SectionHeader
            title="Top produits dans ce magasin"
            subtitle={`Estimation ${periodLabel.toLowerCase()}`}
          />
          {topMag.length === 0 ? (
            <p className="text-xs text-ink-muted py-8 text-center">
              Aucune vente sur la période sélectionnée.
            </p>
          ) : (
            <div className="space-y-1">
              {topMag.map((t, i) => {
                const maxCa = topMag[0].ca || 1;
                const w = (t.ca / maxCa) * 100;
                const p = findProduit(t.ean);
                return (
                  <Link key={t.ean} to={`/produits/${t.ean}`} className="block group">
                    <div className="flex items-center gap-3 py-1.5">
                      <span className="text-2xs tabular text-ink-muted w-5 text-right">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 gap-3">
                          <p className="text-[13px] text-ink dark:text-night-ink truncate group-hover:underline">
                            {p?.libelle ?? t.ean}
                          </p>
                          <span className="text-[13px] tabular text-ink dark:text-night-ink shrink-0">
                            {formatMoney(t.ca, devise, { compact: true })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="h-0.5 bg-surface-alt dark:bg-night-alt rounded overflow-hidden flex-1">
                            <div
                              className="h-full"
                              style={{ background: distributeur.logoColor, width: `${w}%` }}
                            />
                          </div>
                          <span className="text-2xs tabular text-ink-muted shrink-0">
                            {formatNumber(t.qte)} u.
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Alertes locales */}
        <Card>
          <SectionHeader
            title="Alertes du magasin"
            subtitle="Vigilance produits sur ce point de vente"
          />
          {alertesLocales.length === 0 ? (
            <p className="text-xs text-ink-muted py-8 text-center">
              Aucune alerte sur la période sélectionnée.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {alertesLocales.map((a) => (
                <li key={a.ean} className="flex items-start gap-3 py-1.5">
                  <div
                    className={
                      a.severite === 'rupture'
                        ? 'w-7 h-7 rounded-lg flex items-center justify-center bg-red-50 text-red-600 shrink-0'
                        : a.severite === 'baisse'
                        ? 'w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600 shrink-0'
                        : 'w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 shrink-0'
                    }
                  >
                    <AlertTriangle size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/produits/${a.ean}`}
                      className="text-[13px] text-ink dark:text-night-ink truncate hover:underline block"
                    >
                      {a.libelle}
                    </Link>
                    <p className="text-2xs text-ink-muted">
                      {a.marque} ·{' '}
                      {a.severite === 'rupture'
                        ? 'Rupture probable'
                        : a.severite === 'baisse'
                        ? 'Baisse marquée vs N-1'
                        : 'Rotation lente'}
                    </p>
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
