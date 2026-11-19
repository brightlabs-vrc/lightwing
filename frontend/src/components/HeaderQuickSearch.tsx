import React, { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { PixelBadge } from '@pxlkit/ui-kit'
import {
  getLeaderboard,
  listPublicEvents,
  listPublicTeams,
  type LeaderboardEntry,
} from '../lib/public-api'
import type { eventmanager, teammanager } from '../lib/client'

interface SearchResults {
  events: eventmanager.EventListItem[]
  racers: LeaderboardEntry[]
  teams: teammanager.TeamListItem[]
}

export const HeaderQuickSearch: React.FC = () => {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResults>({
    events: [],
    racers: [],
    teams: [],
  })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!isOpen || trimmed.length < 2) {
      setResults({ events: [], racers: [], teams: [] })
      setLoading(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const lower = trimmed.toLowerCase()
        const [eventsRes, lbRes, teamsRes] = await Promise.all([
          listPublicEvents(50, 0).catch(() => ({ events: [], total: 0 })),
          getLeaderboard({ Search: trimmed, Limit: 5, Offset: 0 }).catch(() => ({
            entries: [],
            total: 0,
            year: new Date().getUTCFullYear(),
            availableYears: [],
            calculatedAt: '',
          })),
          listPublicTeams(trimmed, 5, 0).catch(() => ({ teams: [], total: 0 })),
        ])

        if (cancelled) return

        const matchedEvents = (eventsRes.events || [])
          .filter(
            (e) =>
              e.status !== 'DRAFT' &&
              e.status !== 'PENDING_DELETION' &&
              (e.name.toLowerCase().includes(lower) ||
                (e.ownerName ?? '').toLowerCase().includes(lower) ||
                (e.description ?? '').toLowerCase().includes(lower)),
          )
          .slice(0, 4)

        setResults({
          events: matchedEvents,
          racers: (lbRes.entries || []).slice(0, 4),
          teams: (teamsRes.teams || []).slice(0, 4),
        })
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 220)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, isOpen])

  const trimmed = query.trim()
  const hasAnyResults =
    results.events.length > 0 || results.racers.length > 0 || results.teams.length > 0

  const handleSelect = () => {
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-56 md:w-64">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-retro-muted absolute left-2.5 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search Event/Racer..."
          aria-label="Search events, racers, or teams"
          className="w-full pl-8 pr-7 py-1.5 bg-retro-bg border-2 border-retro-border rounded text-xs text-retro-text placeholder:text-retro-muted font-sans focus:outline-none focus:border-retro-primary transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults({ events: [], racers: [], teams: [] })
            }}
            aria-label="Clear search"
            className="absolute right-2 text-retro-muted hover:text-retro-text cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && trimmed.length >= 2 && (
        <div className="absolute right-0 left-0 sm:left-auto sm:w-80 mt-2 bg-retro-surface border-2 border-retro-border-strong rounded shadow-xl z-50 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-4 text-center font-pixel text-[11px] text-retro-muted">
              SEARCHING...
            </div>
          ) : !hasAnyResults ? (
            <div className="px-3 py-4 text-center font-sans text-xs text-retro-muted">
              No matches found for &ldquo;{trimmed}&rdquo;.
            </div>
          ) : (
            <div className="divide-y divide-retro-border">
              {results.events.length > 0 && (
                <div className="py-1.5">
                  <div className="px-3 py-1 font-pixel text-[10px] text-retro-primary uppercase tracking-wider">
                    EVENTS
                  </div>
                  {results.events.map((evt) => (
                    <Link
                      key={evt.id}
                      to="/events/$eventId"
                      params={{ eventId: evt.id }}
                      onClick={handleSelect}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-retro-bg transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-sans text-xs font-semibold text-retro-text truncate">
                          {evt.name}
                        </div>
                        {evt.ownerName && (
                          <div className="font-sans text-[11px] text-retro-muted truncate">
                            {evt.ownerName}
                          </div>
                        )}
                      </div>
                      <PixelBadge
                        tone={
                          evt.status === 'ONGOING'
                            ? 'green'
                            : evt.status === 'PENDING'
                              ? 'cyan'
                              : 'neutral'
                        }
                      >
                        {evt.status}
                      </PixelBadge>
                    </Link>
                  ))}
                </div>
              )}

              {results.racers.length > 0 && (
                <div className="py-1.5">
                  <div className="px-3 py-1 font-pixel text-[10px] text-retro-gold uppercase tracking-wider">
                    RACERS
                  </div>
                  {results.racers.map((racer) => (
                    <Link
                      key={racer.userId}
                      to="/$user"
                      params={{ user: racer.slug || racer.userId }}
                      onClick={handleSelect}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-retro-bg transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={racer.image || '/fallback_avatar.jpg'}
                          alt={racer.name}
                          onError={(e) => {
                            e.currentTarget.src = '/fallback_avatar.jpg'
                          }}
                          className="w-6 h-6 rounded-full object-cover border border-retro-border shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-sans text-xs font-semibold text-retro-text truncate">
                            {racer.name}
                          </div>
                          {racer.slug && (
                            <div className="font-sans text-[11px] text-retro-muted truncate">
                              @{racer.slug}
                            </div>
                          )}
                        </div>
                      </div>
                      <PixelBadge tone="purple">
                        {racer.classTier && racer.classTier !== 'PRE_OP' && racer.classTier !== 'OP'
                          ? racer.classTier
                          : 'OPEN'}
                      </PixelBadge>
                    </Link>
                  ))}
                </div>
              )}

              {results.teams.length > 0 && (
                <div className="py-1.5">
                  <div className="px-3 py-1 font-pixel text-[10px] text-retro-secondary uppercase tracking-wider">
                    TEAMS
                  </div>
                  {results.teams.map((team) => (
                    <Link
                      key={team.id}
                      to="/t/$team"
                      params={{ team: team.slug || team.id }}
                      onClick={handleSelect}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-retro-bg transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-sans text-xs font-semibold text-retro-text truncate">
                          {team.name}
                        </div>
                        <div className="font-sans text-[11px] text-retro-muted truncate">
                          @{team.slug}
                        </div>
                      </div>
                      <PixelBadge tone="cyan">TEAM</PixelBadge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
