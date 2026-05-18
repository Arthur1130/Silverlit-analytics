import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Package, Store, Bell, Image as ImageIcon, Upload, ShieldCheck,
  Users, Search, Moon, Sun, LogOut, User as UserIcon, Menu, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth, initialsOf } from '../context/AuthContext';
import { classNames } from '../utils/format';
import { CommandPalette } from './CommandPalette';
import { SilverlitLogo } from './SilverlitLogo';
import { AniziaLogo } from './AniziaLogo';

const NAV = [
  { to: '/pilotage', label: 'Pilotage', icon: LayoutGrid, adminOnly: false },
  { to: '/produits', label: 'Produits', icon: Package, adminOnly: false },
  { to: '/distributeurs', label: 'Distributeurs', icon: Store, adminOnly: false },
  { to: '/alertes', label: 'Alertes', icon: Bell, adminOnly: false },
  { to: '/infographie', label: 'Infographie', icon: ImageIcon, adminOnly: false },
  { to: '/import', label: 'Import', icon: Upload, adminOnly: false },
  { to: '/gouvernance', label: 'Gouvernance', icon: ShieldCheck, adminOnly: false },
  { to: '/equipe', label: 'Équipe', icon: Users, adminOnly: true },
];

export function TopNav() {
  const { dark, toggleDark, alertes } = useApp();
  const { user, isAdmin } = useAuth();
  const navItems = NAV.filter((item) => !item.adminOnly || isAdmin);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nbAlertes = alertes.filter((a) => a.statut === 'ouverte').length;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-night-bg/85 backdrop-blur-xl border-b border-hair hairline">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-4 max-w-[1320px] mx-auto">
          {/* Logo Silverlit — marque du client */}
          <button
            onClick={() => navigate('/pilotage')}
            className="shrink-0"
            aria-label="Accueil"
          >
            <SilverlitLogo />
          </button>

          {/* Signature cabinet — discrète, séparée du logo client par une hairline */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <span className="h-3.5 w-px bg-surface-line dark:bg-night-line" />
            <AniziaLogo />
          </div>

          {/* Hamburger mobile */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden ml-auto w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-alt dark:hover:bg-night-alt text-ink dark:text-night-ink"
            aria-label="Menu"
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          {/* Nav horizontale */}
          <nav className="hidden md:flex items-center gap-0.5 ml-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    classNames(
                      'relative flex items-center gap-1.5 px-3 h-14 text-[13px] transition-colors',
                      isActive
                        ? 'text-ink dark:text-night-ink font-medium nav-link-active'
                        : 'text-ink-muted dark:text-night-muted hover:text-ink dark:hover:text-night-ink',
                    )
                  }
                >
                  <Icon size={14} strokeWidth={1.8} />
                  {item.label}
                  {item.to === '/alertes' && nbAlertes > 0 && (
                    <span className="ml-0.5 text-2xs tabular bg-silverlit-red text-white rounded-full px-1.5 py-px min-w-[18px] text-center">
                      {nbAlertes}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-3 h-9 rounded-lg hover:bg-surface-alt dark:hover:bg-night-alt text-xs text-ink-muted dark:text-night-muted transition-colors"
              aria-label="Rechercher"
            >
              <Search size={13} />
              <span className="hidden lg:inline">Rechercher</span>
              <span className="ml-1 text-2xs tabular border border-hair hairline rounded px-1.5 py-px">
                ⌘K
              </span>
            </button>
            <button
              onClick={toggleDark}
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-alt dark:hover:bg-night-alt text-ink dark:text-night-ink transition-colors"
              aria-label="Basculer le thème"
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <UserMenu />
          </div>
        </div>

        {/* Menu mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-hair hairline animate-slide-up bg-white dark:bg-night-bg">
            <nav className="px-2 py-2 grid grid-cols-2 gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      classNames(
                        'flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px]',
                        isActive
                          ? 'bg-silverlit-red-soft text-silverlit-red font-medium'
                          : 'text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt',
                      )
                    }
                  >
                    <Icon size={14} />
                    {item.label}
                    {item.to === '/alertes' && nbAlertes > 0 && (
                      <span className="ml-auto text-2xs tabular bg-silverlit-red text-white rounded-full px-1.5 py-px">
                        {nbAlertes}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <div className="border-t border-hair hairline p-2 flex items-center gap-2">
              <button
                onClick={() => { setMenuOpen(false); setPaletteOpen(true); }}
                className="flex-1 h-9 rounded-lg bg-surface-alt dark:bg-night-alt text-xs text-ink dark:text-night-ink inline-flex items-center justify-center gap-2"
              >
                <Search size={13} /> Rechercher
              </button>
              <button
                onClick={toggleDark}
                className="w-9 h-9 rounded-lg bg-surface-alt dark:bg-night-alt inline-flex items-center justify-center"
              >
                {dark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              {user && (
                <button
                  onClick={() => { setMenuOpen(false); navigate('/profil'); }}
                  className="w-9 h-9 rounded-full bg-surface-alt dark:bg-night-alt text-2xs font-medium inline-flex items-center justify-center text-ink dark:text-night-ink"
                >
                  {initialsOf(user.fullName)}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={(href) => {
          navigate(href);
          setPaletteOpen(false);
        }}
      />
    </>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={classNames(
          'w-9 h-9 rounded-full bg-surface-alt dark:bg-night-alt flex items-center justify-center text-[11px] font-medium text-ink dark:text-night-ink transition-all',
          open && 'ring-2 ring-silverlit-red ring-offset-2 ring-offset-white dark:ring-offset-night-bg',
        )}
        aria-label="Menu utilisateur"
      >
        {initialsOf(user.fullName)}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[240px] bg-white dark:bg-night-surface border border-hair hairline rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.10)] overflow-hidden animate-slide-up">
          <div className="px-3 py-3 border-b border-hair hairline">
            <p className="text-[13px] font-medium tracking-tightish text-ink dark:text-night-ink truncate">
              {user.fullName}
            </p>
            <p className="text-2xs text-ink-muted truncate mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={() => {
              navigate('/profil');
              setOpen(false);
            }}
            className="w-full px-3 py-2 flex items-center gap-2 text-xs text-ink dark:text-night-ink hover:bg-surface-alt dark:hover:bg-night-alt transition-colors"
          >
            <UserIcon size={13} className="text-ink-muted" />
            Mon profil
          </button>
          <button
            onClick={() => {
              signOut();
              setOpen(false);
              navigate('/login', { replace: true });
            }}
            className="w-full px-3 py-2 flex items-center gap-2 text-xs text-silverlit-red hover:bg-silverlit-red-soft dark:hover:bg-night-alt transition-colors"
          >
            <LogOut size={13} />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
