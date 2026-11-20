import React from 'react'

/**
 * Salesforce Lightning Design System (SLDS) styled skeleton loader for Admin pages.
 */
export function SldsSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="animate-pulse slds-p-around_medium" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="slds-box bg-white"
          style={{
            background: '#ffffff',
            borderRadius: '4px',
            border: '1px solid #e0e0e0',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ height: '18px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '40%' }}></div>
            <div style={{ height: '20px', backgroundColor: '#e2e8f0', borderRadius: '12px', width: '60px' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            <div style={{ height: '14px', backgroundColor: '#f1f5f9', borderRadius: '4px', width: '25%' }}></div>
            <div style={{ height: '14px', backgroundColor: '#f1f5f9', borderRadius: '4px', width: '20%' }}></div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Salesforce Lightning Design System (SLDS) styled skeleton details/tabs layout loader for Admin pages.
 */
export function SldsSkeletonDetail() {
  return (
    <div className="animate-pulse slds-p-around_medium" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header section placeholder */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '50%' }}>
          <div style={{ height: '28px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '80%' }}></div>
          <div style={{ height: '14px', backgroundColor: '#f1f5f9', borderRadius: '4px', width: '40%' }}></div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ height: '32px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '100px' }}></div>
          <div style={{ height: '32px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '120px' }}></div>
        </div>
      </div>

      {/* Tabs list placeholder */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '16px', paddingBottom: '4px' }}>
        <div style={{ height: '20px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '120px' }}></div>
        <div style={{ height: '20px', backgroundColor: '#f1f5f9', borderRadius: '4px', width: '140px' }}></div>
        <div style={{ height: '20px', backgroundColor: '#f1f5f9', borderRadius: '4px', width: '110px' }}></div>
      </div>

      {/* Main card body placeholder */}
      <div style={{ height: '200px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
        <div style={{ height: '16px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '90%' }}></div>
        <div style={{ height: '16px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '85%' }}></div>
        <div style={{ height: '16px', backgroundColor: '#f1f5f9', borderRadius: '4px', width: '60%' }}></div>
      </div>
    </div>
  )
}

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

