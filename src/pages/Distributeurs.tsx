import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, MapPin, Globe, FileSpreadsheet, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, SectionHeader, Badge } from '../components/ui';
import { DISTRIBUTEURS, MAGASINS, TOTAL_POINTS_VENTE, isEcommerce } from '../data';
import { filteredVentes } from '../utils/selectors';
import { formatMoney, formatNumber } from '../utils/currency';
import { exportDistributeurXlsx, exportAllDistributeursXlsx } from '../utils/exportDistribTable';

// Coordonnées approximatives d'une boîte englobante France métropolitaine
const FR_BBOX = { minLng: -5.5, maxLng: 9.5, minLat: 41.0, maxLat: 51.5 };

function toXY(lat: number, lng: number, w: number, h: number) {
  const x = ((lng - FR_BBOX.minLng) / (FR_BBOX.maxLng - FR_BBOX.minLng)) * w;
  const y = ((FR_BBOX.maxLat - lat) / (FR_BBOX.maxLat - FR_BBOX.minLat)) * h;
  return { x, y };
}

export function Distributeurs() {
  const { devise, filters } = useApp();
  const ventes = useMemo(() => filteredVentes(filters), [filters]);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  async function exportOne(distId: string) {
    if (exportingId || bulkProgress) return;
    setExportingId(distId);
    try {
      await exportDistributeurXlsx(distId);
    } catch (e) {
      console.error('Export Excel échoué', e);
    } finally {
      setExportingId(null);
    }
  }

  async function exportAll() {
    if (bulkProgress || exportingId) return;
    setBulkProgress({ done: 0, total: DISTRIBUTEURS.length });
    try {
      await exportAllDistributeursXlsx(
        DISTRIBUTEURS.map((d) => d.id),
        (done, total) => setBulkProgress({ done, total }),
      );
    } catch (e) {
      console.error('Export Excel global échoué', e);
    } finally {
      setBulkProgress(null);
    }
  }

  const stats = useMemo(() => {
    const map = new Map<string, { ca: number; qte: number; refs: Set<string> }>();
    for (const v of ventes) {
      const cur = map.get(v.distributeurId) ?? { ca: 0, qte: 0, refs: new Set() };
      cur.ca += v.caTTC; cur.qte += v.qteVendue; cur.refs.add(v.ean);
      map.set(v.distributeurId, cur);
    }
    return DISTRIBUTEURS.map((d) => ({
      ...d,
      ca: map.get(d.id)?.ca ?? 0,
      qte: map.get(d.id)?.qte ?? 0,
      refs: map.get(d.id)?.refs.size ?? 0,
    })).sort((a, b) => b.ca - a.ca);
  }, [ventes]);

  // Points physiques affichés sur la carte (e-commerce exclu)
  const mapStores = useMemo(() => MAGASINS.filter((m) => {
    const d = DISTRIBUTEURS.find((dd) => dd.id === m.distributeurId);
    return d && !isEcommerce(d);
  }), []);

  const W = 420, H = 460;

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
            Distributeurs
          </h1>
          <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
            {DISTRIBUTEURS.length} enseignes partenaires · {formatNumber(TOTAL_POINTS_VENTE)} points de vente physiques · 2 plateformes e-commerce
          </p>
        </div>
        <button
          onClick={exportAll}
          disabled={!!bulkProgress || !!exportingId}
          title="Génère un fichier .xlsx par distributeur, au format des tableaux internes Silverlit"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-ink dark:bg-night-ink text-white dark:text-black text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          <FileSpreadsheet size={13} />
          {bulkProgress
            ? `Export ${bulkProgress.done}/${bulkProgress.total}…`
            : 'Exporter tous les tableaux'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 space-y-3">
          {stats.map((d) => (
            <Card
              key={d.id}
              className="hover:border-silverlit-red/30 hover:shadow-[0_8px_24px_rgba(227,6,19,0.06)] hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Link to={`/distributeurs/${d.id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${d.logoColor}14` }}>
                    {isEcommerce(d)
                      ? <Globe size={16} style={{ color: d.logoColor }} />
                      : <Store size={16} style={{ color: d.logoColor }} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink group-hover:underline">{d.nom}</p>
                    <p className="text-2xs text-ink-muted dark:text-night-muted mt-0.5">
                      {d.type === 'GSS' ? 'Grande surface spécialisée' : d.type === 'GMS' ? 'Grande & moyenne surface' : 'E-commerce'}
                      {' · '}
                      {isEcommerce(d) ? 'Plateforme nationale' : `${formatNumber(d.nbMagasins)} magasins`}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xs uppercase tracking-wider text-ink-muted">CA</p>
                    <p className="text-[15px] tabular text-ink dark:text-night-ink mt-0.5">
                      {formatMoney(d.ca, devise, { compact: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xs uppercase tracking-wider text-ink-muted">Qté</p>
                    <p className="text-[15px] tabular text-ink dark:text-night-ink mt-0.5">
                      {formatNumber(d.qte, { compact: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xs uppercase tracking-wider text-ink-muted">Réfs</p>
                    <p className="text-[15px] tabular text-ink dark:text-night-ink mt-0.5">{d.refs}</p>
                  </div>
                  <button
                    onClick={() => exportOne(d.id)}
                    disabled={!!bulkProgress || !!exportingId}
                    title={`Télécharger le tableau des ventes ${d.nom} (.xlsx)`}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-hair hairline text-ink-muted hover:text-ink hover:bg-surface-alt dark:hover:bg-night-alt disabled:opacity-40"
                  >
                    {exportingId === d.id
                      ? <span className="text-2xs tabular">…</span>
                      : <Download size={13} />}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <SectionHeader title="Couverture France" subtitle="Échantillon représentatif des implantations" />
          <div className="relative" style={{ width: '100%', maxWidth: W, margin: '0 auto', aspectRatio: `${W}/${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
              {/* Silhouette schématique de la France via polygone simple */}
              <path
                d="M120 60 L240 50 L320 85 L380 120 L400 200 L380 260 L370 320 L320 380 L260 420 L210 430 L170 420 L130 400 L85 360 L75 300 L65 250 L80 200 L75 150 L90 110 Z"
                fill="#fafafa"
                stroke="#e5e5e5"
                strokeWidth="0.5"
                className="dark:fill-night-alt dark:stroke-night-line"
              />
              {mapStores.map((m, i) => {
                const { x, y } = toXY(m.lat, m.lng, W, H);
                const d = DISTRIBUTEURS.find((dd) => dd.id === m.distributeurId)!;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="2.6"
                    fill={d.logoColor}
                    fillOpacity={0.85}
                    stroke="white"
                    strokeWidth="0.5"
                  />
                );
              })}
            </svg>
          </div>
          <ul className="mt-3 space-y-1.5">
            {DISTRIBUTEURS.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.logoColor }} />
                <span className="text-ink dark:text-night-ink flex-1 truncate">{d.nom}</span>
                <span className="text-2xs text-ink-muted tabular shrink-0">
                  {isEcommerce(d) ? 'e-commerce' : `${formatNumber(d.nbMagasins)} mag.`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-4 py-3 border-b border-hair hairline flex items-center gap-2">
          <MapPin size={14} className="text-ink-muted" />
          <h2 className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink">
            Magasins — échantillon représentatif
          </h2>
          <Badge>{mapStores.length} affichés</Badge>
          <span className="text-2xs text-ink-muted ml-auto hidden sm:inline">
            Parc complet : {formatNumber(TOTAL_POINTS_VENTE)} points de vente
          </span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-night-surface">
              <tr className="border-b border-hair hairline">
                <th className="text-left px-4 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Magasin</th>
                <th className="text-left px-4 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Ville</th>
                <th className="text-left px-4 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Région</th>
                <th className="text-left px-4 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Enseigne</th>
              </tr>
            </thead>
            <tbody>
              {mapStores.map((m) => {
                const d = DISTRIBUTEURS.find((dd) => dd.id === m.distributeurId)!;
                return (
                  <tr key={m.code} className="border-b border-hair hairline last:border-b-0 hover:bg-surface-alt dark:hover:bg-night-alt">
                    <td className="px-4 py-2 text-[13px] tabular">
                      <Link
                        to={`/distributeurs/${d.id}/magasins/${m.code}`}
                        className="text-ink dark:text-night-ink hover:underline"
                      >
                        {m.code} · {m.libelle}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-[13px] text-ink-muted">{m.ville}</td>
                    <td className="px-4 py-2 text-2xs text-ink-muted">{m.region}</td>
                    <td className="px-4 py-2">
                      <Link to={`/distributeurs/${d.id}`} className="text-2xs hover:underline" style={{ color: d.logoColor }}>
                        {d.nom}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
