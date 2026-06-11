import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowUpDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui';
import { PRODUITS, findProduit } from '../data';
import { filteredVentes } from '../utils/selectors';
import { formatMoney, formatNumber } from '../utils/currency';
import { classNames } from '../utils/format';

type SortKey = 'libelle' | 'ca' | 'qte' | 'stock';

const PAGE_SIZE = 20;

export function Produits() {
  const { devise, filters } = useApp();
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState<'tous' | 'actif' | 'fin_de_vie' | 'retire'>('tous');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('ca');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const ventes = useMemo(() => filteredVentes(filters), [filters]);

  const enriched = useMemo(() => {
    const stats = new Map<string, { ca: number; qte: number; stock: number }>();
    for (const v of ventes) {
      // Clé = EAN canonique du catalogue : les fichiers sources stockent parfois
      // l'EAN avec un zéro de tête ("0730002030513") absent du catalogue
      // ("730002030513"). Sans normalisation, les ventes ne s'apparient jamais
      // au produit et il s'affiche à 0 alors qu'il s'est vendu.
      const key = findProduit(v.ean)?.ean ?? v.ean;
      const s = stats.get(key) ?? { ca: 0, qte: 0, stock: 0 };
      s.ca += v.caTTC;
      s.qte += v.qteVendue;
      s.stock = Math.max(s.stock, v.qteStock);
      stats.set(key, s);
    }
    return PRODUITS.map((p) => ({
      ...p,
      stats: stats.get(p.ean) ?? { ca: 0, qte: 0, stock: 0 },
    }));
  }, [ventes]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    let res = enriched;
    if (term) {
      res = res.filter(
        (p) =>
          p.libelle.toLowerCase().includes(term) ||
          p.ean.includes(term) ||
          p.refFournisseur.toLowerCase().includes(term),
      );
    }
    if (statut !== 'tous') res = res.filter((p) => p.statut === statut);

    res = [...res].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'libelle') cmp = a.libelle.localeCompare(b.libelle);
      else if (sortKey === 'ca') cmp = a.stats.ca - b.stats.ca;
      else if (sortKey === 'qte') cmp = a.stats.qte - b.stats.qte;
      else cmp = a.stats.stock - b.stats.stock;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return res;
  }, [enriched, q, statut, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
    setPage(1);
  }

  const SortBtn = ({ k, children, align = 'left' }: { k: SortKey; children: React.ReactNode; align?: 'left' | 'right' }) => (
    <button
      onClick={() => toggleSort(k)}
      className={classNames(
        'flex items-center gap-1 text-2xs uppercase tracking-wider text-ink-muted hover:text-ink dark:hover:text-night-ink',
        align === 'right' && 'justify-end w-full',
      )}
    >
      {children}
      <ArrowUpDown size={10} className={sortKey === k ? 'opacity-100' : 'opacity-40'} />
    </button>
  );

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
          Produits
        </h1>
        <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
          {filtered.length} référence{filtered.length > 1 ? 's' : ''} · catalogue Silverlit France
        </p>
      </div>

      <Card padded={false}>
        <div className="flex items-center gap-2 p-4 border-b border-hair hairline">
          <div className="flex items-center gap-2 px-3 h-8 rounded-lg border border-hair hairline flex-1 max-w-md">
            <Search size={13} className="text-ink-muted" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par nom, EAN ou référence…"
              className="bg-transparent text-sm text-ink dark:text-night-ink placeholder:text-ink-muted outline-none w-full"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            {(['tous', 'actif', 'fin_de_vie', 'retire'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatut(s);
                  setPage(1);
                }}
                className={classNames(
                  'px-2.5 h-8 rounded-lg text-xs transition-colors',
                  statut === s
                    ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                    : 'text-ink-muted hover:bg-surface-alt dark:hover:bg-night-alt',
                )}
              >
                {s === 'tous' ? 'Tous' : s === 'fin_de_vie' ? 'Fin de vie' : s === 'retire' ? 'Retiré' : 'Actif'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair hairline">
                <th className="px-4 py-2.5 text-left">
                  <SortBtn k="libelle">Référence</SortBtn>
                </th>
                <th className="px-4 py-2.5 text-left">
                  <span className="text-2xs uppercase tracking-wider text-ink-muted">EAN</span>
                </th>
                <th className="px-4 py-2.5 text-left">
                  <span className="text-2xs uppercase tracking-wider text-ink-muted">Gamme</span>
                </th>
                <th className="px-4 py-2.5 text-right">
                  <SortBtn k="ca" align="right">CA</SortBtn>
                </th>
                <th className="px-4 py-2.5 text-right">
                  <SortBtn k="qte" align="right">Qté</SortBtn>
                </th>
                <th className="px-4 py-2.5 text-right">
                  <SortBtn k="stock" align="right">Stock</SortBtn>
                </th>
                <th className="px-4 py-2.5 text-right">
                  <span className="text-2xs uppercase tracking-wider text-ink-muted">Statut</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {slice.map((p) => (
                <tr
                  key={p.ean}
                  className="border-b border-hair hairline last:border-b-0 hover:bg-surface-alt dark:hover:bg-night-alt transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link to={`/produits/${p.ean}`} className="text-[13px] text-ink dark:text-night-ink hover:underline">
                      {p.libelle}
                    </Link>
                    <p className="text-2xs text-ink-muted mt-0.5">Réf. {p.refFournisseur}</p>
                  </td>
                  <td className="px-4 py-3 text-2xs tabular text-ink-muted">{p.ean}</td>
                  <td className="px-4 py-3 text-2xs text-ink-muted">{p.gamme}</td>
                  <td className="px-4 py-3 text-right text-[13px] tabular text-ink dark:text-night-ink">
                    {formatMoney(p.stats.ca, devise, { compact: true })}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] tabular text-ink dark:text-night-ink">
                    {formatNumber(p.stats.qte)}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] tabular text-ink-muted">
                    {formatNumber(p.stats.stock)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={p.statut === 'actif' ? 'success' : p.statut === 'fin_de_vie' ? 'warn' : 'neutral'}>
                      {p.statut === 'actif' ? 'Actif' : p.statut === 'fin_de_vie' ? 'FDV' : 'Retiré'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-hair hairline">
          <span className="text-2xs text-ink-muted dark:text-night-muted">
            Page {safePage} / {totalPages} · {filtered.length} résultats
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="text-xs px-2.5 h-7 rounded-md border border-hair hairline disabled:opacity-40 hover:bg-surface-alt dark:hover:bg-night-alt"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="text-xs px-2.5 h-7 rounded-md border border-hair hairline disabled:opacity-40 hover:bg-surface-alt dark:hover:bg-night-alt"
            >
              Suivant
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
