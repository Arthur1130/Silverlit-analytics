import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth, ROLE_LABELS, type Role } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import { SilverlitLogo } from '../components/SilverlitLogo';

type State =
  | { phase: 'verifying' }
  | { phase: 'invalid'; error: string }
  | { phase: 'valid'; email: string; role: Role };

export function InvitationAccept() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { acceptInvitation } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<State>({ phase: 'verifying' });
  const [fullName, setFullName] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Vérification du lien d'invitation au chargement
  useEffect(() => {
    if (!token) {
      setState({ phase: 'invalid', error: "Lien d'invitation incomplet." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ email: string; role: Role }>(
          `/invitations/verify?token=${encodeURIComponent(token)}`,
        );
        if (!cancelled) setState({ phase: 'valid', email: res.email, role: res.role });
      } catch (e) {
        if (!cancelled) {
          setState({
            phase: 'invalid',
            error: e instanceof ApiError ? e.message : 'Lien invalide ou injoignable.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (state.phase !== 'valid') return;
    setErr(null);
    setBusy(true);
    const res = await acceptInvitation(token, pseudo.trim(), fullName.trim(), password);
    setBusy(false);
    if (res.ok) navigate('/pilotage', { replace: true });
    else setErr(res.error ?? 'Création du compte impossible');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-alt dark:bg-night-bg p-6">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center mb-8">
          <SilverlitLogo />
        </div>

        {state.phase === 'verifying' && (
          <div className="bg-white dark:bg-night-surface border border-hair hairline rounded-2xl p-10 text-center">
            <div className="w-6 h-6 mx-auto rounded-full border-2 border-surface-line dark:border-night-line border-t-silverlit-red animate-spin" />
            <p className="text-xs text-ink-muted dark:text-night-muted mt-3">
              Vérification de l'invitation…
            </p>
          </div>
        )}

        {state.phase === 'invalid' && (
          <div className="bg-white dark:bg-night-surface border border-hair hairline rounded-2xl p-8 text-center">
            <AlertCircle size={32} className="text-brand-red mx-auto mb-3" strokeWidth={1.6} />
            <h1 className="text-[17px] font-medium tracking-tightish text-ink dark:text-night-ink">
              Invitation non valide
            </h1>
            <p className="text-sm text-ink-muted dark:text-night-muted mt-2">{state.error}</p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-silverlit-red hover:underline"
            >
              <ArrowLeft size={11} /> Aller à la connexion
            </Link>
          </div>
        )}

        {state.phase === 'valid' && (
          <div className="bg-white dark:bg-night-surface border border-hair hairline rounded-2xl p-7">
            <h1 className="text-[20px] font-medium tracking-tightish text-ink dark:text-night-ink">
              Créez votre compte
            </h1>
            <p className="text-xs text-ink-muted dark:text-night-muted mt-1.5">
              Invitation pour <span className="text-ink dark:text-night-ink">{state.email}</span> —
              rôle <span className="text-ink dark:text-night-ink">{ROLE_LABELS[state.role]}</span>.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-3">
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                  Nom complet
                </label>
                <input
                  type="text"
                  autoFocus
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Marie Dubois"
                  className="w-full h-10 px-3 border border-hair hairline rounded-lg bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red placeholder:text-ink-muted"
                />
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                  Identifiant de connexion
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  placeholder="marie.dubois"
                  className="w-full h-10 px-3 border border-hair hairline rounded-lg bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red placeholder:text-ink-muted"
                />
                <p className="text-2xs text-ink-muted mt-1">Lettres, chiffres, point, tiret — 3 caractères min.</p>
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8 caractères minimum"
                    className="w-full h-10 px-3 pr-10 border border-hair hairline rounded-lg bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red placeholder:text-ink-muted"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink dark:hover:text-night-ink p-1"
                    aria-label="Afficher / masquer"
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {err && (
                <div className="text-xs text-brand-red bg-brand-red/10 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !fullName.trim() || pseudo.trim().length < 3 || password.length < 8}
                className="w-full h-10 rounded-lg bg-silverlit-red hover:bg-silverlit-red-deep text-white text-sm font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2 transition-colors"
              >
                <UserPlus size={14} />
                {busy ? 'Création…' : 'Créer mon compte'}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-hair hairline text-center">
              <Link to="/login" className="text-xs text-ink-muted hover:text-ink dark:hover:text-night-ink inline-flex items-center gap-1.5">
                <ArrowLeft size={11} /> J'ai déjà un compte
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
