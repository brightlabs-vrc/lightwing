import React from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'

// Import Salesforce Lightning Design System CSS directly from node_modules
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css'

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  const { session, signOutUser } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const isCurrent = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin' || pathname === '/admin/'
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="slds-scope bg-slate-100 min-h-screen font-sans" style={{ background: '#f3f2f1', minHeight: '100vh', paddingBottom: '3rem' }}>
      {/* Salesforce Global Header */}
      <header className="slds-global-header_container" style={{ position: 'static', marginBottom: '1.5rem' }}>
        <div className="slds-global-header slds-grid slds-grid_align-spread slds-grid_vertical-align-center" style={{ height: '3.125rem', borderBottom: '1px solid #dddbda', background: '#ffffff', padding: '0 1.5rem' }}>
          <div className="slds-global-header__item slds-grid slds-grid_vertical-align-center" style={{ display: 'flex', alignItems: 'center' }}>
            <div className="slds-p-right_small" style={{ display: 'flex', alignItems: 'center' }}>
              <span className="slds-icon_container slds-icon-utility-setup" style={{ background: '#0176d3', color: '#fff', borderRadius: '4px', padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', fontSize: '14px' }}>
                ⚙️
              </span>
            </div>
            <span className="slds-text-heading_small slds-truncate" style={{ fontWeight: 'bold', color: '#180505', fontSize: '1.1rem' }}>
              Project Lightwing Admin
            </span>
          </div>

          <div className="slds-global-header__item slds-grid slds-grid_vertical-align-center">
            {session ? (
              <div className="slds-grid slds-grid_vertical-align-center" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="slds-text-body_small slds-text-color_weak">
                  Signed in as <strong>{session.user.name}</strong> ({session.user.siteRole})
                </span>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="slds-button slds-button_neutral"
                  style={{ padding: '2px 12px', fontSize: '12px', lineHeight: '1.5' }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <span className="slds-text-body_small slds-text-color_weak">Not signed in</span>
            )}
          </div>
        </div>

        {/* Context Navigation Bar */}
        <div className="slds-context-bar" style={{ borderBottom: '1px solid #dddbda', background: '#ffffff' }}>
          <nav className="slds-context-bar__secondary" role="navigation" style={{ width: '100%' }}>
            <ul className="slds-grid" style={{ display: 'flex', margin: 0, padding: 0, listStyle: 'none' }}>
              <li className={`slds-context-bar__item ${isCurrent('/admin') && !isCurrent('/admin/events') && !isCurrent('/admin/users') && !isCurrent('/admin/datasets') ? 'slds-is-active' : ''}`} style={{ display: 'inline-flex' }}>
                <Link to="/admin" className="slds-context-bar__label-action" style={{ textDecoration: 'none' }}>
                  <span className="slds-truncate">Home</span>
                </Link>
              </li>
              <li className={`slds-context-bar__item ${isCurrent('/admin/events') ? 'slds-is-active' : ''}`} style={{ display: 'inline-flex' }}>
                <Link to="/admin/events" className="slds-context-bar__label-action" style={{ textDecoration: 'none' }}>
                  <span className="slds-truncate">Events & Races</span>
                </Link>
              </li>
              <li className={`slds-context-bar__item ${isCurrent('/admin/users') ? 'slds-is-active' : ''}`} style={{ display: 'inline-flex' }}>
                <Link to="/admin/users" className="slds-context-bar__label-action" style={{ textDecoration: 'none' }}>
                  <span className="slds-truncate">Users</span>
                </Link>
              </li>
              <li className={`slds-context-bar__item ${isCurrent('/admin/datasets') ? 'slds-is-active' : ''}`} style={{ display: 'inline-flex' }}>
                <Link to="/admin/datasets" className="slds-context-bar__label-action" style={{ textDecoration: 'none' }}>
                  <span className="slds-truncate">Datasets</span>
                </Link>
              </li>
              <li className="slds-context-bar__item" style={{ display: 'inline-flex', marginLeft: 'auto' }}>
                <Link to="/" className="slds-context-bar__label-action" style={{ textDecoration: 'none', color: '#0176d3', fontWeight: 'bold' }}>
                  <span className="slds-truncate">← Back to Portal</span>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="slds-p-around_medium" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
        {/* Page Header */}
        <div className="slds-page-header slds-m-bottom_medium" role="banner" style={{ borderRadius: '4px', border: '1px solid #dddbda', background: '#ffffff', padding: '1rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="slds-col slds-has-flexi-truncate">
              <div className="slds-media slds-no-space slds-grow" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="slds-media__figure" style={{ marginRight: '1rem' }}>
                  <span className="slds-icon_container slds-icon-standard-opportunity" style={{ background: '#0176d3', borderRadius: '4px', padding: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', color: '#fff', fontSize: '18px' }}>
                    📈
                  </span>
                </div>
                <div className="slds-media__body">
                  <p className="slds-text-title_caps slds-line-height_reset" style={{ fontSize: '10px', textTransform: 'uppercase', color: '#514f4d', margin: 0, letterSpacing: '0.0625rem' }}>Admin console</p>
                  <h1 className="slds-page-header__title slds-m-right_small slds-align-middle slds-truncate" style={{ fontWeight: 'bold', fontSize: '1.5rem', margin: '2px 0 0 0', color: '#080707' }}>
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="slds-text-body_small slds-m-top_xx-small" style={{ color: '#514f4d', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {actions && (
              <div className="slds-col slds-no-flex slds-grid slds-align-middle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {actions}
              </div>
            )}
          </div>
        </div>

        {/* Content Children */}
        <div className="slds-m-top_medium">
          {children}
        </div>
      </main>
    </div>
  )
}
