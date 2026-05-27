import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCheck, Filter, History, Bell, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge, Empty } from '../components/ui';
import { findDistributeur, findProduit } from '../data';
import { formatRelativeDate, classNames } from '../utils/format';
import { formatPct } from '../utils/currency';
import type { Alerte, AlerteType, Severite } from '../types';

const TYPES: Array<{ value: AlerteType | 'all'; label: string }> = [
  { value: 'all', label: 'Tous types' },
  { value: 'rupture', label: 'Ruptures' },
  { value: 'baisse', label: 'Baisses anormales' },
  { value: 'croissance', label: 'Croissances fortes' },
  { value: 'rotation', label: 'Rotation' },
];

const SEV: Array<{ value: Severite | 'all'; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'haute', label: 'Haute' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'basse', label: 'Basse' },
];

function typeTone(t: AlerteType) {
  return t === 'rupture' ? 'danger' : t === 'baisse' ? 'warn' : t === 'croissance' ? 'success' : 'info';
}
function dotColor(s: Severite) {
  return s === 'haute' ? 'bg-brand-red' : s === 'moyenne' ? 'bg-brand-orange' : 'bg-ink-muted';
}
const SEV_RANK = { haute: 0, moyenne: 1, basse: 2 };

export function Alertes() {
  const { alertes, markAlerteTraitee, markAllAlertesTraitees, reopenAlerte, filters } = useApp();
  const [mode, setMode] = useState<'courant' | 'historique'>('courant');
  const [typeF, setTypeF] = useState<AlerteType | 'all'>('all');
  const [sevF, setSevF] = useState<Severite | 'all'>('all');

  // Filtres communs (globaux barre du haut + locaux type/sévérité)
  function passesFilters(a: Alerte): boolean {
    if (filters.distributeurId !== 'all' && a.distributeurId !== filters.distributeurId) return false;
    if (filters.gamme !== 'all') {
      const p = findProduit(a.ean);
      if (!p || p.gamme !== filters.gamme) return false;
    }
    if (typeF !== 'all' && a.type !== typeF) return false;
    if (sevF !== 'all' && a.severite !== sevF) return false;
    return true;
  }

  function sortAlertes(arr: Alerte[]): Alerte[] {
    return [...arr].sort((a, b) => {
      const cmp = SEV_RANK[a.severite] - SEV_RANK[b.severite];
      return cmp !== 0 ? cmp : b.dateCreation.localeCompare(a.dateCreation);
    });
  }

  // Une alerte est dans EXACTEMENT une zone : ouverte → « En cours », traitée → « Historique »
  const ouvertes = useMemo(() => alertes.filter((a) => a.statut === 'ouverte'), [alertes]);
  const traitees = useMemo(() => alertes.filter((a) => a.statut === 'traitee'), [alertes]);

  const courantFiltered = useMemo(
    () => sortAlertes(ouvertes.filter(passesFilters)),
    [ouvertes, typeF, sevF, filters.distributeurId, filters.gamme],
  );
  const histoFiltered = useMemo(
    () => sortAlertes(traitees.filter(passesFilters)),
    [traitees, typeF, sevF, filters.distributeurId, filters.gamme],
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = { rupture: 0, baisse: 0, croissance: 0, rotation: 0 };
    for (const a of ouvertes) out[a.type] += 1;
    return out;
  }, [ouvertes]);

  const list = mode === 'courant' ? courantFiltered : histoFiltered;

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
            Alertes
          </h1>
          <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
            Anomalies détectées sur les ventes hebdomadaires
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['rupture', 'baisse', 'croissance', 'rotation'] as const).map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-xs">
              <span className={classNames(
                'w-1.5 h-1.5 rounded-full',
                t === 'rupture' ? 'bg-brand-red' : t === 'baisse' ? 'bg-brand-orange' : t === 'croissance' ? 'bg-brand-green' : 'bg-brand-blue',
              )} />
              <span className="text-ink-muted">{t}</span>
              <span className="tabular text-ink dark:text-night-ink">{counts[t] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bascule En cours / Historique */}
      <div className="mb-4 inline-flex bg-surface-alt dark:bg-night-alt rounded-lg p-0.5">
        <button
          onClick={() => setMode('courant')}
          className={classNames(
            'inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-md transition-colors',
            mode === 'courant'
              ? 'bg-white dark:bg-night-surface text-ink dark:text-night-ink shadow-[0_0.5px_0_rgba(0,0,0,0.06)]'
              : 'text-ink-muted hover:text-ink dark:hover:text-night-ink',
          )}
        >
          <Bell size={12} />
          En cours
          {ouvertes.length > 0 && (
            <span className="tabular bg-silverlit-red text-white rounded-full px-1.5 text-2xs">
              {ouvertes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMode('historique')}
          className={classNames(
            'inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-md transition-colors',
            mode === 'historique'
              ? 'bg-white dark:bg-night-surface text-ink dark:text-night-ink shadow-[0_0.5px_0_rgba(0,0,0,0.06)]'
              : 'text-ink-muted hover:text-ink dark:hover:text-night-ink',
          )}
        >
          <History size={12} />
          Historique
          {traitees.length > 0 && (
            <span className="tabular text-ink-muted text-2xs">{traitees.length}</span>
          )}
        </button>
      </div>

      <Card padded={false}>
        {/* Barre de filtres */}
        <div className="px-4 py-3 border-b border-hair hairline flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-ink-muted" />
          <div className="flex items-center gap-1 flex-wrap">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTypeF(t.value)}
                className={classNames(
                  'text-xs px-2.5 h-7 rounded-md',
                  typeF === t.value
                    ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                    : 'text-ink-muted hover:bg-surface-alt dark:hover:bg-night-alt',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-surface-line dark:bg-night-line mx-1" />
          <div className="flex items-center gap-1">
            {SEV.map((s) => (
              <button
                key={s.value}
                onClick={() => setSevF(s.value)}
                className={classNames(
                  'text-xs px-2.5 h-7 rounded-md',
                  sevF === s.value
                    ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                    : 'text-ink-muted hover:bg-surface-alt dark:hover:bg-night-alt',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {mode === 'courant' && courantFiltered.length > 0 && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Masquer ${courantFiltered.length} alerte${courantFiltered.length > 1 ? 's' : ''} ? Elle${courantFiltered.length > 1 ? 's passeront' : ' passera'} dans l'historique (réversible).`,
                  )
                ) {
                  markAllAlertesTraitees(courantFiltered.map((a) => a.id));
                }
              }}
              className="ml-auto inline-flex items-center gap-1.5 border border-hair hairline px-2.5 h-7 rounded-md text-xs text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt transition-colors"
            >
              <CheckCheck size={12} />
              Tout masquer
            </button>
          )}
        </div>

        {/* Liste */}
        {list.length === 0 ? (
          <Empty
            icon={mode === 'historique' ? <History size={22} className="opacity-30" /> : <Bell size={22} className="opacity-30" />}
            title={
              mode === 'courant'
                ? (ouvertes.length === 0 ? 'Aucune alerte en cours' : 'Aucune alerte avec ces filtres')
                : (traitees.length === 0 ? 'Aucune alerte dans l\'historique' : 'Aucune entrée avec ces filtres')
            }
            hint={
              mode === 'courant'
                ? (ouvertes.length === 0 ? 'Toutes les alertes ont été traitées.' : 'Élargissez les critères de filtre.')
                : (traitees.length === 0 ? 'Les alertes que vous masquez apparaissent ici — et peuvent être démasquées.' : 'Élargissez les critères de filtre.')
            }
          />
        ) : (
          <ul>
            {list.map((a) => {
              const d = a.distributeurId ? findDistributeur(a.distributeurId) : null;
              return (
                <li
                  key={a.id}
                  className="px-4 py-3 border-b border-hair hairline last:border-b-0 hover:bg-surface-alt/50 dark:hover:bg-night-alt/40"
                >
                  <div className="flex items-start gap-3">
                    <div className={classNames('mt-1 shrink-0 w-2 h-2 rounded-full', dotColor(a.severite))} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {findProduit(a.ean) ? (
                          <Link
                            to={`/produits/${a.ean}`}
                            className="text-[14px] font-medium tracking-tightish text-ink dark:text-night-ink hover:underline"
                          >
                            {a.libelle}
                          </Link>
                        ) : (
                          // EAN inconnu du catalogue : on n'expose pas un lien cassé
                          <span
                            className="text-[14px] font-medium tracking-tightish text-ink dark:text-night-ink"
                            title="Produit non trouvé dans le catalogue actuel"
                          >
                            {a.libelle}
                          </span>
                        )}
                        <Badge tone={typeTone(a.type)}>{a.type}</Badge>
                        <Badge>{a.severite}</Badge>
                        {d && (
                          <Link
                            to={`/distributeurs/${d.id}`}
                            className="text-2xs hover:underline"
                            style={{ color: d.logoColor }}
                          >
                            {d.nom}
                          </Link>
                        )}
                        {a.delta !== undefined && (
                          <span className={classNames(
                            'text-2xs tabular',
                            a.delta > 0 ? 'text-brand-green' : 'text-brand-red',
                          )}>
                            {formatPct(a.delta, { signed: true })}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-ink dark:text-night-ink mt-1.5">{a.message}</p>
                      <p className="text-2xs text-ink-muted mt-1.5 tabular">
                        {a.id} · {formatRelativeDate(a.dateCreation)}
                      </p>
                    </div>
                    {mode === 'courant' ? (
                      <button
                        onClick={() => markAlerteTraitee(a.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 border border-hair hairline px-2.5 h-8 rounded-lg text-xs text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt"
                      >
                        <Check size={12} />
                        Masquer
                      </button>
                    ) : (
                      <button
                        onClick={() => reopenAlerte(a.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 border border-hair hairline px-2.5 h-8 rounded-lg text-xs text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt"
                      >
                        <RotateCcw size={12} />
                        Démasquer
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {mode === 'historique' && traitees.length > 0 && (
          <div className="px-4 py-2.5 border-t border-hair hairline">
            <p className="text-2xs text-ink-muted dark:text-night-muted">
              Les alertes masquées sont conservées ici et restent réversibles : « Démasquer » les
              repasse en alerte en cours. Une alerte n'est jamais présente dans les deux onglets.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
