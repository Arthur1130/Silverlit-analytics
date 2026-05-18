export function weekLabel(annee: number, semaine: number): string {
  return `S${String(semaine).padStart(2, '0')} · ${annee}`;
}

export function weekShort(_annee: number, semaine: number): string {
  return `S${String(semaine).padStart(2, '0')}`;
}

export function dateFromWeek(annee: number, semaine: number): Date {
  const simple = new Date(annee, 0, 1 + (semaine - 1) * 7);
  const day = simple.getDay();
  const diff = day <= 4 ? simple.getDate() - day + 1 : simple.getDate() + 8 - day;
  simple.setDate(diff);
  return simple;
}

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.round(diffMs / 36e5);
  if (diffH < 1) return 'À l’instant';
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'Hier';
  if (diffD < 7) return `Il y a ${diffD} jours`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
}

export function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

// Retourne une version courte du nom d'un distributeur pour l'affichage
// dans les axes de graphiques (espace contraint).
// Ex: "Récréa Club / La Grande Récré" → "La Grande Récré"
//     "GALEC / E.Leclerc" → "E.Leclerc"
export function shortDistribName(nom: string, max = 22): string {
  let s = nom;
  if (s.includes(' / ')) s = s.split(' / ').pop()?.trim() ?? s;
  if (s.length > max) s = s.slice(0, max - 1) + '…';
  return s;
}

// Tronque un libellé si trop long
export function truncate(s: string, max = 30): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
