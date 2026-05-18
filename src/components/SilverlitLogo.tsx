import { useState } from 'react';

// Logo Silverlit. On affiche l'image officielle (`/silverlit-logo.png`)
// déposée dans /public. En cas d'erreur de chargement (fichier pas encore
// déposé), on retombe sur un rendu texte minimaliste.

interface Props {
  size?: 'sm' | 'md' | 'lg';
  showSuffix?: boolean;
  className?: string;
}

export function SilverlitLogo({ size = 'md', showSuffix = true, className }: Props) {
  const [errored, setErrored] = useState(false);
  const h = size === 'sm' ? 20 : size === 'lg' ? 36 : 26;
  const suffixCls = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-[12px]' : 'text-[10px]';

  return (
    <div className={['flex items-center gap-2.5 select-none', className].filter(Boolean).join(' ')}>
      {!errored ? (
        <img
          src="/silverlit-logo.png"
          alt="Silverlit"
          height={h}
          style={{ height: h, width: 'auto' }}
          onError={() => setErrored(true)}
          className="shrink-0 dark:invert dark:brightness-100 dark:contrast-100"
          draggable={false}
        />
      ) : (
        <span
          className="text-ink dark:text-night-ink leading-none font-medium tracking-tighter3 shrink-0"
          style={{ fontSize: h * 0.85 }}
        >
          silverlit
          <span className="text-silverlit-red">.</span>
        </span>
      )}
      {showSuffix && (
        <span
          className={`uppercase tracking-[0.18em] text-ink-muted dark:text-night-muted leading-none ${suffixCls}`}
        >
          Analytics
        </span>
      )}
    </div>
  );
}
