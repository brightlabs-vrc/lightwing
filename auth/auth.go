package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"encore.dev"
	"encore.dev/beta/errs"
	"encore.dev/rlog"
	"golang.org/x/oauth2"
)

// --- API Endpoint Input/Response Types ---

// SignInSocialResponse directs the client to the Discord authorization URL.
type SignInSocialResponse struct {
	RedirectURL string `json:"redirectUrl"`
}

// GetSessionResponse mirrors the session shape returned by better-auth's
// get-session and stored by the frontend in localStorage.
//
// Frontend stores: lightwing:session:token
// Sends:   Authorization: Bearer ***
type GetSessionResponse struct {
	Session SessionInfo `json:"session"`
	User    UserProfile `json:"user"`
}

// SessionInfo is the session portion of GetSessionResponse.
type SessionInfo struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expiresAt"`
}

// SignInSocialParams provides the OAuth redirect URL for the callback.
type SignInSocialParams struct {
	// CallbackURL, if provided, indicates where the frontend expects to be
	// redirected after a successful sign-in callback.
	CallbackURL string `query:"callbackUrl"`
}

// --- Discord API Models ---

// discordAuthUser is the response from Discord's /users/@me endpoint.
type discordAuthUser struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	Discriminator string `json:"discriminator"`
	Avatar        string `json:"avatar"`
	Email         string `json:"email"`
}

func discordUserAvatarURL(user *discordAuthUser) string {
	if user.Avatar == "" {
		return ""
	}
	return fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", user.ID, user.Avatar)
}

// --- API Endpoints ---

// SignInSocial returns a redirect URL to start the Discord OAuth flow.
//
// Mirrors ts-legacy/auth/handler.ts GET /auth/sign-in/social (Discord provider)
//
//encore:api public method=GET path=/auth/sign-in/social
func (s *Service) SignInSocial(ctx context.Context, p *SignInSocialParams) (*SignInSocialResponse, error) {
	state := generateState()
	redirectTo := p.CallbackURL
	if redirectTo == "" {
		redirectTo = "/auth"
	}

	if err := s.storeOAuthState(ctx, state, redirectTo, ""); err != nil {
		rlog.Error("failed to store OAuth state", "err", err)
		return nil, &errs.Error{
			Code:    errs.Internal,
			Message: "failed to initialize OAuth flow",
		}
	}

	conf := s.discordOAuthConfig("/auth/callback/discord")

	// Encode the redirect path into the state so the callback knows where to
	// send the user back. State format: <state_value>:<redirect_path>
	encState := state + ":" + redirectTo

	redirectURL := conf.AuthCodeURL(encState, oauth2.SetAuthURLParam("prompt", "consent"))

	return &SignInSocialResponse{
		RedirectURL: redirectURL,
	}, nil
}

// oauthCallbackURL returns the full URL of the OAuth callback endpoint.
func (s *Service) oauthCallbackURL() string {
	meta := encore.Meta()
	return meta.APIBaseURL.String() + "/auth/callback/discord"
}

