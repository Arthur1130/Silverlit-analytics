import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AniziaBrand } from '../components/AniziaBrand';

export function Demande() {
  const { submitDemande } = useAuth();
  const [form, setForm] = useState({ nom: '', email: '', entreprise: '', motif: '' });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.nom || !form.email) return;
    setErr(null);
    setBusy(true);
    const res = await submitDemande(form);
    setBusy(false);
    if (res.ok) setSent(true);
    else setErr(res.error ?? 'Erreur lors de l\'envoi');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-alt dark:bg-night-bg p-6">
      <div className="w-full max-w-[460px]">
        <div className="flex items-center justify-center mb-8">
          <AniziaBrand variant="full" size="md" asLink={false} />
        </div>

        {sent ? (
          <div className="bg-white dark:bg-night-surface border border-hair hairline rounded-2xl p-8 text-center">
            <CheckCircle2 size={36} className="text-brand-green mx-auto mb-3" strokeWidth={1.5} />
            <h1 className="text-[18px] font-medium tracking-tightish text-ink dark:text-night-ink">
              Demande envoyée
            </h1>
            <p className="text-xs text-ink-muted mt-3">
              L'équipe Silverlit traite les demandes sous 48 h ouvrées.
              Vous recevrez un email à <span className="text-ink dark:text-night-ink">{form.email}</span> dès validation.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-silverlit-red hover:underline"
            >
              <ArrowLeft size={11} /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-night-surface border border-hair hairline rounded-2xl p-7">
            <h1 className="text-[20px] font-medium tracking-tightish text-ink dark:text-night-ink">
              Demande d'accès
            </h1>
            <p className="text-xs text-ink-muted dark:text-night-muted mt-1.5">
              Décrivez votre besoin pour qu'un administrateur valide la création de votre compte.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-3">
              <Field label="Nom complet" value={form.nom} onChange={(v) => update('nom', v)} placeholder="Marie Dubois" required />
              <Field label="Email professionnel" type="email" value={form.email} onChange={(v) => update('email', v)} placeholder="marie.dubois@silverlit.fr" required />
              <Field label="Entreprise / service" value={form.entreprise} onChange={(v) => update('entreprise', v)} placeholder="Silverlit France · Marketing" />

              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                  Motif de la demande
                </label>
                <textarea
                  rows={3}
                  value={form.motif}
                  onChange={(e) => update('motif', e.target.value)}
                  placeholder="Suivi des ventes JouéClub pour mes clients du secteur Sud-Est"
                  className="w-full px-3 py-2 border border-hair hairline rounded-lg bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red placeholder:text-ink-muted resize-none"
                />
              </div>

              {err && (
                <div className="text-xs text-brand-red bg-brand-red/10 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={!form.nom || !form.email || busy}
                className="w-full h-10 rounded-lg bg-silverlit-red hover:bg-silverlit-red-deep text-white text-sm font-medium disabled:opacity-40 transition-colors"
              >
                {busy ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-hair hairline text-center">
              <Link to="/login" className="text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink inline-flex items-center gap-1.5">
                <ArrowLeft size={11} /> Retour à la connexion
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}
function Field({ label, value, onChange, placeholder, type = 'text', required }: FieldProps) {
  return (
    <div>
      <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
        {label}
        {required && <span className="text-brand-red ml-0.5">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 border border-hair hairline rounded-lg bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red placeholder:text-ink-muted"
      />
    </div>
  );
}
