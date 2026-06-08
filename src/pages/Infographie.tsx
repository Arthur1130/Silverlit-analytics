import { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  Download, Share2, Mail, Copy, Check, Sparkles, TrendingUp, TrendingDown,
  AlertTriangle, ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui';
import { PoliLogo } from '../components/PoliLogo';
import {
  PRODUITS, DISTRIBUTEURS, VENTES, WEEKS, CURRENT_WEEK, findProduit,
} from '../data';
import type { Vente, Gamme } from '../types';
import { formatMoney, formatNumber, formatPct } from '../utils/currency';
import { classNames, weekShort } from '../utils/format';

type Preset = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'custom';
type Layout = 'portrait' | 'paysage';

const GAMMES: Gamme[] = ['EXOST', 'FLYBOTIC', 'YCOO', 'ROBOCAR POLI', 'OUAPS', 'SPIROGRAPH', 'LAZER MAD', 'TOOKO', 'Autres marques'];

function weekKey(w: { annee: number; semaine: number }) {
  return `${w.annee}-${w.semaine}`;
}

function periodWeeks(preset: Preset, nbCustom: number) {
  if (preset === 'jour') return [CURRENT_WEEK];
  if (preset === 'semaine') return WEEKS.slice(-4);
  if (preset === 'mois') return WEEKS.slice(-13);
  if (preset === 'trimestre') return WEEKS.slice(-26);
  return WEEKS.slice(-Math.max(1, Math.min(WEEKS.length, nbCustom)));
}

function PRESET_LABEL(preset: Preset, custom: number) {
  if (preset === 'jour') return 'Semaine S-1';
  if (preset === 'semaine') return '4 semaines glissantes';
  if (preset === 'mois') return '13 semaines glissantes';
  if (preset === 'trimestre') return '26 semaines glissantes';
  return `${custom} semaine${custom > 1 ? 's' : ''}`;
}

export function Infographie() {
  const { devise } = useApp();
  const { user } = useAuth();

  const [preset, setPreset] = useState<Preset>('semaine');
  const [custom, setCustom] = useState(8);
  const [layout, setLayout] = useState<Layout>('portrait');
  const [selectedDist, setSelectedDist] = useState<Set<string>>(new Set(DISTRIBUTEURS.map((d) => d.id)));
  const [selectedGammes, setSelectedGammes] = useState<Set<Gamme>>(new Set(GAMMES));
  const [accent, setAccent] = useState<'noir' | 'bleu' | 'orange'>('noir');
  const [titre, setTitre] = useState('Bilan commercial Silverlit');
  const [showFooter, setShowFooter] = useState(true);
  // Base de comparaison des deltas : période précédente OU année N-1
  const [comparaison, setComparaison] = useState<'precedente' | 'n1'>('precedente');

  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const weeks = useMemo(() => periodWeeks(preset, custom), [preset, custom]);
  const periodLabel = PRESET_LABEL(preset, custom);

  // Base de comparaison :
  //  - 'precedente' : période immédiatement antérieure de même durée
  //  - 'n1'         : mêmes semaines, un an plus tôt (N-1)
  const prevWeeks = useMemo(() => {
    if (comparaison === 'n1') {
      return weeks.map((w) => ({ annee: w.annee - 1, semaine: w.semaine }));
    }
    const idx = WEEKS.findIndex((w) => weekKey(w) === weekKey(weeks[0]));
    const len = weeks.length;
    return WEEKS.slice(Math.max(0, idx - len), idx);
  }, [weeks, comparaison]);

  const compareLabel = comparaison === 'n1' ? 'N-1' : 'période précédente';

  function filter(ventes: Vente[], ws: Array<{ annee: number; semaine: number }>) {
    const wset = new Set(ws.map(weekKey));
    const gammeEans = new Set(
      PRODUITS.filter((p) => selectedGammes.has(p.gamme)).map((p) => p.ean),
    );
    return ventes.filter((v) =>
      wset.has(weekKey(v)) && selectedDist.has(v.distributeurId) && gammeEans.has(v.ean),
    );
  }

  const cur = useMemo(() => filter(VENTES, weeks), [weeks, selectedDist, selectedGammes]);
  const prev = useMemo(() => filter(VENTES, prevWeeks), [prevWeeks, selectedDist, selectedGammes]);

  const { ca, qte, refs } = useMemo(() => {
    let ca = 0, qte = 0;
    const refs = new Set<string>();
    for (const v of cur) { ca += v.caTTC; qte += v.qteVendue; refs.add(v.ean); }
    return { ca, qte, refs: refs.size };
  }, [cur]);

  const { caPrev, qtePrev } = useMemo(() => {
    let ca = 0, qte = 0;
    for (const v of prev) { ca += v.caTTC; qte += v.qteVendue; }
    return { caPrev: ca, qtePrev: qte };
  }, [prev]);

  // Une comparaison n'a de sens que s'il existe une période précédente réelle
  const hasComparison = prev.length > 0;
  const deltaCA = caPrev > 0 ? ((ca - caPrev) / caPrev) * 100 : 0;
  const deltaQte = qtePrev > 0 ? ((qte - qtePrev) / qtePrev) * 100 : 0;

  // Top 5 produits
  const topProduits = useMemo(() => {
    const map = new Map<string, { ca: number; qte: number }>();
    for (const v of cur) {
      const x = map.get(v.ean) ?? { ca: 0, qte: 0 };
      x.ca += v.caTTC; x.qte += v.qteVendue;
      map.set(v.ean, x);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].ca - a[1].ca)
      .slice(0, 5)
      .map(([ean, agg]) => ({ ean, libelle: findProduit(ean)?.libelle ?? ean, ...agg }));
  }, [cur]);

  // Top distributeurs avec delta
  const topDistribs = useMemo(() => {
    const cMap = new Map<string, number>();
    const pMap = new Map<string, number>();
    for (const v of cur) cMap.set(v.distributeurId, (cMap.get(v.distributeurId) ?? 0) + v.caTTC);
    for (const v of prev) pMap.set(v.distributeurId, (pMap.get(v.distributeurId) ?? 0) + v.caTTC);
    return DISTRIBUTEURS.filter((d) => selectedDist.has(d.id))
      .map((d) => {
        const caC = cMap.get(d.id) ?? 0;
        const caP = pMap.get(d.id) ?? 0;
        const delta = caP > 0 ? ((caC - caP) / caP) * 100 : 0;
        return { ...d, ca: caC, caPrev: caP, delta };
      })
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5);
  }, [cur, prev, selectedDist]);

  // Mouvements : top 3 hausses + top 3 baisses (par produit)
  const mouvements = useMemo(() => {
    const cMap = new Map<string, number>();
    const pMap = new Map<string, number>();
    for (const v of cur) cMap.set(v.ean, (cMap.get(v.ean) ?? 0) + v.caTTC);
    for (const v of prev) pMap.set(v.ean, (pMap.get(v.ean) ?? 0) + v.caTTC);
    const eans = new Set([...cMap.keys(), ...pMap.keys()]);
    const arr: Array<{ ean: string; libelle: string; caCur: number; caPrev: number; pct: number }> = [];
    for (const e of eans) {
      const caCur = cMap.get(e) ?? 0;
      const caPrev = pMap.get(e) ?? 0;
      if (caCur + caPrev < 200) continue;
      const pct = caPrev > 0 ? ((caCur - caPrev) / caPrev) * 100 : caCur > 0 ? 100 : 0;
      arr.push({ ean: e, libelle: findProduit(e)?.libelle ?? e, caCur, caPrev, pct });
    }
    const hausses = [...arr].sort((a, b) => b.pct - a.pct).slice(0, 3);
    const baisses = [...arr].sort((a, b) => a.pct - b.pct).slice(0, 3);
    return { hausses, baisses };
  }, [cur, prev]);

  // Mini-courbe CA hebdomadaire
  const sparkData = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of cur) {
      const k = weekKey(v);
      map.set(k, (map.get(k) ?? 0) + v.caTTC);
    }
    const series = weeks.map((w) => ({
      label: weekShort(w.annee, w.semaine),
      v: map.get(weekKey(w)) ?? 0,
    }));
    const max = Math.max(1, ...series.map((s) => s.v));
    return { series, max };
  }, [cur, weeks]);

  const accentClass = {
    noir: { bg: 'bg-ink dark:bg-night-ink', text: 'text-ink dark:text-night-ink', stroke: '#1d1d1f' },
    bleu: { bg: 'bg-brand-blue', text: 'text-silverlit-red', stroke: '#007aff' },
    orange: { bg: 'bg-brand-orange', text: 'text-brand-orange', stroke: '#ff9500' },
  }[accent];

  async function exportPNG() {
    if (!posterRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `Silverlit-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export PNG échoué', e);
    } finally {
      setExporting(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no-op */
    }
  }

  function shareEmail() {
    const subject = encodeURIComponent(`${titre} — ${periodLabel}`);
    const body = encodeURIComponent(
      `Bonjour,\n\nVoici le rapport hebdomadaire Silverlit (${periodLabel}).\n\nLien : ${window.location.href}\n\n— ${user?.fullName ?? 'Équipe Silverlit'}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
            Infographie hebdomadaire
          </h1>
          <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
            Générez un rapport visuel à partager avec les équipes commerciales · export PNG
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hair hairline text-xs text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt"
          >
            {copied ? <Check size={13} className="text-brand-green" /> : <Copy size={13} />}
            {copied ? 'Lien copié' : 'Copier le lien'}
          </button>
          <button
            onClick={shareEmail}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hair hairline text-xs text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt"
          >
            <Mail size={13} /> Email
          </button>
          <button
            onClick={exportPNG}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-ink dark:bg-night-ink text-white dark:text-black text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Download size={13} /> {exporting ? 'Export…' : 'Télécharger PNG'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* Volet de paramétrage */}
        <Card padded={false} className="lg:sticky lg:top-20 overflow-hidden">
          <div className="px-4 py-3 border-b border-hair hairline flex items-center gap-2">
            <Sparkles size={13} className="text-silverlit-red" />
            <h2 className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink">
              Paramètres
            </h2>
          </div>

          <div className="px-4 py-4 space-y-5">
            {/* Période */}
            <div>
              <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-2">
                Période
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ['jour', 'Semaine'],
                  ['semaine', '4 sem.'],
                  ['mois', 'Trimestre'],
                  ['trimestre', 'Semestre'],
                  ['custom', 'Personnalisé'],
                ] as Array<[Preset, string]>).map(([p, lbl]) => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className={classNames(
                      'h-8 rounded-md text-xs col-span-1',
                      preset === p
                        ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                        : 'border border-hair hairline text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt',
                      p === 'custom' && 'col-span-2',
                    )}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xs text-ink-muted">Nombre de semaines</span>
                    <span className="text-xs tabular text-ink dark:text-night-ink">{custom}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={WEEKS.length}
                    value={custom}
                    onChange={(e) => setCustom(parseInt(e.target.value, 10))}
                    className="w-full accent-ink"
                  />
                </div>
              )}
            </div>

            {/* Base de comparaison */}
            <div>
              <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-2">
                Comparer à
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ['precedente', 'Période précéd.'],
                  ['n1', 'Année N-1'],
                ] as Array<['precedente' | 'n1', string]>).map(([v, lbl]) => (
                  <button
                    key={v}
                    onClick={() => setComparaison(v)}
                    className={classNames(
                      'h-8 rounded-md text-xs',
                      comparaison === v
                        ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                        : 'border border-hair hairline text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt',
                    )}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <p className="text-2xs text-ink-muted mt-1.5 leading-relaxed">
                {comparaison === 'n1'
                  ? 'Les évolutions sont calculées vs les mêmes semaines un an plus tôt.'
                  : 'Les évolutions sont calculées vs la période immédiatement antérieure.'}
              </p>
            </div>

            {/* Distributeurs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-2xs uppercase tracking-wider text-ink-muted">
                  Distributeurs
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSelectedDist(new Set(DISTRIBUTEURS.map((d) => d.id)))}
                    className="text-2xs text-silverlit-red hover:underline"
                  >
                    Tous
                  </button>
                  <span className="text-2xs text-ink-muted">·</span>
                  <button
                    onClick={() => setSelectedDist(new Set())}
                    className="text-2xs text-ink-muted hover:underline"
                  >
                    Aucun
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {DISTRIBUTEURS.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 text-xs cursor-pointer text-ink dark:text-night-ink"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDist.has(d.id)}
                      onChange={(e) => {
                        const next = new Set(selectedDist);
                        if (e.target.checked) next.add(d.id);
                        else next.delete(d.id);
                        setSelectedDist(next);
                      }}
                      className="accent-ink"
                    />
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.logoColor }} />
                    {d.nom}
                  </label>
                ))}
              </div>
            </div>

            {/* Gammes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-2xs uppercase tracking-wider text-ink-muted">
                  Gammes
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSelectedGammes(new Set(GAMMES))}
                    className="text-2xs text-silverlit-red hover:underline"
                  >
                    Toutes
                  </button>
                  <span className="text-2xs text-ink-muted">·</span>
                  <button
                    onClick={() => setSelectedGammes(new Set())}
                    className="text-2xs text-ink-muted hover:underline"
                  >
                    Aucune
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {GAMMES.map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      const next = new Set(selectedGammes);
                      if (next.has(g)) next.delete(g);
                      else next.add(g);
                      setSelectedGammes(next);
                    }}
                    className={classNames(
                      'text-2xs px-2 h-6 rounded-md',
                      selectedGammes.has(g)
                        ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                        : 'border border-hair hairline text-ink-muted hover:bg-surface-alt dark:hover:bg-night-alt',
                    )}
                  >
                    {g.replace(' & ', '+')}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-2">
                Format & couleur
              </label>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <button
                  onClick={() => setLayout('portrait')}
                  className={classNames(
                    'h-8 rounded-md text-xs',
                    layout === 'portrait'
                      ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                      : 'border border-hair hairline text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt',
                  )}
                >
                  Portrait
                </button>
                <button
                  onClick={() => setLayout('paysage')}
                  className={classNames(
                    'h-8 rounded-md text-xs',
                    layout === 'paysage'
                      ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                      : 'border border-hair hairline text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt',
                  )}
                >
                  Paysage
                </button>
              </div>
              <div className="flex gap-1.5">
                {(['noir', 'bleu', 'orange'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccent(c)}
                    className={classNames(
                      'flex-1 h-7 rounded-md text-2xs capitalize',
                      accent === c
                        ? 'bg-ink dark:bg-night-ink text-white dark:text-black'
                        : 'border border-hair hairline text-ink-muted hover:bg-surface-alt dark:hover:bg-night-alt',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Titre */}
            <div>
              <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                Titre du rapport
              </label>
              <input
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                className="w-full h-9 px-2.5 rounded-md border border-hair hairline bg-white dark:bg-night-surface text-xs text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red"
              />
              <label className="mt-2 flex items-center gap-2 text-2xs text-ink dark:text-night-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFooter}
                  onChange={(e) => setShowFooter(e.target.checked)}
                  className="accent-ink"
                />
                Inclure le pied de page (auteur, date)
              </label>
            </div>
          </div>
        </Card>

        {/* Poster */}
        <div className="flex justify-center">
          <div
            ref={posterRef}
            data-poster="silverlit"
            className={classNames(
              'bg-white text-ink shadow-[0_24px_60px_rgba(0,0,0,0.08)] border border-hair hairline rounded-3xl overflow-hidden p-10',
              layout === 'portrait' ? 'w-[800px]' : 'w-[1100px]',
            )}
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={classNames('w-7 h-7 rounded-lg flex items-center justify-center text-white', accentClass.bg)}>
                    <PoliLogo size={18} />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                    Silverlit · Analytics
                  </span>
                </div>
                <h2 className="text-[34px] font-medium tracking-tighter2 leading-tight">
                  {titre}
                </h2>
                <p className="text-sm text-ink-muted mt-1">
                  {periodLabel} · semaines {weekShort(weeks[0].annee, weeks[0].semaine)} → {weekShort(weeks[weeks.length - 1].annee, weeks[weeks.length - 1].semaine)} · {weeks.length} semaine{weeks.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xs uppercase tracking-wider text-ink-muted">Devise</p>
                <p className="text-[13px] tabular mt-0.5 text-ink">{devise}</p>
              </div>
            </div>

            {/* Hero KPIs */}
            <div className="grid grid-cols-4 gap-3 mb-8">
              <KPIBlock label="Chiffre d'affaires" value={formatMoney(ca, devise, { compact: true })} delta={hasComparison ? deltaCA : undefined} deltaLabel={compareLabel} subtitle="période importée" accent={accentClass.text} />
              <KPIBlock label="Quantités" value={formatNumber(qte, { compact: true })} delta={hasComparison ? deltaQte : undefined} deltaLabel={compareLabel} subtitle="période importée" accent={accentClass.text} />
              <KPIBlock label="Références" value={String(refs)} subtitle={`sur ${PRODUITS.length} catalogue`} accent={accentClass.text} />
              <KPIBlock label="Distributeurs" value={String(selectedDist.size)} subtitle={`sur ${DISTRIBUTEURS.length} sources`} accent={accentClass.text} />
            </div>

            {/* Courbe CA hebdo */}
            <div className="mb-8">
              <SectionTitle>Évolution du CA · {weeks.length} semaine{weeks.length > 1 ? 's' : ''}</SectionTitle>
              <div className="mt-3">
                <Spark series={sparkData.series} max={sparkData.max} accent={accentClass.stroke} devise={devise} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Top produits */}
              <div>
                <SectionTitle>Top 5 produits</SectionTitle>
                <ul className="mt-3 space-y-2.5">
                  {topProduits.map((p, i) => {
                    const w = topProduits[0].ca > 0 ? (p.ca / topProduits[0].ca) * 100 : 0;
                    return (
                      <li key={p.ean}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-2xs tabular text-ink-muted w-4">{i + 1}.</span>
                            <span className="text-[13px] truncate">{p.libelle}</span>
                          </div>
                          <span className="text-[13px] tabular text-ink ml-3 shrink-0">{formatMoney(p.ca, devise, { compact: true })}</span>
                        </div>
                        <div className="h-1 bg-surface-alt rounded overflow-hidden">
                          <div className={classNames('h-full', accentClass.bg)} style={{ width: `${w}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Top distributeurs */}
              <div>
                <SectionTitle>Top distributeurs</SectionTitle>
                <ul className="mt-3 space-y-2.5">
                  {topDistribs.map((d, i) => (
                    <li key={d.id} className="flex items-center gap-2">
                      <span className="text-2xs tabular text-ink-muted w-4">{i + 1}.</span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.logoColor }} />
                      <span className="text-[13px] truncate flex-1">{d.nom}</span>
                      <span className="text-[13px] tabular text-ink">{formatMoney(d.ca, devise, { compact: true })}</span>
                      {hasComparison && (
                        <span
                          className={classNames(
                            'text-2xs tabular w-14 text-right shrink-0',
                            d.delta > 0 ? 'text-brand-green' : d.delta < 0 ? 'text-brand-red' : 'text-ink-muted',
                          )}
                        >
                          {formatPct(d.delta, { signed: true })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Mouvements */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <MouvementsBlock
                title="Forte croissance"
                icon={<TrendingUp size={14} className="text-brand-green" />}
                tone="success"
                items={mouvements.hausses}
                devise={devise}
              />
              <MouvementsBlock
                title="En recul"
                icon={<TrendingDown size={14} className="text-brand-red" />}
                tone="danger"
                items={mouvements.baisses}
                devise={devise}
              />
            </div>

            {/* Alertes + recommandations */}
            <div className="grid grid-cols-2 gap-8">
              <AlertesBlock devise={devise} weeks={weeks} />
              <RecoBlock distNb={selectedDist.size} deltaCA={deltaCA} />
            </div>

            {/* Footer */}
            {showFooter && (
              <div className="mt-10 pt-6 border-t border-hair hairline flex items-center justify-between text-2xs text-ink-muted">
                <span>
                  Généré par {user?.fullName ?? 'Silverlit Analytics'} · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={11} />
                  Confidentiel · usage interne Silverlit
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 max-w-[800px] mx-auto text-center">
        <p className="text-2xs text-ink-muted dark:text-night-muted">
          <Share2 size={11} className="inline mr-1" />
          Astuce : "Télécharger PNG" génère une image partageable directement sur Slack, Teams ou par email.
        </p>
      </div>
    </div>
  );
}

// -- Sous-composants ------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-[0.16em] text-ink-muted font-medium">
      {children}
    </h3>
  );
}

function KPIBlock({
  label, value, delta, deltaLabel, subtitle, accent,
}: { label: string; value: string; delta?: number; deltaLabel?: string; subtitle?: string; accent: string }) {
  return (
    <div className="bg-surface-alt/70 rounded-xl p-4">
      <p className="text-2xs uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={classNames('text-[26px] leading-none font-medium tracking-tighter2 tabular mt-2', accent)}>
        {value}
      </p>
      <div className="mt-2 text-2xs">
        {delta !== undefined ? (
          <span className={classNames('tabular', delta > 0 ? 'text-brand-green' : delta < 0 ? 'text-brand-red' : 'text-ink-muted')}>
            {formatPct(delta, { signed: true })} <span className="text-ink-muted">vs {deltaLabel ?? 'précédent'}</span>
          </span>
        ) : (
          <span className="text-ink-muted">{subtitle}</span>
        )}
      </div>
    </div>
  );
}

function Spark({
  series, max, accent, devise,
}: { series: Array<{ label: string; v: number }>; max: number; accent: string; devise: any }) {
  const W = 720, H = 120;
  const stepX = series.length > 1 ? W / (series.length - 1) : 0;
  const points = series.map((s, i) => [i * stepX, H - (s.v / max) * H * 0.85 - 6] as [number, number]);
  const path = points.length > 0 ? `M${points.map((p) => p.join(',')).join(' L')}` : '';
  const area = path ? `${path} L${W},${H} L0,${H} Z` : '';

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="ig-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.18} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#ig-grad)" />
        <path d={path} stroke={accent} strokeWidth={1.4} fill="none" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={2.2} fill={accent} />
        ))}
      </svg>
      <div className="flex justify-between mt-1 text-2xs text-ink-muted tabular">
        <span>{series[0]?.label}</span>
        <span>{formatMoney(max, devise, { compact: true })} pic</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function MouvementsBlock({
  title, icon, tone, items, devise,
}: {
  title: string;
  icon: React.ReactNode;
  tone: 'success' | 'danger';
  items: Array<{ ean: string; libelle: string; pct: number; caCur: number; caPrev: number }>;
  devise: any;
}) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <ul className="mt-3 space-y-2.5">
        {items.map((p) => (
          <li key={p.ean} className="flex items-start gap-2">
            <span className="mt-0.5">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] truncate">{p.libelle}</p>
              <p className="text-2xs text-ink-muted tabular">
                {formatMoney(p.caPrev, devise, { compact: true })} → {formatMoney(p.caCur, devise, { compact: true })}
              </p>
            </div>
            <span className={classNames(
              'text-[13px] font-medium tracking-tightish tabular shrink-0',
              tone === 'success' ? 'text-brand-green' : 'text-brand-red',
            )}>
              {formatPct(p.pct, { signed: true })}
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-2xs text-ink-muted">Aucun mouvement significatif.</li>
        )}
      </ul>
    </div>
  );
}

function AlertesBlock({ weeks }: { devise: any; weeks: Array<{ annee: number; semaine: number }> }) {
  const { alertes } = useApp();
  const top = alertes.filter((a) => a.statut === 'ouverte').slice(0, 4);
  return (
    <div>
      <SectionTitle>Points d'attention</SectionTitle>
      <ul className="mt-3 space-y-2">
        {top.map((a) => (
          <li key={a.id} className="flex items-start gap-2">
            <AlertTriangle
              size={12}
              className={classNames(
                'mt-0.5 shrink-0',
                a.severite === 'haute' ? 'text-brand-red' : a.severite === 'moyenne' ? 'text-brand-orange' : 'text-ink-muted',
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] truncate">{a.libelle}</p>
              <p className="text-2xs text-ink-muted">{a.message}</p>
            </div>
          </li>
        ))}
        {top.length === 0 && (
          <li className="text-2xs text-ink-muted">Aucune alerte critique.</li>
        )}
      </ul>
      <p className="text-2xs text-ink-muted mt-3 tabular">
        Source : pilotage hebdo · semaines {weeks.length}
      </p>
    </div>
  );
}

function RecoBlock({ distNb, deltaCA }: { distNb: number; deltaCA: number }) {
  const items: string[] = [];
  if (deltaCA > 5) items.push(`Capitaliser sur la dynamique : ${formatPct(deltaCA, { signed: true })} cette période.`);
  if (deltaCA < -5) items.push(`Mobilisation commerciale : recul ${formatPct(deltaCA, { signed: true })} à corriger sous 2 semaines.`);
  if (distNb < DISTRIBUTEURS.length) items.push(`Vue partielle : ${distNb}/${DISTRIBUTEURS.length} distributeurs inclus.`);
  items.push('Partager ce rapport en kick-off lundi pour aligner les équipes.');
  return (
    <div>
      <SectionTitle>Recommandations</SectionTitle>
      <ul className="mt-3 space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px]">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-ink shrink-0" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