// Callback handles the Discord OAuth redirect. It exchanges the code for a token,
// fetches the user profile from Discord, upserts the user/account/session in the
// database, then redirects back to the frontend with the session token as a
// URL fragment (so the SPA can extract it).
//
// Mirrors ts-legacy/auth/handler.ts GET /auth/callback/discord
//
//encore:api public raw method=GET path=/auth/callback/discord
func (s *Service) Callback(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()

	code := req.URL.Query().Get("code")
	state := req.URL.Query().Get("state")

	if code == "" || state == "" {
		http.Error(w, "missing code or state parameter", http.StatusBadRequest)
		return
	}

	// State format: <state_value>:<redirect_path>
	// Split to recover state and redirect path
	parts := strings.SplitN(state, ":", 2)
	var storedState, redirectTo string
	if len(parts) == 2 {
		storedState = parts[0]
		redirectTo = parts[1]
	} else {
		storedState = state
	}

	// Validate state against stored OAuth state
	if storedState != "" {
		redir, err := s.consumeOAuthState(ctx, storedState)
		if err != nil {
			rlog.Error("invalid OAuth state", "err", err)
			http.Error(w, "invalid or expired state parameter", http.StatusBadRequest)
			return
		}
		if redirectTo == "" {
			redirectTo = redir.Redirect
		}
	}
	if redirectTo == "" {
		redirectTo = "/auth"
	}

	conf := s.discordOAuthConfig("/auth/callback/discord")

	// Exchange code for token
	token, err := conf.Exchange(ctx, code)
	if err != nil {
		rlog.Error("failed to exchange OAuth code", "err", err)
		oauthCallbackError.With(oauthCallbackErrorLabels{Error: "token_exchange"}).Add(1)
		http.Error(w, "failed to exchange OAuth code", http.StatusInternalServerError)
		return
	}

	// Fetch user info from Discord
	discordUser, err := fetchDiscordUser(ctx, conf, token)
	if err != nil {
		rlog.Error("failed to fetch Discord user", "err", err)
		oauthCallbackError.With(oauthCallbackErrorLabels{Error: "userinfo_fetch"}).Add(1)
		http.Error(w, "failed to fetch user info", http.StatusInternalServerError)
		return
	}

	// Upsert user + account + session
	sessionToken, err := upsertUserAndSession(ctx, s, token, discordUser)
	if err != nil {
		rlog.Error("failed to upsert user/session", "err", err)
		http.Error(w, "failed to create session", http.StatusInternalServerError)
		return
	}

	// Redirect back to the frontend with the session token in the URL fragment.
	// The SPA's auth.tsx extracts the fragment and stores it in localStorage.
	frontendURL := frontendBaseURL()
	parsedURL, err := url.Parse(frontendURL + redirectTo)
	if err != nil {
		http.Error(w, "invalid redirect URL", http.StatusInternalServerError)
		return
	}
	parsedURL.Fragment = "access_token=" + sessionToken
	http.Redirect(w, req, parsedURL.String(), http.StatusFound)
}

// frontendBaseURL returns the configured frontend origin.
func frontendBaseURL() string {
	if v := os.Getenv("LIGHTWING_FRONTEND_URL"); v != "" {
		return v
	}
	return "http://localhost:3000"
}

// upsertUserAndSession creates or updates the user, account, and session
// records for a Discord OAuth user. Returns the session token.
//
// Mirrors ts-legacy/auth/auth.ts signIn.callback flow: better-auth links the
// Discord account (providerId + accountId) to a user, maps the profile with a
// deterministic placeholder email, assigns a unique slug at creation, and
// grants SITE_ADMIN to the very first user.

// sessionLifetime matches the TS better-auth session expiry (30 days).
const sessionLifetime = 30 * 24 * time.Hour

