import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '48px', marginBottom: '1rem', color: 'var(--color-accent-fg)' }}>
        Lightwing
      </h1>
      <p style={{ fontSize: '18px', color: 'var(--color-fg-muted)', marginBottom: '2rem' }}>
        VRChat Racing Community
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <Link
          href="/events"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: 'var(--color-accent-fg)',
            color: 'var(--color-canvas-default)',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '16px',
          }}
        >
          View Events
        </Link>
        <Link
          href="/auth"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            border: '1px solid var(--color-border-default)',
            color: 'var(--color-fg)',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '16px',
          }}
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}
