import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UploadCloud, AlertTriangle, Trash2,
  Pencil, X, Check, Database, ArrowRight, Info,
} from 'lucide-react';
import { Card, SectionHeader, Badge } from '../components/ui';
import { classNames } from '../utils/format';
import { formatMoney, formatNumber } from '../utils/currency';
import { useApp } from '../context/AppContext';
import { DISTRIBUTEURS } from '../data';
import {
  getBatches, addBatch, updateBatch, deleteBatch, computeBatchStats,
  type ImportBatch,
} from '../data/importBatches';
import {
  FORMATS, detectFormat, parseAndValorize, type ParseResult,
} from '../utils/importEngine';
import type { Vente } from '../types';

type Step = 'idle' | 'parsing' | 'review';

interface FormState {
  sourceName: string;
  distributeurId: string;
  formatId: string;
  annee: number;
  semaine: number;
}

const newId = () => `b-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function Import() {
  const { devise } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImportBatch | null>(null);

  const batches = getBatches();

  async function handleFile(f: File) {
    setError(null);
    setFile(f);
    setStep('parsing');
    const fmt = detectFormat(f.name);
    const formatId = fmt?.id ?? FORMATS[0].id;
    try {
      const result = await parseAndValorize(f, formatId);
      setParsed(result);
      setForm({
        sourceName: f.name.replace(/\.(csv|xlsx|xlsm|xls|tsv)$/i, ''),
        distributeurId: fmt?.defaultDistributeurId ?? DISTRIBUTEURS[0].id,
        formatId,
        annee: result.detectedAnnee ?? 2026,
        semaine: result.detectedSemaine ?? 1,
      });
      setStep('review');
    } catch (e) {
      setError(`Lecture impossible : ${(e as Error).message}`);
      setStep('idle');
    }
  }

  // Re-parse si l'utilisateur change le format manuellement
  async function reparse(formatId: string) {
    if (!file) return;
    setForm((f) => (f ? { ...f, formatId } : f));
    try {
      const result = await parseAndValorize(file, formatId);
      setParsed(result);
    } catch (e) {
      setError(`Lecture impossible avec ce format : ${(e as Error).message}`);
    }
  }

  function confirmImport() {
    if (!parsed || !form) return;
    const dist = DISTRIBUTEURS.find((d) => d.id === form.distributeurId);
    const rows: Vente[] = parsed.rows.map((r) => ({
      ean: r.ean,
      distributeurId: form.distributeurId,
      magasinCode: `${dist?.codeRetail ?? 'NA'}-CONSO`,
      magasinLibelle: `${dist?.nom ?? form.distributeurId} — flux consolidé`,
      annee: form.annee,
      semaine: form.semaine,
      qteVendue: r.qteVendue,
      qteStock: r.qteStock,
      caTTC: r.caTTC,
    }));
    const stats = computeBatchStats(rows);
    const batch: ImportBatch = {
      id: newId(),
      sourceName: form.sourceName.trim() || file?.name || 'Source sans nom',
      distributeurId: form.distributeurId,
      annee: form.annee,
      semaine: form.semaine,
      formatId: form.formatId,
      fileName: file?.name ?? '',
      importedAt: new Date().toISOString(),
      rows,
      ...stats,
    };
    addBatch(batch);
    // Recharger pour que le dashboard (VENTES) reflète le nouveau lot
    window.location.assign('/pilotage');
  }

  function cancelReview() {
    setStep('idle');
    setFile(null);
    setParsed(null);
    setForm(null);
    setError(null);
  }

  function onDelete(b: ImportBatch) {
    if (!window.confirm(`Supprimer définitivement le lot « ${b.sourceName} » ?\n${formatNumber(b.totalQte)} u. · ${formatMoney(b.totalCa, devise, { compact: true })}`)) return;
    deleteBatch(b.id);
    window.location.reload();
  }

  function saveEdit() {
    if (!editing) return;
    updateBatch(editing.id, {
      sourceName: editing.sourceName,
      distributeurId: editing.distributeurId,
      annee: editing.annee,
      semaine: editing.semaine,
    });
    window.location.reload();
  }

  const totalCaAll = batches.reduce((s, b) => s + b.totalCa, 0);
  const totalQteAll = batches.reduce((s, b) => s + b.totalQte, 0);

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
          Import de données
        </h1>
        <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
          Déposez le fichier brut d'un distributeur. Le format est reconnu, les ventes
          consolidées par référence et le CA valorisé par la grille de prix.
        </p>
      </div>

      {/* --- ZONE DE DÉPÔT --- */}
      {step !== 'review' && (
        <Card padded={false} className="overflow-hidden mb-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={classNames(
              'p-12 text-center transition-colors border-2 border-dashed m-4 rounded-2xl',
              dragOver ? 'border-silverlit-red bg-silverlit-red-soft' : 'border-surface-line dark:border-night-line',
            )}
          >
            {step === 'parsing' ? (
              <>
                <div className="w-7 h-7 mx-auto rounded-full border-2 border-surface-line border-t-silverlit-red animate-spin mb-3" />
                <p className="text-sm text-ink dark:text-night-ink">Lecture et valorisation…</p>
              </>
            ) : (
              <>
                <UploadCloud size={34} className="mx-auto text-ink-muted mb-3" strokeWidth={1.4} />
                <p className="text-[15px] text-ink dark:text-night-ink font-medium tracking-tightish">
                  Glissez-déposez le fichier brut du distributeur
                </p>
                <p className="text-xs text-ink-muted mt-1.5">CSV, TSV, XLSX — formats King Jouet (JOL) & JouéClub reconnus</p>
                <button
                  onClick={() => fileInput.current?.click()}
                  className="mt-5 inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium hover:bg-silverlit-red-deep transition-colors"
                >
                  Parcourir
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  hidden
                  accept=".csv,.tsv,.xlsx,.xlsm,.xls"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </>
            )}
          </div>
          {error && (
            <div className="mx-4 mb-4 p-3 rounded-lg bg-red-50 dark:bg-night-alt border border-red-200 dark:border-night-line flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </Card>
      )}

      {/* --- REVUE & PARAMÈTRES AVANT IMPORT --- */}
      {step === 'review' && parsed && form && (
        <Card className="mb-6">
          <SectionHeader
            title="Vérifier et paramétrer la source"
            subtitle={file?.name}
            action={<Badge tone="info">{formatNumber(parsed.refsCount)} réfs</Badge>}
          />

          {/* Stats de contrôle */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <Stat label="Quantités nettes" value={formatNumber(parsed.totalQte)} />
            <Stat label="CA valorisé (grille)" value={formatMoney(parsed.totalCa, devise, { compact: false })} />
            <Stat label="Références vendues" value={formatNumber(parsed.refsCount)} />
          </div>

          {/* Alerte hors-grille */}
          {parsed.unpricedRefs > 0 && (
            <div className="mb-5 p-3 rounded-lg bg-brand-orange/5 border border-brand-orange/30 flex items-start gap-2">
              <AlertTriangle size={15} className="text-brand-orange shrink-0 mt-0.5" />
              <p className="text-xs text-ink dark:text-night-ink">
                <strong>{parsed.unpricedRefs} référence(s)</strong> vendue(s) absente(s) de la grille de prix
                ({formatNumber(parsed.unpricedQte)} u. non valorisées). Le CA est sous-estimé tant que ces
                EAN ne sont pas ajoutés à la grille.
              </p>
            </div>
          )}

          {/* Paramètres */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Field label="Nom de la source">
              <input
                value={form.sourceName}
                onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
                className="input"
                placeholder="ex : King Jouet — Semaine 1"
              />
            </Field>
            <Field label="Distributeur">
              <select
                value={form.distributeurId}
                onChange={(e) => setForm({ ...form, distributeurId: e.target.value })}
                className="input"
              >
                {DISTRIBUTEURS.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </Field>
            <Field label="Format de fichier">
              <select
                value={form.formatId}
                onChange={(e) => reparse(e.target.value)}
                className="input"
              >
                {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Année">
                <input type="number" value={form.annee}
                  onChange={(e) => setForm({ ...form, annee: parseInt(e.target.value, 10) || 2026 })}
                  className="input" />
              </Field>
              <Field label="Semaine">
                <input type="number" min={1} max={53} value={form.semaine}
                  onChange={(e) => setForm({ ...form, semaine: parseInt(e.target.value, 10) || 1 })}
                  className="input" />
              </Field>
            </div>
          </div>

          {/* Aperçu top 8 */}
          <div className="rounded-lg border border-hair hairline overflow-hidden mb-5">
            <table className="w-full text-2xs">
              <thead className="bg-surface-alt/50 dark:bg-night-alt/40">
                <tr>
                  <th className="text-left px-3 py-2 font-normal text-ink-muted uppercase tracking-wider">Désignation</th>
                  <th className="text-right px-3 py-2 font-normal text-ink-muted uppercase tracking-wider">Qté nette</th>
                  <th className="text-right px-3 py-2 font-normal text-ink-muted uppercase tracking-wider">CA grille</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 8).map((r) => (
                  <tr key={r.ean} className="border-t border-hair hairline">
                    <td className="px-3 py-1.5 text-ink dark:text-night-ink truncate max-w-[420px]">
                      {r.libelle}{!r.inCatalog && <span className="text-brand-orange ml-1">• hors grille</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular text-ink dark:text-night-ink">{formatNumber(r.qteVendue)}</td>
                    <td className="px-3 py-1.5 text-right tabular text-ink dark:text-night-ink">{formatMoney(r.caTTC, devise, { compact: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={cancelReview} className="h-9 px-3 rounded-lg border border-hair hairline text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink">
              Annuler
            </button>
            <button onClick={confirmImport} className="inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium hover:bg-silverlit-red-deep">
              <Check size={14} /> Importer dans le dashboard
            </button>
          </div>
        </Card>
      )}

      {/* --- LOTS IMPORTÉS (gestion : modifier / supprimer) --- */}
      <Card padded={false}>
        <div className="px-5 py-4 border-b border-hair hairline flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-ink-muted" />
            <h2 className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink">
              Documents importés
            </h2>
            <Badge>{batches.length}</Badge>
          </div>
          <p className="text-2xs text-ink-muted tabular">
            Total dashboard : {formatNumber(totalQteAll)} u. · {formatMoney(totalCaAll, devise, { compact: true })}
          </p>
        </div>

        {batches.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Info size={20} className="text-ink-muted mx-auto mb-2" />
            <p className="text-sm text-ink-muted">Aucun document importé. Déposez un fichier ci-dessus.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair hairline">
                <th className="text-left px-5 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Source</th>
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Distributeur</th>
                <th className="text-center px-3 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Semaine</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Qté</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">CA grille</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Réfs</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const dist = DISTRIBUTEURS.find((d) => d.id === b.distributeurId);
                return (
                  <tr key={b.id} className="border-b border-hair hairline last:border-b-0 hover:bg-surface-alt/30 dark:hover:bg-night-alt/30">
                    <td className="px-5 py-3">
                      <p className="text-[13px] text-ink dark:text-night-ink">{b.sourceName}</p>
                      <p className="text-2xs text-ink-muted truncate max-w-[280px]">{b.fileName}</p>
                    </td>
                    <td className="px-3 py-3 text-[13px]" style={{ color: dist?.logoColor }}>{dist?.nom ?? b.distributeurId}</td>
                    <td className="px-3 py-3 text-center text-[13px] tabular text-ink-muted">{b.annee}·S{b.semaine}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular text-ink dark:text-night-ink">{formatNumber(b.totalQte)}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular text-ink dark:text-night-ink">{formatMoney(b.totalCa, devise, { compact: true })}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular text-ink-muted">{b.refsCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(b)} title="Modifier" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-alt dark:hover:bg-night-alt">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => onDelete(b)} title="Supprimer" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-night-alt">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* --- MODALE MODIFIER --- */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white dark:bg-night-surface rounded-2xl border border-hair hairline w-full max-w-[420px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink">Modifier la source</h3>
              <button onClick={() => setEditing(null)} className="text-ink-muted hover:text-ink"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <Field label="Nom de la source">
                <input value={editing.sourceName} onChange={(e) => setEditing({ ...editing, sourceName: e.target.value })} className="input" />
              </Field>
              <Field label="Distributeur">
                <select value={editing.distributeurId} onChange={(e) => setEditing({ ...editing, distributeurId: e.target.value })} className="input">
                  {DISTRIBUTEURS.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Année">
                  <input type="number" value={editing.annee} onChange={(e) => setEditing({ ...editing, annee: parseInt(e.target.value, 10) || 2026 })} className="input" />
                </Field>
                <Field label="Semaine">
                  <input type="number" min={1} max={53} value={editing.semaine} onChange={(e) => setEditing({ ...editing, semaine: parseInt(e.target.value, 10) || 1 })} className="input" />
                </Field>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="h-9 px-3 rounded-lg border border-hair hairline text-xs text-ink-muted">Annuler</button>
              <button onClick={saveEdit} className="inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium">
                <Check size={14} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end">
        <Link to="/pilotage" className="text-xs text-silverlit-red hover:underline inline-flex items-center gap-1">
          Voir le dashboard <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hair hairline px-3 py-2.5">
      <p className="text-2xs uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="text-[17px] font-medium tracking-tightish text-ink dark:text-night-ink tabular mt-0.5">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
