import { useState } from 'react';
import { Link } from 'react-router-dom';

// =======================================================================
//   ANIZIA — Marque
// =======================================================================
//
// Composant unique pour TOUT affichage de la marque ANIZIA dans l'app.
// Pensé comme un asset de marque : clear space respecté, alignement
// pixel-perfect, focus accessible, fallback typographique soigné.
//
// Trois variantes :
//   - `wordmark` (défaut) : pour la nav. Logo + nom seulement.
//   - `full`              : pour les pages d'accueil / login. Logo + nom + tagline.
//   - `icon`              : pour les contextes très contraints (favicon, etc.).
//
// Le PNG officiel est chargé depuis `/public/anizia-logo.png`. Si absent,
// on retombe sur un rendu **typographique de qualité** (Inter semi-bold,
// kerning défini, couleurs exactes du logo) — ainsi l'app garde un rendu
// professionnel même sans l'asset, et l'image peut être déposée plus tard
// sans risque.
//
// Couleurs officielles :
//   - ANIZ : #1d1d1f (ink)
//   - IA  : #2266dd (anizia-blue)

interface Props {
  variant?: 'wordmark' | 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Désactive le wrapping en <Link> (utile sur pages auth). */
  asLink?: boolean;
  /** Force le rendu typographique (pas d'image). Utile pour debug ou
   *  contextes où l'image n'a aucun sens (impression mono). */
  textOnly?: boolean;
}

const ANIZIA_BLUE = '#2266dd';

// Hauteurs pixel-perfect par variante × taille
const HEIGHTS: Record<NonNullable<Props['variant']>, Record<NonNullable<Props['size']>, number>> = {
  wordmark: { sm: 18, md: 24, lg: 32, xl: 40 },
  full:     { sm: 36, md: 52, lg: 68, xl: 88 },
  icon:     { sm: 16, md: 20, lg: 28, xl: 36 },
};

export function AniziaBrand({
  variant = 'wordmark',
  size = 'md',
  className,
  asLink = true,
  textOnly = false,
}: Props) {
  const [errored, setErrored] = useState(false);
  const h = HEIGHTS[variant][size];

  const showImage = !errored && !textOnly;

  const content = showImage ? (
    <ImageMark variant={variant} height={h} onError={() => setErrored(true)} />
  ) : (
    <TextMark variant={variant} height={h} />
  );

  const baseCls = [
    'inline-flex items-center select-none',
    // Clear space minimal = h/8 horizontal (norme branding standard)
    // matérialisé par une zone cliquable plus grande que le glyph
    'py-1 -my-1',
    asLink
      ? 'rounded-md transition-all hover:bg-surface-alt/60 dark:hover:bg-night-alt/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-anizia/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-night-bg'
      : '',
    className,
  ].filter(Boolean).join(' ');

  if (!asLink) {
    return <span className={baseCls}>{content}</span>;
  }

  return (
    <Link
      to="/pilotage"
      className={`${baseCls} px-1.5 -mx-1.5`}
      aria-label="ANIZIA — retour à l'accueil"
    >
      {content}
    </Link>
  );
}

// =======================================================================
//   Sous-composants — version image
// =======================================================================

function ImageMark({
  variant, height, onError,
}: {
  variant: NonNullable<Props['variant']>;
  height: number;
  onError: () => void;
}) {
  // Pour la variante 'full', le PNG fait déjà icône + texte + tagline.
  // Pour 'wordmark' et 'icon', on utilise le même asset mais cadré différemment
  // (CSS object-fit). À terme on aura des assets séparés.
  const src = '/anizia-logo.png';
  return (
    <img
      src={src}
      alt="ANIZIA"
      height={height}
      style={{ height, width: 'auto' }}
      onError={onError}
      className="shrink-0 dark:brightness-110"
      draggable={false}
      decoding="async"
      // Pour éviter le layout shift au chargement
      width={Math.round(height * (variant === 'full' ? 4.5 : variant === 'icon' ? 1 : 3.2))}
    />
  );
}

// =======================================================================
//   Sous-composants — fallback typographique
// =======================================================================
//
// Recreate le wordmark avec un type-system soigné. Lisible, balanced,
// reconnaissable. Pas un placeholder pourri.

function TextMark({
  variant, height,
}: {
  variant: NonNullable<Props['variant']>;
  height: number;
}) {
  // Hauteur du wordmark = ~70% de la hauteur réservée
  const fontSize = Math.round(height * 0.72);
  const taglineSize = Math.max(8, Math.round(height * 0.13));

  if (variant === 'icon') {
    return <IconGlyph size={height} />;
  }

  return (
    <span className="inline-flex items-center gap-2.5">
      <IconGlyph size={Math.round(height * 0.95)} />

      <span className="inline-flex flex-col items-start leading-none">
        <span
          className="font-semibold tracking-tight leading-none"
          style={{
            fontSize,
            // letter-spacing un peu plus serré pour rappeler le type custom du logo
            letterSpacing: '-0.02em',
            // Optical alignment : on remonte légèrement pour aligner avec l'icône
            transform: 'translateY(-1px)',
          }}
        >
          <span className="text-ink dark:text-night-ink">ANIZ</span>
          <span style={{ color: ANIZIA_BLUE }}>ia</span>
        </span>

        {variant === 'full' && (
          <span
            className="text-ink-muted dark:text-night-muted uppercase font-medium leading-none mt-2"
            style={{
              fontSize: taglineSize,
              letterSpacing: '0.18em',
            }}
          >
            Conseil&nbsp;&nbsp;·&nbsp;&nbsp;Transformation digitale&nbsp;&nbsp;·&nbsp;&nbsp;IA Data
          </span>
        )}
      </span>
    </span>
  );
}

// Icône fallback : une "A" stylisée pour rappeler le glyphe du logo officiel
// (triangle ouvert avec un trait). Pas un clone parfait, mais propre et
// reconnaissable comme variante typographique.
function IconGlyph({ size }: { size: number }) {
  const stroke = Math.max(1.4, size * 0.07);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className="shrink-0 text-ink dark:text-night-ink"
      aria-hidden="true"
    >
      {/* Triangle ouvert pointant vers le haut, comme un "A" minimaliste */}
      <path
        d="M16 5 L27 26 L5 26 Z"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Petit trait horizontal — barre du A */}
      <path
        d="M11 20 L21 20"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  );
}
