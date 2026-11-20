import React from 'react'

/**
 * Primer-styled skeleton list loader for Admin pages.
 */
export function PrimerSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: 'var(--bgColor-default, #ffffff)',
            borderRadius: '6px',
            border: '1px solid var(--borderColor-default, #d0d7de)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ height: '16px', backgroundColor: 'var(--bgColor-neutral-muted, #eaeef2)', borderRadius: '6px', width: '40%' }} />
            <div style={{ height: '20px', backgroundColor: 'var(--bgColor-neutral-muted, #eaeef2)', borderRadius: '999px', width: '68px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <div style={{ height: '12px', backgroundColor: 'var(--bgColor-muted, #f6f8fa)', borderRadius: '6px', width: '28%' }} />
            <div style={{ height: '12px', backgroundColor: 'var(--bgColor-muted, #f6f8fa)', borderRadius: '6px', width: '20%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Primer-styled skeleton detail loader for Admin pages.
 */
export function PrimerSkeletonDetail() {
  return (
    <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--borderColor-default, #d0d7de)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '50%' }}>
          <div style={{ height: '24px', backgroundColor: 'var(--bgColor-neutral-muted, #eaeef2)', borderRadius: '6px', width: '75%' }} />
          <div style={{ height: '14px', backgroundColor: 'var(--bgColor-muted, #f6f8fa)', borderRadius: '6px', width: '45%' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ height: '32px', backgroundColor: 'var(--bgColor-neutral-muted, #eaeef2)', borderRadius: '6px', width: '100px' }} />
          <div style={{ height: '32px', backgroundColor: 'var(--bgColor-neutral-muted, #eaeef2)', borderRadius: '6px', width: '110px' }} />
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--borderColor-default, #d0d7de)', gap: '16px', paddingBottom: '8px' }}>
        <div style={{ height: '18px', backgroundColor: 'var(--bgColor-neutral-muted, #eaeef2)', borderRadius: '6px', width: '110px' }} />
        <div style={{ height: '18px', backgroundColor: 'var(--bgColor-muted, #f6f8fa)', borderRadius: '6px', width: '130px' }} />
        <div style={{ height: '18px', backgroundColor: 'var(--bgColor-muted, #f6f8fa)', borderRadius: '6px', width: '100px' }} />
      </div>

      <div style={{ height: '200px', backgroundColor: 'var(--bgColor-default, #ffffff)', border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
        <div style={{ height: '14px', backgroundColor: 'var(--bgColor-neutral-muted, #eaeef2)', borderRadius: '6px', width: '90%' }} />
        <div style={{ height: '14px', backgroundColor: 'var(--bgColor-neutral-muted, #eaeef2)', borderRadius: '6px', width: '80%' }} />
        <div style={{ height: '14px', backgroundColor: 'var(--bgColor-muted, #f6f8fa)', borderRadius: '6px', width: '60%' }} />
      </div>
    </div>
  )
}

/** Backwards-compatible aliases */
export const SldsSkeletonList = PrimerSkeletonList
export const SldsSkeletonDetail = PrimerSkeletonDetail

/**
 * Retro PixelKit styled card skeleton loader for public pages.
 */
export function PixelSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="animate-pulse space-y-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="border-4 border-retro-border bg-retro-bg p-5 pxl-shadow pxl-corner-sm"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
              <div style={{ height: '20px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '40%' }}></div>
              <div style={{ height: '14px', backgroundColor: 'var(--color-retro-surface, #f1f5f9)', width: '70%' }}></div>
            </div>
            <div style={{ height: '24px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '80px' }}></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ height: '24px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '120px' }}></div>
            <div style={{ height: '24px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '100px' }}></div>
            <div style={{ height: '24px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '60px' }}></div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Retro PixelKit styled detail view skeleton loader for public pages.
 */
export function PixelSkeletonDetail() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Back button placeholder */}
      <div style={{ height: '24px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '140px' }} className="mb-6"></div>

      {/* Main info card placeholder */}
      <div className="border-4 border-retro-border bg-retro-bg p-6 pxl-shadow pxl-corner-sm space-y-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ height: '28px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '60%' }}></div>
          <div style={{ height: '24px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '90px' }}></div>
        </div>
        <div style={{ height: '16px', backgroundColor: 'var(--color-retro-surface, #f1f5f9)', width: '85%' }}></div>
        <div style={{ height: '16px', backgroundColor: 'var(--color-retro-surface, #f1f5f9)', width: '45%' }}></div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '8px' }}>
          <div style={{ height: '24px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '180px' }}></div>
          <div style={{ height: '24px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '160px' }}></div>
        </div>
      </div>

      {/* Content grid columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div>
          <div style={{ height: '20px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '150px', marginBottom: '12px' }}></div>
          <div className="border-4 border-retro-border bg-retro-bg p-4 h-40 space-y-3">
            <div style={{ height: '14px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)' }}></div>
            <div style={{ height: '14px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '95%' }}></div>
            <div style={{ height: '14px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '90%' }}></div>
          </div>
        </div>
        <div>
          <div style={{ height: '20px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '120px', marginBottom: '12px' }}></div>
          <div className="border-4 border-retro-border bg-retro-bg p-4 h-40 space-y-3">
            <div style={{ height: '14px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)' }}></div>
            <div style={{ height: '14px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '95%' }}></div>
            <div style={{ height: '14px', backgroundColor: 'var(--color-retro-surface, #e2e8f0)', width: '90%' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Retro PixelKit styled profile skeleton loader for User / Team / Org profiles.
 */
export function PixelSkeletonProfile() {
  return (
    <div className="animate-pulse space-y-6 max-w-6xl mx-auto">
      {/* Header card */}
      <div className="border-2 border-retro-border-strong bg-retro-surface p-5 rounded">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-retro-bg border-2 border-retro-border shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-6 bg-retro-bg rounded w-48 max-w-full" />
            <div className="h-4 bg-retro-bg rounded w-32" />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className={`border-2 border-retro-border bg-retro-surface p-4 rounded text-center space-y-2 ${
              idx === 4 ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <div className="h-3 bg-retro-bg rounded w-20 mx-auto" />
            <div className="h-7 bg-retro-bg rounded w-16 mx-auto" />
          </div>
        ))}
      </div>

      {/* Content columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="border-2 border-retro-border bg-retro-surface p-5 rounded space-y-3">
            <div className="h-4 bg-retro-bg rounded w-28" />
            <div className="h-4 bg-retro-bg rounded w-full" />
            <div className="h-4 bg-retro-bg rounded w-5/6" />
          </div>
          <div className="border-2 border-retro-border bg-retro-surface p-5 rounded space-y-3">
            <div className="h-4 bg-retro-bg rounded w-36" />
            <div className="h-10 bg-retro-bg rounded w-full" />
            <div className="h-10 bg-retro-bg rounded w-full" />
          </div>
        </div>
        <div className="border-2 border-retro-border bg-retro-surface p-5 rounded space-y-3 h-48">
          <div className="h-4 bg-retro-bg rounded w-32" />
          <div className="h-12 bg-retro-bg rounded w-full" />
          <div className="h-12 bg-retro-bg rounded w-full" />
        </div>
      </div>
    </div>
  )
}

/**
 * Compact skeleton for retro table rows.
 */
export function PixelSkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse border-2 border-retro-border rounded bg-retro-bg divide-y divide-retro-border">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-4 w-8 bg-retro-surface rounded shrink-0" />
            <div className="h-4 bg-retro-surface rounded w-2/5" />
          </div>
          <div className="h-4 w-16 bg-retro-surface rounded shrink-0" />
          <div className="h-4 w-12 bg-retro-surface rounded shrink-0" />
        </div>
      ))}
    </div>
  )
}

/**
 * Compact skeleton for inline list rows (Home page, Team newsletters).
 */
export function PixelSkeletonInlineRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse divide-y divide-retro-border">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-4 h-4 rounded bg-retro-bg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-retro-bg rounded w-3/5" />
              <div className="h-2.5 bg-retro-bg rounded w-2/5" />
            </div>
          </div>
          <div className="h-4 w-14 bg-retro-bg rounded shrink-0" />
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton loader for Edit Profile / Settings form.
 */
export function PixelSkeletonForm() {
  return (
    <div className="animate-pulse max-w-6xl mx-auto space-y-6">
      <div className="h-8 bg-retro-surface rounded w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border-2 border-retro-border bg-retro-surface p-6 rounded space-y-4">
          <div className="h-4 bg-retro-bg rounded w-32" />
          <div className="h-10 bg-retro-bg rounded w-full" />
          <div className="h-10 bg-retro-bg rounded w-full" />
          <div className="h-10 bg-retro-bg rounded w-full" />
        </div>
        <div className="border-2 border-retro-border bg-retro-surface p-6 rounded space-y-4">
          <div className="h-4 bg-retro-bg rounded w-32" />
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-retro-bg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-retro-bg rounded w-28" />
              <div className="h-3 bg-retro-bg rounded w-20" />
            </div>
          </div>
        </div>
      </div>
      <div className="border-2 border-retro-border bg-retro-surface p-6 rounded space-y-3 h-64">
        <div className="h-4 bg-retro-bg rounded w-40" />
        <div className="h-44 bg-retro-bg rounded w-full" />
      </div>
    </div>
  )
}

