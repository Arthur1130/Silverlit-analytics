import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Clock, FileSpreadsheet, AlertCircle, CheckCircle2,
  Mail, Server, Globe, Cable, Workflow,
} from 'lucide-react';
import { Card, KPICard, SectionHeader, Badge, ProgressBar } from '../components/ui';
import { SOURCES, DISTRIBUTEURS, findDistributeur } from '../data';
import type { CanalLivraison } from '../data/governance';
import { formatRelativeDate, classNames } from '../utils/format';

// Type plus permissif que { size?: number } : les icônes Lucide acceptent
// `string | number` en taille (héritage SVG), incompatible avec un typage strict
// `number`. On laisse `unknown` pour ne pas mentir.
const CANAL_ICONS: Record<CanalLivraison, React.ComponentType<{ size?: number; className?: string }>> = {
  email: Mail as never,
  sFTP: Server as never,
  portail: Globe as never,
  EDI: Cable as never,
  API: Workflow as never,
};

function qualityTone(score: number): 'success' | 'warn' | 'danger' {
  if (score >= 90) return 'success';
  if (score >= 75) return 'warn';
  return 'danger';
}

function qualityLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Correct';
  if (score >= 60) return 'À surveiller';
  return 'Critique';
}

type Filtre = 'toutes' | 'retard' | 'critique';

const isEnRetard = (s: { semainesRecues: number; semainesAttendues: number }) =>
  s.semainesRecues < s.semainesAttendues;
const isCritique = (s: { scoreQualite: number }) => s.scoreQualite < 75;

