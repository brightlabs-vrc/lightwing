package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"encore.dev/metrics"
	"encore.dev/rlog"
	"encore.dev/storage/cache"
	"encore.app/auth/sqlc"
	"encore.app/shared"
	"golang.org/x/oauth2"
)

// Discord OAuth2 configuration.
// Source: ts-legacy/auth/auth.ts — discord OAuth provider with scope ["identify"].
var discordEndpoint = oauth2.Endpoint{
	AuthURL:  "https://discord.com/oauth2/authorize",
	TokenURL: "https://discord.com/api/oauth2/token",
}

// actorCacheKey is the cache key for the Actor cache.
type actorCacheKey struct {
	Token string
}

// memberRoleCacheKey is the cache key for the member role cache.
type memberRoleCacheKey struct {
	Key string // "orgId:userId"
}

type cachedMemberRole struct {
	Role string
}

// --- Package-level Encore resources ---
// The database and cache cluster live in the shared package (mirroring
// ts-legacy/db.ts and ts-legacy/cache.ts); keyspaces stay service-local.

var actorCache = cache.NewStructKeyspace[actorCacheKey, Actor](shared.Cache, cache.KeyspaceConfig{
	KeyPattern:    "actor/:Token",
	DefaultExpiry: cache.ExpireIn(240 * time.Second),
})

var memberRoleCache = cache.NewStructKeyspace[memberRoleCacheKey, cachedMemberRole](shared.Cache, cache.KeyspaceConfig{
	KeyPattern:    "member-role/:Key",
	DefaultExpiry: cache.ExpireIn(180 * time.Second),
})

// secrets is populated by Encore's runtime from the app's secret store
// (dashboard Secrets page or `encore secret set`). Field names must match the
// secret names exactly.
var secrets struct {
	DISCORD_AUTH_CLIENT_ID     string
	DISCORD_AUTH_CLIENT_SECRET string
	SESSION_COOKIE_SECRET      string
	LIGHTWING_FRONTEND_URL     string
}

// serviceSecrets is the auth service's resolved credentials: framework secret
// values first, plain environment variables as a fallback (self-hosted Docker
// runs outside Encore's secret injection).
type serviceSecrets struct {
	DiscordAuthClientID     string
	DiscordAuthClientSecret string
	AuthBaseURL             string
	// FrontendBaseURL is the public frontend origin OAuth callbacks redirect
	// to. Framework secret first (the only way to set some vars in Encore
	// Cloud), plain env as fallback, default for local dev.
	FrontendBaseURL string
	// SessionCookieSecret signs the session cookie. Empty in local dev yields
	// an ephemeral key (sessions reset on restart) with a startup warning.
	SessionCookieSecret string
	ephemeralCookieKey  bool
}

func secretOrEnv(frameworkValue, envName string) string {
	if frameworkValue != "" {
		return frameworkValue
	}
	return os.Getenv(envName)
}

func loadSecrets() *serviceSecrets {
	s := &serviceSecrets{
		DiscordAuthClientID:     secretOrEnv(secrets.DISCORD_AUTH_CLIENT_ID, "DISCORD_AUTH_CLIENT_ID"),
		DiscordAuthClientSecret: secretOrEnv(secrets.DISCORD_AUTH_CLIENT_SECRET, "DISCORD_AUTH_CLIENT_SECRET"),
		AuthBaseURL:             os.Getenv("ENCORERUNTIME_API_BASE_URL"),
		FrontendBaseURL:         secretOrEnv(secrets.LIGHTWING_FRONTEND_URL, "LIGHTWING_FRONTEND_URL"),
		SessionCookieSecret:     secretOrEnv(secrets.SESSION_COOKIE_SECRET, "SESSION_COOKIE_SECRET"),
	}
	if s.SessionCookieSecret == "" {
		var b [32]byte
		if _, err := rand.Read(b[:]); err != nil {
			panic(fmt.Sprintf("failed to generate ephemeral cookie secret: %v", err))
		}
		s.SessionCookieSecret = base64.RawURLEncoding.EncodeToString(b[:])
		s.ephemeralCookieKey = true
	}
	return s
}

// --- Metrics ---

// getSessionOutcomeLabels tracks the (cookie present? × session resolved?) cross-tab
// on /get-session to diagnose cross-origin session-resolution issues.
type getSessionOutcomeLabels struct {
	HasCookie  bool
	HasSession bool
}

// oauthCallbackErrorLabels tracks OAuth callback error codes.
type oauthCallbackErrorLabels struct {
	Error string
}

var (
	getSessionOutcome  = metrics.NewCounterGroup[getSessionOutcomeLabels, uint64]("auth_get_session_outcome", metrics.CounterConfig{})
	oauthCallbackError = metrics.NewCounterGroup[oauthCallbackErrorLabels, uint64]("auth_oauth_callback_error", metrics.CounterConfig{})
)

// Service is the auth service.
//encore:service
type Service struct {
	secrets *serviceSecrets
}

// initService is called by Encore's runtime.
func initService() (*Service, error) {
	s := &Service{
		secrets: loadSecrets(),
	}
	if s.secrets.ephemeralCookieKey {
		rlog.Warn("SESSION_COOKIE_SECRET is unset; using an ephemeral cookie key (sessions reset on restart). Set the secret for stable sessions.")
	}
	return s, nil
}

// Shutdown is called during graceful shutdown.
func (s *Service) Shutdown(force context.Context) {
	// no-op; resources (db, cache) are managed by Encore runtime
}

// generateSessionToken creates a cryptographically random session token.
// Mirrors the pattern from better-auth's session token generation.
func generateSessionToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// generateID generates a random UUID-like string for IDs.
func generateID() string {
	return shared.NewID()
}

// generateState creates a random OAuth state parameter for CSRF protection.
func generateState() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// oauthRedirect carries the OAuth landing targets through the state row.
type oauthRedirect struct {
	Redirect      string `json:"redirect"`
	ErrorRedirect string `json:"error_redirect,omitempty"`
}

// storeOAuthState stores the OAuth state and redirect targets in the
// verification table for later validation on callback (single-use, 5 min).
// Mirrors TS storeStateStrategy: "database" (state stored in verification table).
func (s *Service) storeOAuthState(ctx context.Context, state, redirect, errorRedirect string) error {
	value, err := json.Marshal(oauthRedirect{Redirect: redirect, ErrorRedirect: errorRedirect})
	if err != nil {
		return fmt.Errorf("failed to encode OAuth state: %w", err)
	}
	now := time.Now().UTC()
	err = q().StoreOAuthState(ctx, sqlc.StoreOAuthStateParams{
		Identifier: "oauth_state:" + state,
		StateValue: string(value),
		ExpiresAt:  now.Add(5 * time.Minute),
		Now:        sql.NullTime{Time: now, Valid: true},
	})
	return err
}

// consumeOAuthState retrieves and deletes the stored OAuth state, returning
// the redirect targets.
func (s *Service) consumeOAuthState(ctx context.Context, state string) (oauthRedirect, error) {
	raw, err := q().GetOAuthStateValue(ctx, sqlc.GetOAuthStateValueParams{
		Identifier: "oauth_state:" + state,
		ExpiresAt:  time.Now().UTC(),
	})
	if err != nil {
		return oauthRedirect{}, err
	}
	// Delete the state (single use)
	_ = q().DeleteVerificationByIdentifier(ctx, "oauth_state:"+state)
	var redir oauthRedirect
	if err := json.Unmarshal([]byte(raw), &redir); err != nil {
		// Plain-string rows predate the JSON envelope; treat as redirect only.
		redir = oauthRedirect{Redirect: raw}
	}
	return redir, nil
}
