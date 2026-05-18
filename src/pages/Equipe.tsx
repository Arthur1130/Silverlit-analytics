import { useState, useEffect, type FormEvent } from 'react';
import {
  UserPlus, Mail, Shield, Clock, Trash2, RotateCw, X, Check,
  ShieldAlert, Users as UsersIcon, Send, Link2, Copy, Info, MailCheck,
} from 'lucide-react';
import { useAuth, ROLE_LABELS, initialsOf, type Role } from '../context/AuthContext';
import { Card, KPICard, SectionHeader, Badge, Empty } from '../components/ui';
import { formatRelativeDate, classNames } from '../utils/format';

const ROLE_OPTIONS: Role[] = ['admin', 'analyste', 'distributeur', 'invite'];

function roleTone(r: Role): 'danger' | 'info' | 'warn' | 'neutral' {
  return r === 'admin' ? 'danger' : r === 'analyste' ? 'info' : r === 'distributeur' ? 'warn' : 'neutral';
}

// Construit un lien mailto: pré-rempli — ouvre la messagerie de l'admin avec
// l'email d'invitation prêt à envoyer (aucun serveur requis, aucun coût).
function buildMailto(email: string, role: Role, link: string, inviterName: string): string {
  const subject = 'Votre invitation à Silverlit Analytics';
  const body = [
    'Bonjour,',
    '',
    `Vous êtes invité·e à rejoindre la plateforme Silverlit Analytics avec le rôle « ${ROLE_LABELS[role]} ».`,
    '',
    'Créez votre compte via ce lien personnel (valable 5 jours, à usage unique) :',
    link,
    '',
    '—',
    inviterName,
    'Silverlit Analytics',
  ].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function Equipe() {
  const {
    user, isAdmin, backendMode, users, invitations, demandes, teamLoaded, refreshTeam,
    inviteUser, cancelInvitation, resendInvitation, updateUserRole, removeUser,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('analyste');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Résultat de la dernière invitation : email envoyé OU lien à partager
  const [lastInvite, setLastInvite] = useState<
    { email: string; emailSent: boolean; link?: string } | null
  >(null);
  const [copied, setCopied] = useState(false);

  const isLocal = backendMode === 'local';

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papier indisponible */
    }
  }

  // Chargement des données d'équipe à l'arrivée sur la page (admin)
  useEffect(() => {
    if (isAdmin) void refreshTeam();
  }, [isAdmin, refreshTeam]);

  // Page réservée aux administrateurs
  if (!isAdmin) {
    return (
      <div className="max-w-[1320px] mx-auto">
        <Card className="text-center py-16">
          <ShieldAlert size={32} className="text-ink-muted mx-auto mb-3" />
          <p className="text-[15px] font-medium tracking-tightish text-ink dark:text-night-ink">
            Accès réservé aux administrateurs
          </p>
          <p className="text-sm text-ink-muted dark:text-night-muted mt-1.5">
            La gestion de l'équipe et des accès nécessite le rôle Administrateur.
          </p>
        </Card>
      </div>
    );
  }

  const invitationsActives = invitations.filter((i) => i.status === 'envoyee');
  const demandesEnAttente = demandes.filter((d) => d.statut === 'en_attente');
  const nbAdmins = users.filter((u) => u.role === 'admin').length;

  const inviterName = (id: string | null) =>
    users.find((u) => u.id === id)?.fullName ?? 'un administrateur';

  function openInMailClient(toEmail: string, toRole: Role, link: string) {
    window.location.href = buildMailto(
      toEmail, toRole, link, user?.fullName ?? "L'équipe Silverlit",
    );
  }

  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastInvite(null);
    setCopied(false);
    const target = email.trim();
    const targetRole = role;
    const res = await inviteUser(target, targetRole);
    setBusy(false);
    if (res.ok) {
      setLastInvite({ email: target, emailSent: !!res.emailSent, link: res.link });
      setEmail('');
      // Mode local : on ouvre directement la messagerie avec l'email pré-rempli
      // → l'invité reçoit un vrai email, sans serveur ni service tiers.
      if (!res.emailSent && res.link) {
        openInMailClient(target, targetRole, res.link);
      }
    } else {
      setError(res.error ?? 'Erreur inconnue');
    }
  }

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-medium tracking-tighter2 text-ink dark:text-night-ink">
          Équipe &amp; accès
        </h1>
        <p className="text-sm text-ink-muted dark:text-night-muted mt-1">
          Gestion des utilisateurs, des rôles et des invitations
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Utilisateurs actifs" value={String(users.length)} icon={<UsersIcon size={14} />} />
        <KPICard label="Administrateurs" value={String(nbAdmins)} icon={<Shield size={14} />} deltaLabel="accès complet" />
        <KPICard
          label="Invitations en attente"
          value={String(invitationsActives.length)}
          icon={<Mail size={14} />}
          intent={invitationsActives.length > 0 ? 'warn' : 'default'}
        />
        <KPICard
          label="Demandes d'accès"
          value={String(demandesEnAttente.length)}
          icon={<Clock size={14} />}
          intent={demandesEnAttente.length > 0 ? 'warn' : 'default'}
          deltaLabel="à traiter"
        />
      </div>

      {/* Inviter un utilisateur */}
      <Card className="mb-6">
        <SectionHeader
          title="Inviter un utilisateur"
          subtitle={
            isLocal
              ? 'Votre messagerie s’ouvre avec l’invitation pré-rédigée — vous n’avez qu’à cliquer Envoyer'
              : "Saisissez l'email et le rôle — un email d'invitation est envoyé automatiquement"
          }
        />

        {/* Bandeau explicatif en mode local */}
        {isLocal && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-surface-alt dark:bg-night-alt px-3 py-2.5">
            <Info size={14} className="text-ink-muted shrink-0 mt-0.5" />
            <p className="text-2xs text-ink-subtle dark:text-night-muted leading-relaxed">
              Le serveur n'étant pas lancé, l'envoi passe par <strong>votre propre messagerie</strong> :
              en cliquant « Inviter », votre client mail s'ouvre avec l'email d'invitation déjà rédigé
              (destinataire, objet, lien) — il ne vous reste qu'à <strong>cliquer Envoyer</strong>.
              L'invité reçoit alors un vrai email. Le lien reste aussi copiable ci-dessous.
            </p>
          </div>
        )}

        <form onSubmit={submitInvite} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
              Email professionnel
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="prenom.nom@silverlit.fr"
              className="w-full h-10 px-3 border border-hair hairline rounded-lg bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red placeholder:text-ink-muted"
            />
          </div>
          <div className="w-[220px]">
            <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
              Rôle attribué
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full h-10 px-3 border border-hair hairline rounded-lg bg-white dark:bg-night-surface text-sm text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!email.trim() || busy}
            className="h-10 px-4 rounded-lg bg-silverlit-red hover:bg-silverlit-red-deep text-white text-sm font-medium disabled:opacity-40 inline-flex items-center gap-2 transition-colors"
          >
            <Send size={14} />
            {busy ? 'Envoi…' : 'Inviter'}
          </button>
        </form>

        {/* Erreur */}
        {error && (
          <div className="mt-3 text-xs rounded-lg px-3 py-2 flex items-start gap-2 bg-brand-red/10 text-brand-red">
            <X size={13} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Succès — email envoyé */}
        {lastInvite?.emailSent && (
          <div className="mt-3 text-xs rounded-lg px-3 py-2.5 flex items-start gap-2 bg-brand-green/10 text-brand-green">
            <MailCheck size={14} className="shrink-0 mt-0.5" />
            <span>
              Email d'invitation envoyé à <strong>{lastInvite.email}</strong>.
            </span>
          </div>
        )}

        {/* Succès — invitation créée, messagerie ouverte (mode local) */}
        {lastInvite && !lastInvite.emailSent && lastInvite.link && (
          <div className="mt-3 rounded-xl border border-hair hairline overflow-hidden">
            <div className="px-3 py-2 bg-brand-green/10 flex items-center gap-2">
              <MailCheck size={14} className="text-brand-green shrink-0" />
              <p className="text-xs text-brand-green">
                Invitation créée pour <strong>{lastInvite.email}</strong> — votre messagerie devrait
                s'être ouverte.
              </p>
            </div>
            <div className="px-3 py-3">
              <p className="text-2xs text-ink-muted dark:text-night-muted mb-2">
                Dans votre client mail, vérifiez le message et cliquez <strong>Envoyer</strong> —
                l'invité recevra l'email. Si la messagerie ne s'est pas ouverte, utilisez les boutons
                ci-dessous (lien valable 5 jours, à usage unique) :
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="flex-1 min-w-[160px] text-2xs tabular bg-surface-alt dark:bg-night-alt rounded-lg px-2.5 py-2 text-ink dark:text-night-ink truncate">
                  {lastInvite.link}
                </code>
                <button
                  onClick={() => openInMailClient(lastInvite.email, role, lastInvite.link!)}
                  className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-silverlit-red hover:bg-silverlit-red-deep text-white transition-colors"
                >
                  <Mail size={13} /> Ouvrir dans ma messagerie
                </button>
                <button
                  onClick={() => copyLink(lastInvite.link!)}
                  className={classNames(
                    'shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium transition-colors',
                    copied
                      ? 'bg-brand-green text-white'
                      : 'border border-hair hairline text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt',
                  )}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copié' : 'Copier le lien'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Invitations */}
      {invitations.length > 0 && (
        <Card padded={false} className="mb-6">
          <div className="px-5 py-3 border-b border-hair hairline">
            <SectionHeader
              title="Invitations"
              subtitle={`${invitationsActives.length} en attente · ${invitations.length} au total`}
            />
          </div>
          <ul>
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="px-5 py-3 border-b border-hair hairline last:border-b-0 flex items-center gap-3 flex-wrap"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-alt dark:bg-night-alt flex items-center justify-center shrink-0">
                  <Mail size={14} className="text-ink-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-ink dark:text-night-ink truncate">{inv.email}</p>
                  <p className="text-2xs text-ink-muted">
                    envoyée {formatRelativeDate(inv.createdAt)} · par {inviterName(inv.invitedBy)}
                  </p>
                </div>
                <Badge tone={roleTone(inv.role)}>{ROLE_LABELS[inv.role]}</Badge>
                <Badge
                  tone={
                    inv.status === 'envoyee' ? 'warn'
                    : inv.status === 'acceptee' ? 'success'
                    : 'neutral'
                  }
                >
                  {inv.status === 'envoyee' ? 'En attente'
                    : inv.status === 'acceptee' ? 'Acceptée'
                    : inv.status === 'expiree' ? 'Expirée' : 'Annulée'}
                </Badge>
                {inv.status === 'envoyee' ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void resendInvitation(inv.id)}
                      title="Renvoyer l'email"
                      className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:bg-surface-alt dark:hover:bg-night-alt"
                    >
                      <RotateCw size={13} />
                    </button>
                    <button
                      onClick={() => void cancelInvitation(inv.id)}
                      title="Annuler"
                      className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-brand-red hover:bg-surface-alt dark:hover:bg-night-alt"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (inv.status === 'annulee' || inv.status === 'expiree') ? (
                  <button
                    onClick={() => void resendInvitation(inv.id)}
                    className="text-2xs text-silverlit-red hover:underline inline-flex items-center gap-1"
                  >
                    <Link2 size={11} /> Relancer
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Utilisateurs actifs */}
      <Card padded={false} className="mb-6">
        <div className="px-5 py-3 border-b border-hair hairline flex items-center gap-2">
          <UsersIcon size={14} className="text-ink-muted" />
          <h2 className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink">
            Utilisateurs actifs
          </h2>
          <Badge>{users.length}</Badge>
        </div>
        {!teamLoaded ? (
          <div className="px-5 py-10 text-center text-xs text-ink-muted">Chargement…</div>
        ) : users.length === 0 ? (
          <Empty title="Aucun utilisateur" hint="Le serveur n'a renvoyé aucun compte." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hair hairline">
                  <th className="text-left px-5 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Utilisateur</th>
                  <th className="text-left px-4 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Email</th>
                  <th className="text-left px-4 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Rôle</th>
                  <th className="text-left px-4 py-2.5 text-2xs uppercase tracking-wider text-ink-muted font-normal">Dernière connexion</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-hair hairline last:border-b-0 hover:bg-surface-alt/50 dark:hover:bg-night-alt/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-surface-alt dark:bg-night-alt flex items-center justify-center text-2xs font-medium text-ink dark:text-night-ink shrink-0">
                          {initialsOf(u.fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] text-ink dark:text-night-ink truncate">
                            {u.fullName}
                            {u.id === user?.id && (
                              <span className="text-2xs text-ink-muted ml-1.5">(vous)</span>
                            )}
                          </p>
                          <p className="text-2xs text-ink-muted tabular">{u.pseudo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink-muted">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => void updateUserRole(u.id, e.target.value as Role)}
                        className="text-xs bg-white dark:bg-night-surface border border-hair hairline rounded-md px-2 h-7 text-ink dark:text-night-ink focus:outline-none focus:border-silverlit-red"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-2xs text-ink-muted tabular">
                      {u.lastLogin ? formatRelativeDate(u.lastLogin) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={async () => {
                          if (!confirm(`Supprimer le compte de ${u.fullName} ?`)) return;
                          const res = await removeUser(u.id);
                          if (!res.ok) alert(res.error);
                        }}
                        disabled={u.id === user?.id}
                        title={u.id === user?.id ? 'Vous ne pouvez pas vous supprimer' : 'Supprimer l\'utilisateur'}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-brand-red hover:bg-surface-alt dark:hover:bg-night-alt disabled:opacity-30 disabled:hover:text-ink-muted disabled:hover:bg-transparent"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Demandes d'accès reçues */}
      <Card padded={false}>
        <div className="px-5 py-3 border-b border-hair hairline flex items-center gap-2">
          <UserPlus size={14} className="text-ink-muted" />
          <h2 className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink">
            Demandes d'accès reçues
          </h2>
          <Badge tone={demandesEnAttente.length > 0 ? 'warn' : 'neutral'}>
            {demandesEnAttente.length} en attente
          </Badge>
        </div>
        {demandes.length === 0 ? (
          <Empty
            title="Aucune demande d'accès"
            hint="Les demandes soumises depuis la page de connexion apparaîtront ici."
          />
        ) : (
          <ul>
            {demandes.map((d) => (
              <li key={d.id} className="px-5 py-3 border-b border-hair hairline last:border-b-0 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-alt dark:bg-night-alt flex items-center justify-center text-2xs font-medium text-ink dark:text-night-ink shrink-0">
                  {initialsOf(d.nom)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] text-ink dark:text-night-ink font-medium tracking-tightish">{d.nom}</p>
                    <span className="text-xs text-ink-muted">{d.email}</span>
                    {d.entreprise && <Badge>{d.entreprise}</Badge>}
                  </div>
                  {d.motif && <p className="text-xs text-ink-muted mt-1">{d.motif}</p>}
                  <p className="text-2xs text-ink-muted mt-1.5 tabular">
                    {formatRelativeDate(d.date)}
                  </p>
                </div>
                <Badge tone={d.statut === 'en_attente' ? 'warn' : d.statut === 'acceptee' ? 'success' : 'danger'}>
                  {d.statut === 'en_attente' ? 'En attente' : d.statut === 'acceptee' ? 'Acceptée' : 'Refusée'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
