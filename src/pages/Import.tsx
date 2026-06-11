import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UploadCloud, AlertTriangle, Trash2, Pencil, X, Check, Database, ArrowRight, Info,
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

interface Pending {
  id: string;
  fileName: string;
  parse: ParseResult;
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

  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImportBatch | null>(null);

  const batches = getBatches();

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    setParsing(true);
    const arr = Array.from(files);
    const results: Pending[] = [];
    for (const f of arr) {
      const fmt = detectFormat(f.name);
      const formatId = fmt?.id ?? FORMATS[0].id;
      try {
        const parse = await parseAndValorize(f, formatId);
        results.push({
          id: newId(),
          fileName: f.name,
          parse,
          sourceName: f.name.replace(/\.(csv|xlsx|xlsm|xls|tsv)$/i, ''),
          distributeurId: fmt?.defaultDistributeurId ?? DISTRIBUTEURS[0].id,
          formatId,
          annee: parse.detectedAnnee ?? 2026,
          semaine: parse.detectedSemaine ?? 1,
        });
      } catch (e) {
        setError(`« ${f.name} » : ${(e as Error).message}`);
      }
    }
    setPending((cur) => [...cur, ...results]);
    setParsing(false);
  }

  function patch(id: string, p: Partial<Pending>) {
    setPending((cur) => cur.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  function importAll() {
    // Garde anti-doublon : même distributeur + année + semaine déjà en base
    // (ou en double dans la sélection) → on demande confirmation explicite.
    const seen = new Set(batches.map((b) => `${b.distributeurId}|${b.annee}|${b.semaine}`));
    const dups: string[] = [];
    for (const p of pending) {
      const k = `${p.distributeurId}|${p.annee}|${p.semaine}`;
      if (seen.has(k)) dups.push(`${p.sourceName || p.fileName} → ${p.annee}·S${p.semaine}`);
      seen.add(k);
    }
    if (dups.length > 0) {
      const ok = window.confirm(
        `Attention : ${dups.length} fichier(s) ciblent une semaine DÉJÀ présente pour ce distributeur :\n\n` +
        dups.map((d) => `• ${d}`).join('\n') +
        `\n\nImporter quand même créera un doublon (chiffres comptés deux fois). Continuer ?`,
      );
      if (!ok) return;
    }
    for (const p of pending) {
      const dist = DISTRIBUTEURS.find((d) => d.id === p.distributeurId);
      const rows: Vente[] = p.parse.rows.map((r) => ({
        ean: r.ean,
        distributeurId: p.distributeurId,
        magasinCode: `${dist?.codeRetail ?? 'NA'}-CONSO`,
        magasinLibelle: `${dist?.nom ?? p.distributeurId} — flux consolidé`,
        annee: p.annee,
        semaine: p.semaine,
        qteVendue: r.qteVendue,
        qteStock: r.qteStock,
        caTTC: r.caTTC,
      }));
      const stats = computeBatchStats(rows);
      addBatch({
        id: newId(),
        sourceName: p.sourceName.trim() || p.fileName,
        distributeurId: p.distributeurId,
        annee: p.annee,
        semaine: p.semaine,
        formatId: p.formatId,
        fileName: p.fileName,
        importedAt: new Date().toISOString(),
        rows,
        ...stats,
      });
    }
    window.location.assign('/pilotage');
  }

  function onDelete(b: ImportBatch) {
    if (!window.confirm(`Supprimer le lot « ${b.sourceName} » ?\n${formatNumber(b.totalQte)} u. · ${formatMoney(b.totalCa, devise, { compact: true })}`)) return;
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
  const pendingQte = pending.reduce((s, p) => s + p.parse.totalQte, 0);
  const pendingCa = pending.reduce((s, p) => s + p.parse.totalCa, 0);

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
          Import de données
        </h1>
        <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
          Déposez un ou plusieurs fichiers bruts (plusieurs semaines à la fois). Format reconnu,
          ventes consolidées par référence, CA valorisé par la grille de prix.
        </p>
      </div>

      {/* ZONE DE DÉPÔT */}
      <Card padded={false} className="overflow-hidden mb-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
          className={classNames(
            'p-10 text-center transition-colors border-2 border-dashed m-4 rounded-2xl',
            dragOver ? 'border-silverlit-red bg-silverlit-red-soft' : 'border-surface-line dark:border-night-line',
          )}
        >
          {parsing ? (
            <>
              <div className="w-7 h-7 mx-auto rounded-full border-2 border-surface-line border-t-silverlit-red animate-spin mb-3" />
              <p className="text-sm text-ink dark:text-night-ink">Lecture et valorisation…</p>
            </>
          ) : (
            <>
              <UploadCloud size={32} className="mx-auto text-ink-muted mb-3" strokeWidth={1.4} />
              <p className="text-[15px] text-ink dark:text-night-ink font-medium tracking-tightish">
                Glissez vos fichiers (1 ou plusieurs semaines)
              </p>
              <p className="text-xs text-ink-muted mt-1.5">CSV, TSV, XLSX — formats King Jouet (JOL) & JouéClub reconnus</p>
              <button onClick={() => fileInput.current?.click()} className="mt-4 inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium hover:bg-silverlit-red-deep">
                Parcourir
              </button>
              <input ref={fileInput} type="file" hidden multiple accept=".csv,.tsv,.xlsx,.xlsm,.xls"
                onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} />
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

      {/* REVUE MULTI-FICHIERS */}
      {pending.length > 0 && (
        <Card padded={false} className="mb-6">
          <div className="px-5 py-4 border-b border-hair hairline flex items-center justify-between gap-3 flex-wrap">
            <SectionHeader title={`${pending.length} fichier(s) à importer`} subtitle={`${formatNumber(pendingQte)} u. · ${formatMoney(pendingCa, devise, { compact: true })} au total`} />
            <div className="flex items-center gap-2">
              <button onClick={() => setPending([])} className="h-9 px-3 rounded-lg border border-hair hairline text-xs text-ink-muted hover:text-ink">Tout annuler</button>
              <button onClick={importAll} className="inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium hover:bg-silverlit-red-deep">
                <Check size={14} /> Tout importer
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-2xs">
              <thead>
                <tr className="border-b border-hair hairline text-ink-muted">
                  <th className="text-left px-3 py-2 font-normal uppercase tracking-wider">Nom de la source</th>
                  <th className="text-left px-3 py-2 font-normal uppercase tracking-wider">Distributeur</th>
                  <th className="text-center px-3 py-2 font-normal uppercase tracking-wider">Année</th>
                  <th className="text-center px-3 py-2 font-normal uppercase tracking-wider">Sem.</th>
                  <th className="text-right px-3 py-2 font-normal uppercase tracking-wider">Qté</th>
                  <th className="text-right px-3 py-2 font-normal uppercase tracking-wider">CA grille</th>
                  <th className="text-center px-3 py-2 font-normal uppercase tracking-wider">Alerte</th>
                  <th className="px-2"></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id} className="border-b border-hair hairline last:border-b-0">
                    <td className="px-3 py-2 min-w-[200px]">
                      <input value={p.sourceName} onChange={(e) => patch(p.id, { sourceName: e.target.value })} className="input" style={{ height: '2rem' }} />
                      <p className="text-2xs text-ink-muted truncate mt-0.5 max-w-[220px]">{p.fileName}</p>
                    </td>
                    <td className="px-3 py-2">
                      <select value={p.distributeurId} onChange={(e) => patch(p.id, { distributeurId: e.target.value })} className="input" style={{ height: '2rem' }}>
                        {DISTRIBUTEURS.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 w-16">
                      <input type="number" value={p.annee} onChange={(e) => patch(p.id, { annee: parseInt(e.target.value, 10) || 2026 })} className="input text-center" style={{ height: '2rem' }} />
                    </td>
                    <td className="px-2 py-2 w-14">
                      <input type="number" min={1} max={53} value={p.semaine} onChange={(e) => patch(p.id, { semaine: parseInt(e.target.value, 10) || 1 })} className="input text-center" style={{ height: '2rem' }} />
                    </td>
                    <td className="px-3 py-2 text-right tabular text-ink dark:text-night-ink">{formatNumber(p.parse.totalQte)}</td>
                    <td className="px-3 py-2 text-right tabular text-ink dark:text-night-ink">{formatMoney(p.parse.totalCa, devise, { compact: true })}</td>
                    <td className="px-3 py-2 text-center">
                      {p.parse.unpricedRefs > 0
                        ? <span title={`${p.parse.unpricedRefs} réf. hors grille (${p.parse.unpricedQte} u.)`} className="inline-flex items-center gap-1 text-brand-orange"><AlertTriangle size={12} />{p.parse.unpricedRefs}</span>
                        : <Check size={13} className="text-brand-green inline" />}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => setPending((cur) => cur.filter((x) => x.id !== p.id))} className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-muted hover:text-red-600"><X size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* DOCUMENTS IMPORTÉS */}
      <Card padded={false}>
        <div className="px-5 py-4 border-b border-hair hairline flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-ink-muted" />
            <h2 className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink">Documents importés</h2>
            <Badge>{batches.length}</Badge>
          </div>
          <p className="text-2xs text-ink-muted tabular">Total dashboard : {formatNumber(totalQteAll)} u. · {formatMoney(totalCaAll, devise, { compact: true })}</p>
        </div>
        {batches.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Info size={20} className="text-ink-muted mx-auto mb-2" />
            <p className="text-sm text-ink-muted">Aucun document importé.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair hairline text-ink-muted">
                <th className="text-left px-5 py-2.5 text-2xs uppercase tracking-wider font-normal">Source</th>
                <th className="text-left px-3 py-2.5 text-2xs uppercase tracking-wider font-normal">Distributeur</th>
                <th className="text-center px-3 py-2.5 text-2xs uppercase tracking-wider font-normal">Période</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider font-normal">Qté</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider font-normal">CA grille</th>
                <th className="text-right px-3 py-2.5 text-2xs uppercase tracking-wider font-normal">Réfs</th>
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
                        <button onClick={() => setEditing(b)} title="Modifier" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-alt dark:hover:bg-night-alt"><Pencil size={13} /></button>
                        <button onClick={() => onDelete(b)} title="Supprimer" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-night-alt"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* MODALE MODIFIER */}
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
                <Field label="Année"><input type="number" value={editing.annee} onChange={(e) => setEditing({ ...editing, annee: parseInt(e.target.value, 10) || 2026 })} className="input" /></Field>
                <Field label="Semaine"><input type="number" min={1} max={53} value={editing.semaine} onChange={(e) => setEditing({ ...editing, semaine: parseInt(e.target.value, 10) || 1 })} className="input" /></Field>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="h-9 px-3 rounded-lg border border-hair hairline text-xs text-ink-muted">Annuler</button>
              <button onClick={saveEdit} className="inline-flex items-center gap-2 bg-silverlit-red text-white px-4 h-9 rounded-lg text-sm font-medium"><Check size={14} /> Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end">
        <Link to="/pilotage" className="text-xs text-silverlit-red hover:underline inline-flex items-center gap-1">Voir le dashboard <ArrowRight size={11} /></Link>
      </div>
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