func upsertUserAndSession(ctx context.Context, svc *Service, token *oauth2.Token, discordUser *discordAuthUser) (string, error) {
	now := time.Now().UTC()
	expiresAt := now.Add(sessionLifetime)
	sessionToken := generateSessionToken()

	// better-auth scope is identify-only, so Discord never returns an email.
	// TS mapProfileToUser synthesizes a deterministic non-routable placeholder
	// (better-auth requires non-null email).
	email := discordUser.ID + "@discord.invalid"
	displayName := discordUser.Username
	avatarURL := discordUserAvatarURL(discordUser)

	// Returning users keep their existing id via the account link, so rows
	// created by better-auth (cuid ids) stay stable across the migration.
	userID := ""
	err := db.QueryRow(ctx,
		`SELECT "userId" FROM "account" WHERE "providerId" = 'discord' AND "accountId" = $1`,
		discordUser.ID,
	).Scan(&userID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("failed to look up discord account: %w", err)
	}

	// Use a transaction to keep user/account/session consistent
	tx, err := db.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if user exists
	var existingUserID string
	err = tx.QueryRow(ctx,
		`SELECT id FROM "user" WHERE id = $1`, userID,
	).Scan(&existingUserID)

	if errors.Is(err, sql.ErrNoRows) || userID == "" {
		// Insert new user with a generated slug, mirroring the TS
		// user-create database hook. The first user bootstraps SITE_ADMIN.
		var userCount int
		if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM "user"`).Scan(&userCount); err != nil {
			return "", fmt.Errorf("failed to count users: %w", err)
		}
		siteRole := string(SiteRoleUser)
		if userCount == 0 {
			siteRole = string(SiteRoleSiteAdmin)
		}
		if userID == "" {
			userID = generateID()
		}
		slug, err := GenerateUniqueUserSlug(db.Stdlib(), displayName, userID)
		if err != nil {
			return "", fmt.Errorf("failed to generate user slug: %w", err)
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO "user" (id, name, email, image, "siteRole", "vrchatUsername", slug, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			userID, displayName, email, nullIfEmpty(avatarURL),
			siteRole, "", slug, now, now,
		)
		if err != nil {
			return "", fmt.Errorf("failed to insert user: %w", err)
		}
	} else if err != nil {
		return "", fmt.Errorf("failed to check existing user: %w", err)
	} else {
		// Update existing user
		_, err = tx.Exec(ctx,
			`UPDATE "user" SET name = $1, email = $2, image = $3, "updatedAt" = $4
			 WHERE id = $5`,
			displayName, email, nullIfEmpty(avatarURL), now, userID,
		)
		if err != nil {
			return "", fmt.Errorf("failed to update user: %w", err)
		}
	}

	// Upsert the Discord account link using the real account columns.
	// (No unique constraint covers (userId, providerId), so select-then-write.)
	scope, _ := token.Extra("scope").(string)
	accessExpires := sql.NullTime{}
	if !token.Expiry.IsZero() {
		accessExpires = sql.NullTime{Time: token.Expiry.UTC(), Valid: true}
	}
	var existingAccountID string
	err = tx.QueryRow(ctx,
		`SELECT id FROM "account" WHERE "userId" = $1 AND "providerId" = 'discord'`,
		userID,
	).Scan(&existingAccountID)
	if errors.Is(err, sql.ErrNoRows) {
		_, err = tx.Exec(ctx,
			`INSERT INTO "account" (id, "accountId", "providerId", "userId", "accessToken",
			                        "refreshToken", "scope", "accessTokenExpiresAt", "createdAt", "updatedAt")
			 VALUES ($1, $2, 'discord', $3, $4, $5, $6, $7, $8, $8)`,
			generateID(), discordUser.ID, userID, token.AccessToken,
			nullIfEmpty(token.RefreshToken), nullIfEmpty(scope), accessExpires, now,
		)
		if err != nil {
			return "", fmt.Errorf("failed to insert account: %w", err)
		}
	} else if err != nil {
		return "", fmt.Errorf("failed to check existing account: %w", err)
	} else {
		_, err = tx.Exec(ctx,
			`UPDATE "account" SET "accessToken" = $1, "refreshToken" = $2, "scope" = $3,
			                     "accessTokenExpiresAt" = $4, "updatedAt" = $5
			 WHERE id = $6`,
			token.AccessToken, nullIfEmpty(token.RefreshToken), nullIfEmpty(scope),
			accessExpires, now, existingAccountID,
		)
		if err != nil {
			return "", fmt.Errorf("failed to update account: %w", err)
		}
	}

	// Get active organization (first member org)
	var activeOrgID string
	err = tx.QueryRow(ctx,
		`SELECT "organizationId" FROM "member" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
		userID,
	).Scan(&activeOrgID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("failed to fetch active org: %w", err)
	}

	// Delete any existing sessions for this user (single active session)
	_, err = tx.Exec(ctx,
		`DELETE FROM "session" WHERE "userId" = $1`,
		userID,
	)
	if err != nil {
		return "", fmt.Errorf("failed to delete old sessions: %w", err)
	}

	// Insert new session
	_, err = tx.Exec(ctx,
		`INSERT INTO "session" (id, "userId", token, "activeOrganizationId", "expiresAt", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		generateID(), userID, sessionToken,
		sql.NullString{String: activeOrgID, Valid: activeOrgID != ""},
		expiresAt, now, now,
	)
	if err != nil {
		return "", fmt.Errorf("failed to insert session: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Sync Discord staff role → siteRole
	go func() {
		backgroundCtx := context.Background()
		err := svc.syncSiteRoleFromDiscordMembership(backgroundCtx, userID)
		if err != nil {
			rlog.Error("failed to sync site role from Discord", "err", err)
		}
	}()

	return sessionToken, nil
}

// --- API Endpoints ---

// GetSession returns the session and user profile for the authenticated caller.
//
// Mirrors ts-legacy/auth/auth.ts get-session endpoint
//
//encore:api public
func (s *Service) GetSession(ctx context.Context) (*GetSessionResponse, error) {
	token := getAuthorizationToken(ctx)
	hasCookie := token != ""

	if token == "" {
		getSessionOutcome.With(getSessionOutcomeLabels{}).Add(1)
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "not authenticated"}
	}
	return getSessionData(ctx, token, hasCookie)
}

// getSessionData resolves a session token to the session + profile response.
// Split from the endpoint so tests can call it with an explicit token.
func getSessionData(ctx context.Context, token string, hasCookie bool) (*GetSessionResponse, error) {
	// Resolve the session from the token
	actor, err := resolveActor(ctx, "Bearer "+token)
	if err != nil {
		rlog.Error("resolveActor failed in GetSession", "err", err)
		getSessionOutcome.With(getSessionOutcomeLabels{HasCookie: hasCookie, HasSession: false}).Add(1)
		return nil, err
	}
	getSessionOutcome.With(getSessionOutcomeLabels{HasCookie: hasCookie, HasSession: true}).Add(1)

	// Fetch full user profile
	profile, err := getUserProfile(ctx, actor.UserID)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "failed to load user profile"}
	}

	// Fetch session expiry
	var expiresAt time.Time
	err = db.QueryRow(ctx,
		`SELECT "expiresAt" FROM "session" WHERE "token" = $1`, token,
	).Scan(&expiresAt)
	if err != nil {
		return nil, &errs.Error{Code: errs.Internal, Message: "failed to load session"}
	}

	// Ensure the user has a slug (lazy assignment for pre-slug rows)
	if profile.Slug == nil {
		if slug, err := ensureUserSlug(ctx, db, actor.UserID); err != nil {
			rlog.Error("failed to ensure user slug", "err", err)
		} else {
			profile.Slug = &slug
		}
	}

	return &GetSessionResponse{
		Session: SessionInfo{
			Token:     token,
			ExpiresAt: expiresAt.Format(time.RFC3339Nano),
		},
		User: *profile,
	}, nil
}

// SignOut deletes the caller's session.
//
// Mirrors ts-legacy/auth/auth.ts sign-out
//
//encore:api public
func (s *Service) SignOut(ctx context.Context) error {
	token := getAuthorizationToken(ctx)
	if token == "" {
		// Idempotent: calling sign-out with no session is a no-op, not an error.
		return nil
	}

	// Delete the session and drop its cached actor (idempotent no-op if gone)
	if err := signOutSession(ctx, token); err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	return nil
}

// --- Token Extraction ---

// getAuthorizationToken extracts the Bearer token from the current request's
// Authorization header, available via encore.CurrentRequest().
func getAuthorizationToken(ctx context.Context) string {
	req := encore.CurrentRequest()
	if req == nil {
		return ""
	}
	h := req.Headers.Get("Authorization")
	if h == "" {
		return ""
	}
	return strings.TrimPrefix(strings.TrimSpace(h), "Bearer ")
}
