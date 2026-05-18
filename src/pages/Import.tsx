import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, Sparkles, ArrowRight, ChevronDown,
  BookOpen, ShieldCheck, AlertTriangle, FileCheck, Clock,
} from 'lucide-react';
import { Card, SectionHeader, Badge, ProgressBar } from '../components/ui';
import { classNames } from '../utils/format';
import { IMPORT_FORMATS, TARGET_FIELDS, type ImportFormat } from '../data';

type Step = 'drop' | 'analyzing' | 'mapping' | 'preview' | 'done';

export function Import() {
  const [step, setStep] = useState<Step>('drop');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showTuto, setShowTuto] = useState(true);
  const [fmt, setFmt] = useState<ImportFormat | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  // Analyse simulée — progression jusqu'à 100% puis passage au mapping
  useEffect(() => {
    if (step !== 'analyzing') return;
    setProgress(0);
    let p = 0;
    const id = setInterval(() => {
      p += 7 + Math.random() * 11;
      if (p >= 100) {
        p = 100;
        setProgress(100);
        clearInterval(id);
        setTimeout(() => setStep('mapping'), 320);
      } else {
        setProgress(p);
      }
    }, 110);
    return () => clearInterval(id);
  }, [step]);

  function pickFormat(f: ImportFormat) {
    setFmt(f);
    setMapping({ ...f.autoMap });
    setStep('analyzing');
  }

  function reset() {
    setStep('drop');
    setProgress(0);
    setFmt(null);
    setMapping({});
  }

  const compositeKeys = fmt ? Object.keys(fmt.composite ?? {}) : [];
  const mappedCount = fmt
    ? Object.values(mapping).filter(Boolean).length + compositeKeys.length
    : 0;

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
          Import de données
        </h1>
        <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
          Déposez le fichier hebdomadaire d'une enseigne — le format est reconnu et le mapping proposé automatiquement
        </p>
      </div>

      {/* Tutoriel intégré */}
      {showTuto && (
        <div className="mb-6 bg-white dark:bg-night-surface border border-hair hairline rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-hair hairline flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-silverlit-red" />
              <h2 className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink">
                Comment fonctionne l'import ?
              </h2>
              <Badge tone="info">Lecture · 1 min</Badge>
            </div>
            <button
              onClick={() => setShowTuto(false)}
              className="text-2xs text-ink-muted hover:text-ink dark:hover:text-night-ink"
            >
              Masquer le guide
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 divide-x divide-surface-line dark:divide-night-line">
            {[
              {
                n: 1,
                icon: <UploadCloud size={16} />,
                title: 'Déposez le fichier',
                desc: "Glissez le fichier hebdo reçu de l'enseigne (CSV, XLSX, XLSM ou XLS). Un seul fichier à la fois, 50 Mo max.",
              },
              {
                n: 2,
                icon: <Sparkles size={16} />,
                title: 'Détection automatique',
                desc: 'La plateforme reconnaît le format (JouéClub, Carrefour, Amazon Vendor…) via le nom et les entêtes.',
              },
              {
                n: 3,
                icon: <FileCheck size={16} />,
                title: 'Validez le mapping',
                desc: 'Vérifiez les colonnes proposées. Un score de confiance indique la fiabilité de chaque correspondance.',
              },
              {
                n: 4,
                icon: <CheckCircle2 size={16} />,
                title: 'Prévisualisez & importez',
                desc: 'Aperçu des 10 premières lignes. Les lignes sans EAN valide passent en quarantaine sans bloquer.',
              },
            ].map((s) => (
              <div key={s.n} className="p-4">
                <div className="flex items-center gap-2 text-ink dark:text-night-ink mb-2">
                  <span className="w-6 h-6 rounded-full bg-surface-alt dark:bg-night-alt text-2xs tabular flex items-center justify-center">
                    {s.n}
                  </span>
                  {s.icon}
                  <span className="text-[13px] font-medium tracking-tightish">{s.title}</span>
                </div>
                <p className="text-2xs text-ink-muted dark:text-night-muted leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-hair hairline grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-2xs uppercase tracking-wider text-ink-muted mb-2 inline-flex items-center gap-1.5">
                <ShieldCheck size={11} /> Exigences obligatoires
              </h3>
              <ul className="space-y-1.5 text-2xs text-ink dark:text-night-ink">
                <li className="flex items-start gap-2">
                  <span className="text-brand-green mt-0.5">●</span>
                  Un identifiant EAN-13 valide par ligne (clé pivot du modèle).
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-green mt-0.5">●</span>
                  Période identifiable : année + n° de semaine ISO, ou date.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-green mt-0.5">●</span>
                  Au moins une quantité vendue ou un CA par ligne.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-green mt-0.5">●</span>
                  Encodage UTF-8, Latin-1, Windows-1252 ou UTF-16 (détection auto).
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xs uppercase tracking-wider text-ink-muted mb-2 inline-flex items-center gap-1.5">
                <AlertTriangle size={11} /> À éviter
              </h3>
              <ul className="space-y-1.5 text-2xs text-ink dark:text-night-ink">
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange mt-0.5">●</span>
                  Plusieurs onglets dans un même fichier Excel (un fichier par semaine).
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange mt-0.5">●</span>
                  Cellules fusionnées dans les entêtes ou les colonnes-clés.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange mt-0.5">●</span>
                  Renommer le fichier hors convention de l'enseigne (la détection auto échoue).
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange mt-0.5">●</span>
                  Mélanger plusieurs semaines sans colonne « semaine » explicite.
                </li>
              </ul>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-hair hairline bg-surface-alt/40 dark:bg-night-alt/40 flex items-center justify-between flex-wrap gap-2">
            <p className="text-2xs text-ink-muted flex items-center gap-1.5">
              <Clock size={11} />
              Un fichier hebdo classique est traité en moins de 10 secondes.
            </p>
            <Link
              to="/gouvernance"
              className="text-2xs text-silverlit-red hover:underline inline-flex items-center gap-1"
            >
              Voir les conventions détaillées par enseigne <ArrowRight size={10} />
            </Link>
          </div>
        </div>
      )}

      {!showTuto && (
        <button
          onClick={() => setShowTuto(true)}
          className="mb-4 text-xs text-silverlit-red hover:underline inline-flex items-center gap-1"
        >
          <BookOpen size={11} /> Réafficher le guide
        </button>
      )}

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 text-2xs flex-wrap">
        {[
          { key: 'drop', label: 'Dépôt' },
          { key: 'analyzing', label: 'Analyse' },
          { key: 'mapping', label: 'Mapping' },
          { key: 'preview', label: 'Prévisualisation' },
          { key: 'done', label: 'Import' },
        ].map((s, i, arr) => {
          const cur = arr.findIndex((x) => x.key === step);
          const reached = i <= cur;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={classNames(
                  'w-5 h-5 rounded-full flex items-center justify-center text-2xs tabular',
                  reached
                    ? 'bg-silverlit-red text-white'
                    : 'bg-surface-alt dark:bg-night-alt text-ink-muted',
                )}
              >
                {i + 1}
              </span>
              <span className={classNames(reached ? 'text-ink dark:text-night-ink' : 'text-ink-muted')}>
                {s.label}
              </span>
              {i < arr.length - 1 && <ArrowRight size={11} className="text-ink-muted mx-1" />}
            </div>
          );
        })}
      </div>

      {/* --- ÉTAPE 1 : DÉPÔT --- */}
      {step === 'drop' && (
        <div className="space-y-4">
          <Card padded={false} className="overflow-hidden">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFormat(IMPORT_FORMATS[0]);
              }}
              className={classNames(
                'p-14 text-center transition-colors border-2 border-dashed m-4 rounded-2xl',
                dragOver
                  ? 'border-silverlit-red bg-silverlit-red-soft'
                  : 'border-surface-line dark:border-night-line',
              )}
            >
              <UploadCloud size={36} className="mx-auto text-ink-muted mb-3" strokeWidth={1.4} />
              <p className="text-[15px] text-ink dark:text-night-ink font-medium tracking-tightish">
                Glissez-déposez votre fichier
              </p>
              <p className="text-xs text-ink-muted mt-1.5">
                CSV, TSV, XLSX, XLSM, XLS — jusqu'à 50 Mo
              </p>
              <button
                onClick={() => fileInput.current?.click()}
                className="mt-5 inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium hover:bg-silverlit-red-deep transition-colors"
              >
                Parcourir les fichiers
              </button>
              <input
                ref={fileInput}
                type="file"
                hidden
                onChange={() => pickFormat(IMPORT_FORMATS[0])}
              />
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-5 py-3 border-b border-hair hairline">
              <h2 className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink">
                Ou sélectionnez le format de l'enseigne
              </h2>
              <p className="text-2xs text-ink-muted mt-0.5">
                {IMPORT_FORMATS.length} formats reconnus — chacun avec ses propres conventions de colonnes
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-surface-line dark:bg-night-line">
              {IMPORT_FORMATS.map((f) => (
                <button
                  key={f.distributeurId}
                  onClick={() => pickFormat(f)}
                  className="text-left bg-white dark:bg-night-surface p-4 hover:bg-surface-alt dark:hover:bg-night-alt transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink">
                      {f.enseigne}
                    </span>
                    <Badge tone="neutral">{f.format}</Badge>
                  </div>
                  <p className="text-2xs text-ink-muted truncate tabular">{f.filename}</p>
                  <p className="text-2xs text-ink-muted mt-1">
                    {f.headers.length} colonnes · {f.encoding}
                    {f.separator ? ` · sép. ${f.separator}` : ''}
                  </p>
                  <span className="text-2xs text-silverlit-red opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 mt-1.5">
                    Importer ce format <ArrowRight size={9} />
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* --- ÉTAPE 2 : ANALYSE --- */}
      {step === 'analyzing' && fmt && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <FileSpreadsheet size={20} className="text-ink-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink truncate">
                {fmt.filename}
              </p>
              <p className="text-2xs text-ink-muted mt-0.5">
                {fmt.sizeLabel} · {fmt.rows.toLocaleString('fr-FR')} lignes · {fmt.format}
                {fmt.separator ? ` · séparateur ${fmt.separator}` : ''} · {fmt.encoding}
              </p>
            </div>
            <Badge tone="info">Format {fmt.enseigne} détecté</Badge>
          </div>
          <p className="text-xs text-ink-muted dark:text-night-muted mb-2">
            <Sparkles size={12} className="inline mr-1" />
            Lecture des entêtes, mapping intelligent des colonnes, validation des EAN-13…
          </p>
          <ProgressBar value={progress} />
          <p className="text-2xs text-ink-muted mt-2 tabular">{Math.round(progress)}%</p>
        </Card>
      )}

      {/* --- ÉTAPE 3 : MAPPING --- */}
      {step === 'mapping' && fmt && (
        <Card>
          <SectionHeader
            title="Mapping détecté"
            subtitle={`${fmt.headers.length} colonnes source · ${mappedCount} correspondance(s) suggérée(s)`}
            action={
              <Badge tone="success">
                <Sparkles size={10} className="inline mr-0.5" /> Auto-mapping
              </Badge>
            }
          />
          <div className="text-2xs text-ink-muted mb-4">
            Confirmez ou ajustez le mapping. Les colonnes non utilisées seront ignorées à l'import.
          </div>
          <div className="space-y-2">
            {fmt.headers.map((src) => {
              const target = mapping[src] ?? '';
              const composite = fmt.composite?.[src];
              const conf = fmt.confidence[src];
              return (
                <div
                  key={src}
                  className="grid grid-cols-12 gap-3 items-center py-2 border-b border-hair hairline last:border-b-0"
                >
                  <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                    <span className="text-2xs tabular px-1.5 py-0.5 rounded bg-surface-alt dark:bg-night-alt text-ink-subtle dark:text-night-muted truncate">
                      {src}
                    </span>
                    {conf !== undefined && conf > 0 && (
                      <span
                        className={classNames(
                          'text-2xs tabular shrink-0',
                          conf >= 95 ? 'text-brand-green' : conf >= 80 ? 'text-silverlit-red' : 'text-brand-orange',
                        )}
                      >
                        {conf}%
                      </span>
                    )}
                  </div>
                  <div className="hidden sm:flex col-span-1 justify-center">
                    <ArrowRight size={12} className="text-ink-muted" />
                  </div>
                  <div className="col-span-12 sm:col-span-7">
                    {composite ? (
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="text-ink dark:text-night-ink">
                          {composite.fields.join(' + ')}
                        </span>
                        <span className="text-2xs text-ink-muted italic">{composite.label}</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={target}
                          onChange={(e) => setMapping((m) => ({ ...m, [src]: e.target.value }))}
                          className="w-full appearance-none bg-white dark:bg-night-surface border border-hair hairline rounded-lg px-2.5 h-8 text-xs text-ink dark:text-night-ink pr-7 focus:outline-none focus:border-silverlit-red"
                        >
                          <option value="">— Ignorer cette colonne —</option>
                          {TARGET_FIELDS.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button onClick={reset} className="text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink">
              ← Choisir un autre fichier
            </button>
            <button
              onClick={() => setStep('preview')}
              className="inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium hover:bg-silverlit-red-deep transition-colors"
            >
              Prévisualiser <ArrowRight size={14} />
            </button>
          </div>
        </Card>
      )}

      {/* --- ÉTAPE 4 : PRÉVISUALISATION --- */}
      {step === 'preview' && fmt && (
        <Card padded={false}>
          <div className="px-5 py-4 border-b border-hair hairline flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink">
                Prévisualisation — {fmt.enseigne}
              </h2>
              <p className="text-2xs text-ink-muted mt-0.5">
                Les {fmt.preview.length} premières lignes, mapping appliqué. Vérifiez avant d'importer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="success">
                {(fmt.rows - 3).toLocaleString('fr-FR')} lignes valides
              </Badge>
              <Badge tone="warn">3 en quarantaine</Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="text-2xs w-full">
              <thead>
                <tr className="border-b border-hair hairline bg-surface-alt/40 dark:bg-night-alt/40">
                  {fmt.headers.map((h) => {
                    const composite = fmt.composite?.[h];
                    const t = composite ? composite.fields.join(' + ') : mapping[h] || '';
                    return (
                      <th key={h} className="text-left px-3 py-2 align-bottom min-w-[110px]">
                        <p className="text-2xs uppercase tracking-wider text-ink-muted font-normal">{h}</p>
                        {t ? (
                          <p className="text-2xs text-silverlit-red mt-0.5">→ {t}</p>
                        ) : (
                          <p className="text-2xs text-ink-muted mt-0.5 italic">ignorée</p>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {fmt.preview.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-hair hairline last:border-b-0 hover:bg-surface-alt/30 dark:hover:bg-night-alt/30"
                  >
                    {row.map((c, j) => (
                      <td key={j} className="px-3 py-2 text-ink dark:text-night-ink tabular whitespace-nowrap">
                        {c || <span className="text-ink-muted">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-hair hairline flex items-center justify-between">
            <button
              onClick={() => setStep('mapping')}
              className="text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink"
            >
              ← Modifier le mapping
            </button>
            <button
              onClick={() => setStep('done')}
              className="inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium hover:bg-silverlit-red-deep transition-colors"
            >
              Importer {fmt.rows.toLocaleString('fr-FR')} lignes
            </button>
          </div>
        </Card>
      )}

      {/* --- ÉTAPE 5 : TERMINÉ --- */}
      {step === 'done' && fmt && (
        <Card>
          <div className="text-center py-8">
            <CheckCircle2 size={36} className="text-brand-green mx-auto mb-3" strokeWidth={1.6} />
            <p className="text-[17px] font-medium tracking-tightish text-ink dark:text-night-ink">
              Import terminé
            </p>
            <p className="text-sm text-ink-muted mt-1">
              {(fmt.rows - 3).toLocaleString('fr-FR')} lignes intégrées · {fmt.enseigne} · 3 lignes en quarantaine
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 border border-hair hairline px-4 h-9 rounded-lg text-sm text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt"
              >
                Importer un autre fichier
              </button>
              <Link
                to="/gouvernance"
                className="inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium hover:bg-silverlit-red-deep transition-colors"
              >
                Voir la gouvernance
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
