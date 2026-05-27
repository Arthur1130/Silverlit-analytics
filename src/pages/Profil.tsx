import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Shield, User, Mail, Clock, Users, ArrowRight } from 'lucide-react';
import { useAuth, ROLE_LABELS, initialsOf } from '../context/AuthContext';
import { Card, KPICard, Badge } from '../components/ui';
import { formatRelativeDate } from '../utils/format';
import { useApp } from '../context/AppContext';

export function Profil() {
  const { user, signOut, isAdmin } = useAuth();
  const { alertes } = useApp();
  const navigate = useNavigate();

  if (!user) return null;

  const ouvertes = alertes.filter((a) => a.statut === 'ouverte').length;
  const traitees = alertes.filter((a) => a.statut === 'traitee').length;

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
          Profil
        </h1>
        <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
          Compte utilisateur · paramètres et activité
        </p>
      </div>

      <Card className="mb-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-2xl bg-surface-alt dark:bg-night-alt flex items-center justify-center text-[22px] font-medium tracking-tightish text-ink dark:text-night-ink">
            {initialsOf(user.fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-medium tracking-tightish text-ink dark:text-night-ink">
              {user.fullName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-ink-muted dark:text-night-muted inline-flex items-center gap-1">
                <User size={12} /> {user.pseudo}
              </span>
              <span className="text-ink-muted dark:text-night-muted inline-flex items-center gap-1">
                <Mail size={12} /> {user.email}
              </span>
              <Badge tone="info">
                <Shield size={10} className="inline mr-0.5" />
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
            <p className="text-2xs text-ink-muted mt-2 inline-flex items-center gap-1">
              <Clock size={11} />
              {user.lastLogin
                ? `Dernière connexion · ${formatRelativeDate(user.lastLogin)}`
                : 'Première session'}
            </p>
          </div>
          <button
            onClick={() => {
              signOut();
              navigate('/login', { replace: true });
            }}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-hair hairline text-sm text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt"
          >
            <LogOut size={14} />
            Se déconnecter
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KPICard label="Alertes ouvertes" value={String(ouvertes)} deltaLabel="à traiter" intent={ouvertes > 5 ? 'warn' : 'default'} />
        <KPICard label="Alertes traitées" value={String(traitees)} deltaLabel="archivées" intent="success" />
        <KPICard label="Compte créé" value={new Date(user.createdAt).toLocaleDateString('fr-FR')} deltaLabel="ouverture du compte" />
      </div>

      {isAdmin && (
        <Card className="hover:border-silverlit-red/30 transition-colors">
          <Link to="/parametres" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-surface-alt dark:bg-night-alt flex items-center justify-center shrink-0">
              <Users size={16} className="text-ink-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium tracking-tightish text-ink dark:text-night-ink">
                Gestion de l'équipe &amp; des accès
              </p>
              <p className="text-xs text-ink-muted dark:text-night-muted mt-0.5">
                Utilisateurs, rôles, invitations et demandes d'accès — accessible via Paramètres &gt; Équipe.
              </p>
            </div>
            <ArrowRight size={16} className="text-ink-muted group-hover:text-silverlit-red transition-colors shrink-0" />
          </Link>
        </Card>
      )}
    </div>
  );
}
