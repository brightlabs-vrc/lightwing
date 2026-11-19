import React, { useMemo, useState } from 'react'

export interface EventBannerProps {
  id: string
  name: string
  bannerUrl?: string | null
  classRestriction?: string | null
  tag?: string | null
  ownerName?: string | null
  ownerLogo?: string | null
  /** 'hero' for homepage carousel backdrop, 'card' for event list cards */
  variant?: 'hero' | 'card'
  className?: string
}

interface BannerPalette {
  bgFrom: string
  bgTo: string
  accent: string
  accentSecondary: string
  stripe: string
  watermark: string
  label: string
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function getPalette(classRestriction?: string | null, tag?: string | null): BannerPalette {
  const tier = (classRestriction || '').toUpperCase()
  if (tier === 'G1') {
    return {
      bgFrom: '#0f1d3d',
      bgTo: '#1e1b4b',
      accent: '#f59e0b',
      accentSecondary: '#38bdf8',
      stripe: '#2563eb',
      watermark: 'G1',
      label: 'G1 GRADE',
    }
  }
  if (tier === 'G2') {
    return {
      bgFrom: '#3b0a1a',
      bgTo: '#1f1024',
      accent: '#fb7185',
      accentSecondary: '#f43f5e',
      stripe: '#e11d48',
      watermark: 'G2',
      label: 'G2 GRADE',
    }
  }
  if (tier === 'G3') {
    return {
      bgFrom: '#122b1e',
      bgTo: '#0f2419',
      accent: '#22c55e',
      accentSecondary: '#86efac',
      stripe: '#16a34a',
      watermark: 'G3',
      label: 'G3 GRADE',
    }
  }
  if ((tag || '').toUpperCase() === 'COMMUNITY') {
    return {
      bgFrom: '#0f2933',
      bgTo: '#18182f',
      accent: '#2dd4bf',
      accentSecondary: '#fbbf24',
      stripe: '#14b8a6',
      watermark: 'OPEN',
      label: 'COMMUNITY',
    }
  }
  return {
    bgFrom: '#1c1238',
    bgTo: '#0f172a',
    accent: '#a855f7',
    accentSecondary: '#22d3ee',
    stripe: '#9333ea',
    watermark: 'OPEN',
    label: 'OPEN CLASS',
  }
}

export const EventBanner: React.FC<EventBannerProps> = ({
  id,
  name,
  bannerUrl,
  classRestriction,
  tag,
  ownerName,
  ownerLogo,
  variant = 'hero',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false)

  const seed = useMemo(() => hashString(`${id}:${name}`), [id, name])
  const palette = useMemo(() => getPalette(classRestriction, tag), [classRestriction, tag])

  const patternId = `evt-dots-${id.replace(/[^a-zA-Z0-9_-]/g, '')}-${variant}`
  const gradId = `evt-grad-${id.replace(/[^a-zA-Z0-9_-]/g, '')}-${variant}`

  // Deterministic geometric variations seeded from event id
  const stripeOffset = (seed % 7) * 18
  const chevronY = 30 + (seed % 4) * 20
  const circleX = 68 + (seed % 18)
  const circleY = 25 + ((seed >> 4) % 45)
  const showBannerImg = Boolean(bannerUrl && !imgFailed)

  const initials = useMemo(() => {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase() || 'UK'
  }, [name])

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      style={{
        background: `linear-gradient(135deg, ${palette.bgFrom} 0%, ${palette.bgTo} 100%)`,
      }}
    >
      {/* Left accent bar matching prototype */}
      <div
        className="absolute left-0 top-0 bottom-0 z-20"
        style={{
          width: variant === 'hero' ? '8px' : '5px',
          backgroundColor: palette.accent,
        }}
      />

      {showBannerImg ? (
        <img
          src={bannerUrl!}
          alt={name}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 800 420"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full block"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={palette.bgFrom} />
              <stop offset="100%" stopColor={palette.bgTo} />
            </linearGradient>
            <pattern
              id={patternId}
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="3" cy="3" r="1.5" fill={palette.accentSecondary} fillOpacity="0.16" />
            </pattern>
          </defs>

          {/* Base gradient */}
          <rect width="800" height="420" fill={`url(#${gradId})`} />

          {/* Halftone dot field */}
          <rect width="800" height="420" fill={`url(#${patternId})`} />

          {/* Diagonal speed lanes */}
          <g opacity="0.14" transform={`translate(${stripeOffset}, 0)`}>
            <polygon points="430,0 520,0 350,420 260,420" fill={palette.accent} />
            <polygon points="560,0 610,0 440,420 390,420" fill={palette.accentSecondary} />
            <polygon points="650,0 680,0 510,420 480,420" fill={palette.stripe} />
          </g>

          {/* Stylized turf track curve & gate rings */}
          <circle
            cx={`${circleX}%`}
            cy={`${circleY}%`}
            r="145"
            fill="none"
            stroke={palette.accent}
            strokeOpacity="0.18"
            strokeWidth="3"
            strokeDasharray="10 8"
          />
          <circle
            cx={`${circleX}%`}
            cy={`${circleY}%`}
            r="96"
            fill={palette.accent}
            fillOpacity="0.08"
          />

          {/* Finish-gate chevrons on right side */}
          <g transform={`translate(620, ${chevronY})`} opacity="0.22">
            <path d="M0 0 L28 32 L0 64" fill="none" stroke={palette.accentSecondary} strokeWidth="6" />
            <path d="M36 0 L64 32 L36 64" fill="none" stroke={palette.accent} strokeWidth="6" />
            <path d="M72 0 L100 32 L72 64" fill="none" stroke={palette.accentSecondary} strokeWidth="6" />
          </g>

          {/* Horizontal turf rail lines */}
          <line x1="0" y1="352" x2="800" y2="352" stroke={palette.accent} strokeOpacity="0.22" strokeWidth="2" />
          <line x1="0" y1="364" x2="800" y2="364" stroke={palette.accentSecondary} strokeOpacity="0.14" strokeWidth="1" />

          {/* Bold watermark typography */}
          <text
            x="760"
            y={variant === 'hero' ? '265' : '290'}
            textAnchor="end"
            fill={palette.accent}
            fillOpacity="0.14"
            fontFamily="monospace"
            fontWeight="900"
            fontSize={variant === 'hero' ? '180' : '150'}
            letterSpacing="-6"
          >
            {palette.watermark}
          </text>

          {/* Subtle monogram badge top-right when no custom banner */}
          {variant === 'card' && (
            <text
              x="36"
              y="220"
              fill="#ffffff"
              fillOpacity="0.92"
              fontFamily="monospace"
              fontWeight="800"
              fontSize="44"
            >
              {name.length > 26 ? `${name.slice(0, 26)}…` : name}
            </text>
          )}
        </svg>
      )}

      {/* Optional organizer logo watermark in top-right corner when generated */}
      {!showBannerImg && ownerLogo && variant === 'hero' && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-black/45 backdrop-blur-xs border border-white/15 px-2.5 py-1.5 rounded">
          <img
            src={ownerLogo}
            alt={ownerName || initials}
            className="w-6 h-6 rounded object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          {ownerName && (
            <span className="font-pixel text-[10px] text-white/90 tracking-wide uppercase">
              {ownerName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
