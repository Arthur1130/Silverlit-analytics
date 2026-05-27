import { useMemo, useState } from 'react';
import { Settings, Coins, Users, RotateCcw, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Card, Badge } from '../components/ui';
import { DEVISES, DEFAULT_EXCHANGE_RATES } from '../utils/currency';
import type { Devise } from '../types';
import { Equipe } from './Equipe';
import { classNames } from '../utils/format';

type Tab = 'devises' | 'equipe';

export function Parametres() {
  const { isAdmin } = useAuth();
  // Onglet par défaut : "devises" (accessible à tous)
  const [tab, setTab] = useState<Tab>('devises');

  const tabs: Array<{ key: Tab; label: string; icon: typeof Coins; visible: boolean }> = [
    { key: 'devises', label: 'Taux de change', icon: Coins, visible: true },
    { key: 'equipe', label: 'Équipe', icon: Users, visible: isAdmin },
  ];

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-surface-alt dark:bg-night-alt flex items-center justify-center">
          <Settings size={18} className="text-ink-muted" />
        </div>
        <div>
          <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
            Paramètres
          </h1>
          <p className="text-sm text-ink-muted dark:text-night-muted mt-0.5">
            Réglages globaux de la plateforme — taux de change et administration.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-hair hairline mb-6 flex items-center gap-1">
        {tabs.filter((t) => t.visible).map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={classNames(
                'inline-flex items-center gap-1.5 px-3 h-9 text-[13px] -mb-px border-b-2 transition-colors',
                active
                  ? 'border-silverlit-red text-ink dark:text-night-ink font-medium'
                  : 'border-transparent text-ink-muted hover:text-ink dark:hover:text-night-ink',
              )}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'devises' && <DevisesPanel />}
      {tab === 'equipe' && isAdmin && <Equipe />}
    </div>
  );
}

// =======================================================================
//   Panneau Taux de change
// =======================================================================

