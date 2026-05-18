// Pied de page discipliné — bandeau fin, encadré par une hairline.
// Mention de périmètre / confidentialité uniquement. La signature du cabinet
// est portée par la barre de navigation (haut de page), pas ici.

export function Footer() {
  return (
    <footer className="border-t border-hair hairline bg-white dark:bg-night-bg">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4">
        <p className="text-2xs text-ink-muted dark:text-night-muted truncate">
          Silverlit Analytics · Plateforme de pilotage des ventes
        </p>
        <p className="text-2xs text-ink-muted dark:text-night-muted shrink-0">
          Usage interne confidentiel
        </p>
      </div>
    </footer>
  );
}
