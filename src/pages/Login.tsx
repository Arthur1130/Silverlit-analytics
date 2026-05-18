import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SilverlitLogo } from '../components/SilverlitLogo';

interface LocState { from?: { pathname: string } }

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const target = (loc.state as LocState)?.from?.pathname ?? '/pilotage';

  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signIn(pseudo, password);
    setLoading(false);
    if (res.ok) navigate(target, { replace: true });
    else setErr(res.error || 'Erreur inconnue');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-alt dark:bg-night-bg p-6">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center justify-center mb-8">
          <SilverlitLogo />
        </div>

        <div className="bg-white dark:bg-night-surface border border-hair hairline rounded-2xl p-7">
          <h1 className="text-[20px] font-medium tracking-tightish text-ink dark:text-night-ink">
            Connectez-vous
          </h1>
          <p className="text-xs text-ink-muted dark:text-night-muted mt-1.5">
            Accédez aux ventes consolidées des distributeurs Silverlit France.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                Identifiant
              </label>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder="prenom.nom"
                className="w-full h-10 px-3 border border-hair hairline rounded-lg bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red placeholder:text-ink-muted"
              />
            </div>
            <div>
              <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 pr-10 border border-hair hairline rounded-lg bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red placeholder:text-ink-muted"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink dark:hover:text-night-ink p-1"
                  aria-label="Afficher / masquer le mot de passe"
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
              disabled={loading || !pseudo || !password}
              className="w-full h-10 rounded-lg bg-silverlit-red hover:bg-silverlit-red-deep text-white text-sm font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn size={14} />
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-hair hairline text-center">
            <p className="text-xs text-ink-muted">
              Pas encore de compte ?{' '}
              <Link to="/demande-compte" className="text-silverlit-red hover:underline">
                Faire une demande d'accès
              </Link>
            </p>
          </div>
        </div>

        <p className="text-2xs text-ink-muted dark:text-night-muted text-center mt-4">
          Authentification sécurisée · mots de passe hachés, session signée (JWT).
        </p>
      </div>
    </div>
  );
}