function DevisesPanel() {
  const { exchangeRates, setExchangeRate, resetExchangeRates } = useApp();

  // Buffer local : on n'écrit dans le context QUE quand l'utilisateur
  // clique "Enregistrer" pour la ligne (ou perd le focus). Sinon chaque
  // frappe re-rendrerait toute l'app.
  const [draft, setDraft] = useState<Partial<Record<Devise, string>>>({});
  const [savedAt, setSavedAt] = useState<Devise | null>(null);

  const editableDevises = useMemo<Devise[]>(
    () => (Object.keys(DEVISES) as Devise[]).filter((d) => d !== 'EUR'),
    [],
  );

  function commitRate(d: Devise) {
    const raw = draft[d];
    if (raw === undefined) return;
    const parsed = Number(raw.replace(',', '.'));
    if (!isFinite(parsed) || parsed <= 0) {
      // valeur invalide : on remet la dernière valeur saisie au current
      setDraft((cur) => ({ ...cur, [d]: undefined }));
      return;
    }
    setExchangeRate(d, parsed);
    setDraft((cur) => ({ ...cur, [d]: undefined }));
    setSavedAt(d);
    window.setTimeout(() => setSavedAt((cur) => (cur === d ? null : cur)), 1800);
  }

  function handleReset() {
    if (!window.confirm('Réinitialiser tous les taux aux valeurs par défaut ?')) return;
    resetExchangeRates();
    setDraft({});
  }

  const hasCustomRates = editableDevises.some(
    (d) => exchangeRates[d] !== DEFAULT_EXCHANGE_RATES[d],
  );

  return (
    <Card padded={false}>
      <div className="px-5 py-4 border-b border-hair hairline flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink">
            Taux de change
          </h2>
          <p className="text-xs text-ink-muted dark:text-night-muted mt-0.5">
            EUR est la devise pivot (non modifiable). Saisissez la valeur en
            <strong className="text-ink dark:text-night-ink mx-1">1 EUR = X devise</strong>.
            Mise à jour annuelle recommandée.
          </p>
        </div>
        {hasCustomRates && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-hair hairline text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt"
            title="Restaurer les taux par défaut"
          >
            <RotateCcw size={12} />
            Réinitialiser
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hair hairline">
            <th className="text-left px-5 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">
              Devise
            </th>
            <th className="text-left px-5 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">
              Code
            </th>
            <th className="text-left px-5 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">
              1 EUR =
            </th>
            <th className="text-left px-5 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">
              Taux par défaut
            </th>
            <th className="text-right px-5 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">
              Statut
            </th>
          </tr>
        </thead>
        <tbody>
          {/* EUR — ligne référence, non éditable */}
          <tr className="border-b border-hair hairline bg-surface-alt/30 dark:bg-night-alt/30">
            <td className="px-5 py-3 text-[13px] text-ink dark:text-night-ink">
              <span className="inline-flex items-center gap-2">
                <span className="font-medium">{DEVISES.EUR.label}</span>
                <Badge tone="neutral" size="sm">Pivot</Badge>
              </span>
            </td>
            <td className="px-5 py-3 text-[13px] text-ink-muted tabular">EUR</td>
            <td className="px-5 py-3 text-[13px] tabular text-ink dark:text-night-ink">
              1,0000 €
            </td>
            <td className="px-5 py-3 text-[13px] text-ink-muted tabular">1,0000</td>
            <td className="px-5 py-3 text-right text-2xs text-ink-muted">
              Non modifiable
            </td>
          </tr>

          {editableDevises.map((d) => {
            const info = DEVISES[d];
            const currentRate = exchangeRates[d];
            const isCustom = currentRate !== DEFAULT_EXCHANGE_RATES[d];
            const currentText = draft[d] ?? formatRateInput(currentRate);

            return (
              <tr
                key={d}
                className="border-b border-hair hairline last:border-b-0 hover:bg-surface-alt/30 dark:hover:bg-night-alt/30"
              >
                <td className="px-5 py-3 text-[13px] text-ink dark:text-night-ink">
                  <span className="inline-flex items-center gap-2">
                    {info.label}
                    {isCustom && <Badge tone="info" size="sm">Personnalisé</Badge>}
                  </span>
                </td>
                <td className="px-5 py-3 text-[13px] text-ink-muted tabular">{d}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currentText}
                      onChange={(e) => setDraft((cur) => ({ ...cur, [d]: e.target.value }))}
                      onBlur={() => commitRate(d)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                      className="w-28 h-8 px-2.5 rounded-lg border border-hair hairline bg-white dark:bg-night-surface text-[13px] tabular text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red focus:ring-1 focus:ring-silverlit-red/30"
                      aria-label={`Taux ${d}`}
                    />
                    <span className="text-2xs text-ink-muted tabular shrink-0">{info.symbol}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-[13px] text-ink-muted tabular">
                  {formatRateInput(DEFAULT_EXCHANGE_RATES[d])}
                </td>
                <td className="px-5 py-3 text-right">
                  {savedAt === d ? (
                    <span className="inline-flex items-center gap-1 text-2xs text-brand-green">
                      <Check size={12} /> enregistré
                    </span>
                  ) : (
                    <span className="text-2xs text-ink-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="px-5 py-3 border-t border-hair hairline bg-surface-alt/30 dark:bg-night-alt/20">
        <p className="text-2xs text-ink-muted leading-relaxed">
          <strong className="text-ink dark:text-night-ink">Comment ça marche.</strong>{' '}
          Saisissez la nouvelle valeur dans la colonne « 1 EUR = » et appuyez sur Entrée
          (ou cliquez en dehors du champ) pour enregistrer. Les taux sont sauvegardés
          dans votre navigateur et appliqués immédiatement à toutes les pages.
          Pour une cohérence avec votre comptabilité, mettez à jour ces taux une fois par an.
        </p>
      </div>
    </Card>
  );
}

// Formatage stable : 4 décimales, séparateur français (virgule)
function formatRateInput(rate: number): string {
  return rate.toLocaleString('fr-FR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
    useGrouping: false,
  });
}
