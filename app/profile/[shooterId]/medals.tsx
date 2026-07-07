// Small SVG building blocks for the medals row and gear cabinet. Kept
// separate from page.tsx since they're pure presentational fragments with
// no data-fetching concerns.

export function FeatureMedalSvg({ scoreBadge, subLabel }: { scoreBadge: string; subLabel: string }) {
  return (
    <svg viewBox="0 0 58 80">
      <defs>
        <radialGradient id="gFeature" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#E8D9AE" />
          <stop offset="100%" stopColor="#9C8552" />
        </radialGradient>
      </defs>
      <path d="M 22,40 L 13,78 L 29,67 L 22,40 Z" fill="#C7B384" opacity="0.9" />
      <path d="M 36,40 L 45,78 L 29,67 L 36,40 Z" fill="#9C8552" opacity="0.9" />
      <path d="M 4,22 Q 10,10 20,16 Q 13,20 12,30 Q 6,30 4,22 Z" fill="#C7B384" opacity="0.75" />
      <path d="M 54,22 Q 48,10 38,16 Q 45,20 46,30 Q 52,30 54,22 Z" fill="#C7B384" opacity="0.75" />
      <circle cx="29" cy="28" r="25" fill="url(#gFeature)" stroke="#262E1E" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="29" cy="28" r="19" fill="none" stroke="#262E1E" strokeOpacity="0.25" strokeWidth="1" />
      <text x="29" y="25" textAnchor="middle" fontWeight="600" fontSize="10" fill="#262E1E">
        {scoreBadge}
      </text>
      <text x="29" y="36" textAnchor="middle" fontSize="7" fill="#262E1E" opacity="0.75">
        {subLabel}
      </text>
    </svg>
  );
}

export function Tier2MedalSvg({ iconText, ribbon }: { iconText: string; ribbon: 'clay' | 'field' }) {
  const ribbonColors =
    ribbon === 'clay' ? { light: '#BD5A2C', dark: '#9C4720' } : { light: '#37402E', dark: '#262E1E' };
  const gradId = `gT2-${iconText}`;
  return (
    <svg viewBox="0 0 58 80">
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#D8CBA0" />
          <stop offset="100%" stopColor="#8A754A" />
        </radialGradient>
      </defs>
      <path d="M 22,40 L 14,76 L 29,66 L 22,40 Z" fill={ribbonColors.light} opacity="0.85" />
      <path d="M 36,40 L 44,76 L 29,66 L 36,40 Z" fill={ribbonColors.dark} opacity="0.85" />
      <circle cx="29" cy="27" r="23" fill={`url(#${gradId})`} stroke="#262E1E" strokeOpacity="0.3" strokeWidth="1.5" />
      <text x="29" y="24" textAnchor="middle" fontWeight="600" fontSize="11" fill="#262E1E">
        {iconText}
      </text>
      <text x="29" y="35" textAnchor="middle" fontSize="6.5" fill="#262E1E" opacity="0.75">
        CHAMPION
      </text>
    </svg>
  );
}

export function Tier3MedalSvg({ iconText }: { iconText: string }) {
  return (
    <svg viewBox="0 0 40 46">
      <defs>
        <linearGradient id="gT3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C7B384" />
          <stop offset="100%" stopColor="#8A754A" />
        </linearGradient>
      </defs>
      <path
        d="M20,2 L36,12 L36,32 L20,44 L4,32 L4,12 Z"
        fill="url(#gT3)"
        stroke="#262E1E"
        strokeOpacity="0.25"
        strokeWidth="1"
      />
      <text x="20" y="26" textAnchor="middle" fontWeight="600" fontSize="9" fill="#262E1E" opacity="0.8">
        {iconText}
      </text>
    </svg>
  );
}

export function GunSilhouetteSvg() {
  return (
    <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8,58 C14,42 34,34 58,36 C64,37 68,40 71,45 L120,45 L285,40 C289,40 291,42 291,45 C291,48 289,50 285,50 L120,53 L71,53 C68,58 64,61 58,62 C34,64 14,68 10,80 C6,84 4,72 8,58 Z"
        fill="currentColor"
      />
      <ellipse cx="82" cy="63" rx="8" ry="13" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
