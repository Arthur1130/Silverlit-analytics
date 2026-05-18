// Signature ANIZIA — cabinet de conseil en charge de la plateforme.
// Registre discret (monochrome, petit, encadré) MAIS le « IA » est mis en
// avant : indigo sobre + graisse renforcée. Double signal typographique,
// sans concurrencer la marque du client.

interface Props {
  /** Affiche le préfixe « Conçu et développé par » avant le mot-marque. */
  withLabel?: boolean;
  className?: string;
}

export function AniziaLogo({ withLabel = false, className }: Props) {
  return (
    <span
      title="ANIZIA — Conseil en IA & transformation digitale"
      className={['inline-flex items-baseline gap-1.5 select-none', className].filter(Boolean).join(' ')}
    >
      {withLabel && (
        <span className="text-2xs text-ink-muted dark:text-night-muted">
          Conçu &amp; développé par
        </span>
      )}
      <span className="text-[10.5px] tracking-[0.22em] leading-none">
        <span className="font-medium text-ink-subtle dark:text-night-muted">ANIZ</span>
        <span className="font-semibold text-anizia dark:text-anizia-light">IA</span>
      </span>
    </span>
  );
}
