import React from 'react'

/**
 * Clean skeleton loader for Admin/Public list pages adopting Primer tokens.
 */
export function SldsSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '1rem' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: 'var(--color-canvas-default)',
            borderRadius: '6px',
            border: '1px solid var(--color-border-default)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ height: '18px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '40%' }}></div>
            <div style={{ height: '20px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '12px', width: '60px' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            <div style={{ height: '14px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '25%' }}></div>
            <div style={{ height: '14px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '20%' }}></div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Clean details layout skeleton loader.
 */
export function SldsSkeletonDetail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '1rem' }}>
      {/* Header section placeholder */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--color-border-default)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '50%' }}>
          <div style={{ height: '28px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '80%' }}></div>
          <div style={{ height: '14px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '40%' }}></div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ height: '32px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '100px' }}></div>
          <div style={{ height: '32px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '120px' }}></div>
        </div>
      </div>

      {/* Tabs list placeholder */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-default)', gap: '16px', paddingBottom: '4px' }}>
        <div style={{ height: '20px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '120px' }}></div>
        <div style={{ height: '20px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '140px' }}></div>
        <div style={{ height: '20px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '4px', width: '110px' }}></div>
      </div>

      {/* Main card body placeholder */}
      <div style={{ height: '200px', backgroundColor: 'var(--color-canvas-subtle)', border: '1px solid var(--color-border-default)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
        <div style={{ height: '16px', backgroundColor: 'var(--color-canvas-default)', borderRadius: '4px', width: '90%' }}></div>
        <div style={{ height: '16px', backgroundColor: 'var(--color-canvas-default)', borderRadius: '4px', width: '85%' }}></div>
        <div style={{ height: '16px', backgroundColor: 'var(--color-canvas-default)', borderRadius: '4px', width: '60%' }}></div>
      </div>
    </div>
  )
}

/**
 * PixelSkeletonList is now identical to standard list loader.
 */
export function PixelSkeletonList({ count = 3 }: { count?: number }) {
  return <SldsSkeletonList count={count} />
}

/**
 * PixelSkeletonDetail is now identical to standard detail loader.
 */
export function PixelSkeletonDetail() {
  return <SldsSkeletonDetail />
}
