/**
 * Small flat illustrations drawn in code for the phone mockups. They use the brand palette through CSS variables,
 * carry no text and are decorative, so they are hidden from assistive technology.
 */

/** A "photo" sent in a chat: a danfo at the roadside with a few people gisting beside it. */
export function StreetPhoto({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 220"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="320" height="220" fill="var(--color-yellow-100)" />
      <circle cx="262" cy="52" r="26" fill="var(--color-yellow-400)" />
      <path d="M0 150 H320 V220 H0 Z" fill="var(--color-ink-700)" />
      <path
        d="M0 150 H320"
        stroke="var(--color-yellow-400)"
        strokeWidth="3"
        strokeDasharray="22 14"
      />
      <rect x="12" y="84" width="46" height="66" fill="var(--color-green-700)" />
      <rect x="62" y="104" width="34" height="46" fill="var(--color-green-600)" />
      <rect x="200" y="92" width="40" height="58" fill="var(--color-green-700)" />
      {/* the danfo */}
      <rect x="86" y="108" width="150" height="62" rx="10" fill="var(--color-yellow-400)" />
      <rect x="86" y="132" width="150" height="10" fill="var(--color-ink-950)" />
      <rect x="96" y="114" width="30" height="16" rx="3" fill="var(--color-green-100)" />
      <rect x="132" y="114" width="30" height="16" rx="3" fill="var(--color-green-100)" />
      <rect x="168" y="114" width="30" height="16" rx="3" fill="var(--color-green-100)" />
      <rect x="204" y="114" width="26" height="16" rx="3" fill="var(--color-green-100)" />
      <circle cx="118" cy="172" r="13" fill="var(--color-ink-950)" />
      <circle cx="118" cy="172" r="5" fill="var(--color-ink-200)" />
      <circle cx="208" cy="172" r="13" fill="var(--color-ink-950)" />
      <circle cx="208" cy="172" r="5" fill="var(--color-ink-200)" />
      {/* people beside it */}
      <circle cx="40" cy="146" r="9" fill="var(--color-skin-3)" />
      <rect x="31" y="156" width="18" height="30" rx="8" fill="var(--color-green-600)" />
      <circle cx="68" cy="150" r="9" fill="var(--color-skin-2)" />
      <rect x="59" y="160" width="18" height="26" rx="8" fill="var(--color-ink-950)" />
      <circle cx="270" cy="144" r="9" fill="var(--color-skin-2)" />
      <rect x="261" y="154" width="18" height="32" rx="8" fill="var(--color-yellow-400)" />
    </svg>
  );
}

/** The wall behind a person on a video call: a lit room with a window, a shelf and a lamp. */
export function LitRoom({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 360 640"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="360" height="640" fill="var(--color-yellow-100)" />
      <rect x="0" y="470" width="360" height="170" fill="var(--color-green-600)" />
      <rect x="226" y="70" width="104" height="150" rx="6" fill="var(--color-ink-950)" />
      <rect x="234" y="78" width="88" height="134" rx="3" fill="var(--color-ink-700)" />
      <circle cx="290" cy="116" r="14" fill="var(--color-yellow-100)" />
      <rect x="30" y="180" width="130" height="10" rx="3" fill="var(--color-green-700)" />
      <rect x="40" y="146" width="20" height="34" rx="3" fill="var(--color-green-600)" />
      <rect x="66" y="156" width="16" height="24" rx="3" fill="var(--color-yellow-100)" />
      <rect x="90" y="140" width="24" height="40" rx="3" fill="var(--color-ink-950)" />
      <rect x="118" y="152" width="20" height="28" rx="3" fill="var(--color-yellow-400)" />
      {/* lamp and its light */}
      <circle cx="70" cy="330" r="120" fill="var(--color-yellow-400)" opacity="0.16" />
      <circle cx="70" cy="330" r="64" fill="var(--color-yellow-400)" opacity="0.2" />
      <rect x="66" y="330" width="8" height="120" fill="var(--color-ink-950)" />
      <path d="M44 336 L96 336 L84 296 L56 296 Z" fill="var(--color-yellow-100)" />
      {/* plant */}
      <rect x="290" y="420" width="34" height="50" rx="6" fill="var(--color-yellow-400)" />
      <path
        d="M307 420 C282 380 288 350 300 332 C306 360 316 376 307 420 Z"
        fill="var(--color-green-100)"
      />
      <path
        d="M307 420 C334 390 330 360 318 340 C312 366 304 384 307 420 Z"
        fill="var(--color-green-100)"
      />
    </svg>
  );
}

/** A small football match scene, used as a second "photo" in the media grid. */
export function PitchPhoto({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 220"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="320" height="220" fill="var(--color-green-600)" />
      <rect x="0" y="0" width="320" height="70" fill="var(--color-green-100)" />
      <path d="M0 70 H320" stroke="white" strokeWidth="3" />
      <circle cx="160" cy="146" r="38" fill="none" stroke="white" strokeWidth="3" />
      <circle cx="160" cy="146" r="40" fill="none" stroke="none" />
      <circle cx="216" cy="120" r="12" fill="white" />
      <path d="M216 108 L222 118 L216 128 L210 118 Z" fill="var(--color-ink-950)" />
      <circle cx="104" cy="118" r="10" fill="var(--color-skin-2)" />
      <rect x="95" y="128" width="18" height="34" rx="8" fill="var(--color-yellow-400)" />
      <circle cx="252" cy="140" r="10" fill="var(--color-skin-2)" />
      <rect x="243" y="150" width="18" height="34" rx="8" fill="white" />
    </svg>
  );
}
