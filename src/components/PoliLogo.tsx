import type { SVGProps } from 'react';

// Petite voiture-robot stylisée façon Robocar Poli, en monochrome (avec un
// léger accent bleu Apple) pour rester cohérent avec la charte du dashboard.
export function PoliLogo({ size = 24, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      {...props}
    >
      {/* corps de la voiture */}
      <rect x="6" y="22" width="36" height="16" rx="6" fill="currentColor" opacity="0.95" />
      {/* cabine */}
      <path
        d="M14 22 L18 12 H30 L34 22 Z"
        fill="currentColor"
        opacity="0.95"
      />
      {/* pare-brise / visage */}
      <rect x="17" y="14" width="14" height="8" rx="3" fill="#ffffff" />
      {/* yeux */}
      <circle cx="22" cy="18" r="1.6" fill="#1d1d1f" />
      <circle cx="28" cy="18" r="1.6" fill="#1d1d1f" />
      <circle cx="22.5" cy="17.5" r="0.5" fill="#ffffff" />
      <circle cx="28.5" cy="17.5" r="0.5" fill="#ffffff" />
      {/* sourire */}
      <path
        d="M21 21 Q24 22.5 27 21"
        stroke="#1d1d1f"
        strokeWidth="0.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* gyrophare */}
      <rect x="22" y="9" width="4" height="3" rx="1" fill="#007aff" />
      {/* roues */}
      <circle cx="15" cy="38" r="4" fill="#1d1d1f" />
      <circle cx="33" cy="38" r="4" fill="#1d1d1f" />
      <circle cx="15" cy="38" r="1.6" fill="#ffffff" />
      <circle cx="33" cy="38" r="1.6" fill="#ffffff" />
    </svg>
  );
}