export function Gouvernance() {
  const [tri, setTri] = useState<'qualite' | 'recence' | 'enseigne'>('qualite');
  const [filtre, setFiltre] = useState<Filtre>('toutes');

  const sources = useMemo(() => {
    let enriched = SOURCES.map((s) => ({ ...s, distributeur: findDistributeur(s.distributeurId)! }));
    if (filtre === 'retard') enriched = enriched.filter(isEnRetard);
    else if (filtre === 'critique') enriched = enriched.filter(isCritique);
    return [...enriched].sort((a, b) => {
      if (tri === 'qualite') return a.scoreQualite - b.scoreQualite;
      if (tri === 'recence') return b.derniereDate.localeCompare(a.derniereDate);
      return a.distributeur.nom.localeCompare(b.distributeur.nom);
    });
  }, [tri, filtre]);

  // Statistiques calculées UNIQUEMENT sur les sources actives (ayant des
  // données importées) — sinon les 9 enseignes sans données fausseraient tout.
  const actives = SOURCES.filter((s) => s.semainesRecues > 0);
  const moyQualite = actives.length > 0
    ? actives.reduce((s, x) => s + x.scoreQualite, 0) / actives.length
    : 0;
  const nbCritiques = actives.filter((s) => s.scoreQualite < 75).length;
  const nbRetards = actives.filter((s) => s.semainesRecues < s.semainesAttendues).length;

  // Recommandations DÉRIVÉES des vrais problèmes détectés (plus de conseils inventés)
  const recommandations: Array<{ tone: 'red' | 'orange' | 'muted'; titre: string; detail: string }> = [];
  for (const s of actives) {
    const nom = findDistributeur(s.distributeurId)?.nom ?? s.distributeurId;
    for (const pb of s.problemes) {
      recommandations.push({ tone: 'orange', titre: `${nom} — ${pb}`, detail: 'Détecté sur les données réellement importées' });
    }
  }
  const inactives = SOURCES.filter((s) => s.semainesRecues === 0);
  if (inactives.length > 0) {
    recommandations.push({
      tone: 'muted',
      titre: `${inactives.length} enseigne${inactives.length > 1 ? 's' : ''} sans données importées`,
      detail: 'Déposer leurs fichiers hebdomadaires pour compléter le pilotage',
    });
  }

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
          Gouvernance des données
        </h1>
        <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
          {actives.length} source{actives.length > 1 ? 's' : ''} active{actives.length > 1 ? 's' : ''} sur {DISTRIBUTEURS.length} · statut réel d'import
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Sources actives"
          value={`${actives.length} / ${DISTRIBUTEURS.length}`}
          deltaLabel="enseignes avec données"
          intent={actives.length > 0 ? 'success' : 'warn'}
          icon={<CheckCircle2 size={14} />}
        />
        <KPICard
          label="Qualité moyenne"
          value={`${moyQualite.toFixed(0)} / 100`}
          deltaLabel="Score consolidé"
          intent={moyQualite >= 85 ? 'success' : 'warn'}
          icon={<ShieldCheck size={14} />}
        />
        <KPICard
          label="Sources en retard"
          value={String(nbRetards)}
          deltaLabel="Semaines manquantes"
          intent={nbRetards > 0 ? 'warn' : 'success'}
          icon={<Clock size={14} />}
        />
        <KPICard
          label="Sources critiques"
          value={String(nbCritiques)}
          deltaLabel="Score < 75"
          intent={nbCritiques > 0 ? 'danger' : 'success'}
          icon={<AlertCircle size={14} />}
        />
      </div>

      <Card padded={false} className="mb-6 overflow-hidden">
        <div className="px-4 py-3 border-b border-hair hairline flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink">
              Cartographie des sources
            </h2>
            <p className="text-2xs text-ink-muted mt-0.5">
              Format, périodicité, canal de livraison et qualité par enseigne
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-2xs text-ink-muted mr-1">Afficher</span>
              {([
                ['toutes', `Toutes · ${SOURCES.length}`],
                ['retard', `En retard · ${nbRetards}`],
                ['critique', `Critiques · ${nbCritiques}`],
              ] as Array<[Filtre, string]>).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setFiltre(f)}
                  className={classNames(
                    'text-xs px-2.5 h-7 rounded-md',
                    filtre === f
                      ? f === 'critique'
                        ? 'bg-brand-red text-white'
                        : f === 'retard'
                        ? 'bg-brand-orange text-white'
                        : 'bg-ink dark:bg-night-ink text-white dark:text-black'
                      : 'text-ink-muted hover:bg-surface-alt dark:hover:bg-night-alt',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="h-5 w-px bg-surface-line dark:bg-night-line" />
            <div className="flex items-center gap-1">
              <span className="text-2xs text-ink-muted mr-1">Trier par</span>
              {(['qualite', 'recence', 'enseigne'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTri(t)}
                  className={classNames(
                    'text-xs px-2.5 h-7 rounded-md',
                    tri === t
                      ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                      : 'text-ink-muted hover:bg-surface-alt dark:hover:bg-night-alt',
                  )}
                >
                  {t === 'qualite' ? 'Qualité' : t === 'recence' ? 'Récence' : 'Enseigne'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sources.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-ink dark:text-night-ink">
              {filtre === 'retard' ? 'Aucune source en retard' : 'Aucune source critique'}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Toutes les sources sont à jour pour ce critère.
            </p>
          </div>
        )}

        <div className="divide-y divide-surface-line dark:divide-night-line">
          {sources.map((s) => {
            const CanalIcon = CANAL_ICONS[s.canal];
            const completude = s.semainesAttendues > 0 ? (s.semainesRecues / s.semainesAttendues) * 100 : 0;
            return (
              <div key={s.distributeurId} className="px-4 py-4 hover:bg-surface-alt/40 dark:hover:bg-night-alt/40">
                <div className="grid grid-cols-12 gap-4 items-start">
                  {/* Distributeur */}
                  <div className="col-span-12 md:col-span-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.distributeur.logoColor}14` }}>
                      <FileSpreadsheet size={15} style={{ color: s.distributeur.logoColor }} />
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/distributeurs/${s.distributeurId}`}
                        className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink hover:underline block truncate"
                      >
                        {s.distributeur.nom}
                      </Link>
                      <p className="text-2xs text-ink-muted mt-0.5">
                        Référent · {s.contactSilverlit}
                      </p>
                    </div>
                  </div>

                  {/* Format */}
                  <div className="col-span-6 md:col-span-3">
                    <p className="text-2xs uppercase tracking-wider text-ink-muted mb-1">Format</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone="info">{s.format}</Badge>
                      {s.separateur && <Badge>sep "{s.separateur}"</Badge>}
                      {s.encoding && <Badge>{s.encoding}</Badge>}
                    </div>
                    <p className="text-2xs text-ink-muted mt-1 truncate tabular">
                      {s.nomFichierPattern}
                    </p>
                  </div>

                  {/* Canal & périodicité */}
                  <div className="col-span-6 md:col-span-2">
                    <p className="text-2xs uppercase tracking-wider text-ink-muted mb-1">Livraison</p>
                    <div className="flex items-center gap-1.5">
                      <CanalIcon size={12} className="text-ink-muted" />
                      <span className="text-xs text-ink dark:text-night-ink">{s.canal}</span>
                    </div>
                    <p className="text-2xs text-ink-muted mt-1">
                      {s.periodicite}
                      {s.granulariteMagasin ? ' · par magasin' : ' · agrégé'}
                      {s.inclutStock ? '' : ' · sans stock'}
                    </p>
                  </div>

                  {/* Dernière maj + complétude */}
                  <div className="col-span-6 md:col-span-2">
                    <p className="text-2xs uppercase tracking-wider text-ink-muted mb-1">Dernier envoi</p>
                    <p className="text-xs text-ink dark:text-night-ink">
                      {s.derniereSemaine > 0
                        ? `S${String(s.derniereSemaine).padStart(2, '0')}${s.derniereDate ? ` · ${formatRelativeDate(s.derniereDate)}` : ''}`
                        : 'Aucun import'}
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-2xs mb-1">
                        <span className="text-ink-muted">Complétude</span>
                        <span className="tabular text-ink dark:text-night-ink">
                          {s.semainesRecues} / {s.semainesAttendues}
                        </span>
                      </div>
                      <ProgressBar
                        value={completude}
                        intent={completude >= 95 ? 'default' : completude >= 80 ? 'warn' : 'danger'}
                      />
                    </div>
                  </div>

                  {/* Qualité */}
                  <div className="col-span-6 md:col-span-2 text-right md:text-left">
                    <p className="text-2xs uppercase tracking-wider text-ink-muted mb-1">Qualité</p>
                    <div className="flex items-baseline gap-2 md:justify-start justify-end">
                      <span className="text-[22px] tabular font-medium tracking-tighter2 text-ink dark:text-night-ink">
                        {s.scoreQualite}
                      </span>
                      <Badge tone={qualityTone(s.scoreQualite)}>{qualityLabel(s.scoreQualite)}</Badge>
                    </div>
                  </div>
                </div>

                {s.problemes.length > 0 && (
                  <div className="mt-3 pl-12 flex flex-wrap items-start gap-1.5">
                    <AlertCircle size={11} className="text-brand-orange shrink-0 mt-0.5" />
                    <ul className="flex flex-wrap gap-x-3 gap-y-1">
                      {s.problemes.map((p, i) => (
                        <li key={i} className="text-2xs text-ink-muted dark:text-night-muted">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionHeader
            title="Règles de gouvernance"
            subtitle="Principes appliqués sur la plateforme"
          />
          <ul className="space-y-3 text-sm">
            {[
              { t: 'Source unique de vérité', d: 'L\'EAN est la clé pivot : aucune donnée n\'est rapprochée par libellé seul.' },
              { t: 'Mapping versionné', d: 'Chaque correspondance colonne→champ est tracée par enseigne et par date.' },
              { t: 'Quarantaine des anomalies', d: 'Lignes sans EAN valide ou avec des EAN inconnus sont isolées, jamais perdues.' },
              { t: 'Traçabilité fichier', d: 'Chaque montant affiché est rattachable au fichier source et à sa date de réception.' },
              { t: 'Réconciliation hebdo', d: 'Comparaison automatique entre flux distributeur et données EDI Silverlit.' },
            ].map((r) => (
              <li key={r.t} className="flex gap-3">
                <CheckCircle2 size={14} className="text-brand-green shrink-0 mt-1" />
                <div>
                  <p className="text-[13px] text-ink dark:text-night-ink">{r.t}</p>
                  <p className="text-2xs text-ink-muted mt-0.5">{r.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHeader
            title="Actions recommandées"
            subtitle="Issues des problèmes réellement détectés à l'import"
          />
          {recommandations.length === 0 ? (
            <p className="text-xs text-ink-muted py-6 text-center">
              Aucune anomalie détectée sur les données importées.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {recommandations.map((r, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className={classNames(
                    'w-1.5 h-1.5 rounded-full mt-2 shrink-0',
                    r.tone === 'red' ? 'bg-brand-red' : r.tone === 'orange' ? 'bg-brand-orange' : 'bg-ink-muted',
                  )} />
                  <div>
                    <p className="text-[13px] text-ink dark:text-night-ink">{r.titre}</p>
                    <p className="text-2xs text-ink-muted mt-0.5">{r.detail}</p>
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
