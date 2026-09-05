package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"encore.dev"
	"encore.dev/beta/errs"
	"encore.dev/rlog"
	"golang.org/x/oauth2"
)

// Better-auth route compatibility.
//
// The frontend authenticates through better-auth's native routes with cookie
// transport (see ts-legacy/frontend/src/lib/auth.ts), so the Go service must
// serve the same routes it actually uses:
//
//	GET  /api/auth/get-session      session cookie in, {session, user} out
//	POST /api/auth/sign-in/social   {provider, callbackURL, ...} in, {url, redirect} out
//	GET  /api/auth/callback/discord OAuth code exchange, sets session cookie, 302s
//	POST /api/auth/sign-out         clears session + cookie
//
// Only these used routes are replicated (no better-auth library behavior).
// The OAuth state round-trips through the verification table — the same DB
// strategy better-auth was configured with. The session cookie is HMAC-signed
// with our own scheme (pre-migration better-auth cookies are unreadable, so
// users sign in once more after the migration).
const sessionCookieName = "better-auth.session_token"

func (s *Service) cookieKey() []byte {
	return []byte(s.secrets.SessionCookieSecret)
}

// signSessionToken authenticates a session token for cookie transport:
// "<token>.<base64url(HMAC-SHA256(token))>".
func signSessionToken(token string, key []byte) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(token))
	return token + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// verifySessionCookie returns the token if the signature is valid, else "".
func verifySessionCookie(signed string, key []byte) string {
	token, sig, ok := strings.Cut(signed, ".")
	if !ok || token == "" || sig == "" {
		return ""
	}
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(token))
	want, err := base64.RawURLEncoding.DecodeString(sig)
	if err != nil {
		return ""
	}
	if subtle.ConstantTimeCompare(want, mac.Sum(nil)) != 1 {
		return ""
	}
	return token
}

// setSessionCookie writes the cross-origin session cookie:
// httpOnly + Secure + SameSite=None, matching the TS cookie config.
func setSessionCookie(w http.ResponseWriter, token string, expires time.Time, key []byte) {
	maxAge := int(time.Until(expires).Seconds())
	if maxAge < 0 {
		maxAge = 0
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    signSessionToken(token, key),
		Path:     "/",
		Expires:  expires,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
	})
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0).UTC(),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
	})
}

// compatSessionToken resolves the session token from the Authorization
// header (Bearer, as sent by the generated API client) or the signed
// session cookie (as sent by the browser flows).
func (s *Service) compatSessionToken(req *http.Request) string {
	if h := strings.TrimSpace(req.Header.Get("Authorization")); h != "" {
		if t := strings.TrimSpace(strings.TrimPrefix(h, "Bearer")); t != "" {
			return t
		}
	}
	if c, err := req.Cookie(sessionCookieName); err == nil {
		if t := verifySessionCookie(c.Value, s.cookieKey()); t != "" {
			return t
		}
	}
	return ""
}

func writeAuthError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"code":    code,
		"message": message,
		"details": nil,
	})
}

// signOutSession deletes a session row and drops its cached actor.
// Shared by the SignOut endpoint and the compat sign-out route.
func signOutSession(ctx context.Context, token string) error {
	if actorCache != nil {
		_, _ = actorCache.Delete(ctx, actorCacheKey{Token: token})
	}
	_, err := db.Exec(ctx, `DELETE FROM "session" WHERE "token" = $1`, token)
	return err
}

// discordOAuthConfig builds the Discord OAuth2 config for a callback path.
func (s *Service) discordOAuthConfig(callbackPath string) oauth2.Config {
	return oauth2.Config{
		ClientID:     s.secrets.DiscordAuthClientID,
		ClientSecret: s.secrets.DiscordAuthClientSecret,
		Endpoint:     discordEndpoint,
		RedirectURL:  encore.Meta().APIBaseURL.String() + callbackPath,
		Scopes:       []string{"identify"},
	}
}

// fetchDiscordUser exchanges nothing itself: it fetches /users/@me with an
// OAuth-authenticated client. Shared by both OAuth callbacks.
func fetchDiscordUser(ctx context.Context, conf oauth2.Config, token *oauth2.Token) (*discordAuthUser, error) {
	resp, err := conf.Client(ctx, token).Get("https://discordapp.com/api/users/@me")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, &oauthHTTPError{Status: resp.StatusCode}
	}
	var discordUser discordAuthUser
	if err := json.NewDecoder(resp.Body).Decode(&discordUser); err != nil {
		return nil, err
	}
	return &discordUser, nil
}

type oauthHTTPError struct {
	Status int
}

func (e *oauthHTTPError) Error() string {
	return "discord API returned non-200 status"
}

// CompatGetSession serves GET /api/auth/get-session for the browser flow.
//
// Mirrors the better-auth get-session call in ts-legacy/frontend/src/lib/auth.ts
// (cookie in, {session: {token, expiresAt}, user} out).
//
//encore:api public raw method=GET path=/api/auth/get-session
func (s *Service) CompatGetSession(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	token := s.compatSessionToken(req)
	if token == "" {
		writeAuthError(w, http.StatusUnauthorized, "unauthenticated", "not authenticated")
		return
	}
	resp, err := getSessionData(ctx, token, true)
	if err != nil {
		if errs.Code(err) == errs.Unauthenticated {
			writeAuthError(w, http.StatusUnauthorized, "unauthenticated", "invalid or expired session")
		} else {
			rlog.Error("compat get-session failed", "err", err)
			writeAuthError(w, http.StatusInternalServerError, "internal", "failed to load session")
		}
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// CompatSignInSocial serves POST /api/auth/sign-in/social for the browser flow.
//
// Mirrors the better-auth sign-in call in ts-legacy/frontend/src/lib/auth.ts
// ({provider, callbackURL, errorCallbackURL} in, {url, redirect} out).
//
//encore:api public raw method=POST path=/api/auth/sign-in/social
func (s *Service) CompatSignInSocial(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	var body struct {
		Provider         string `json:"provider"`
		CallbackURL      string `json:"callbackURL"`
		ErrorCallbackURL string `json:"errorCallbackURL"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid_argument", "invalid request body")
		return
	}
	if body.Provider != "discord" {
		writeAuthError(w, http.StatusBadRequest, "invalid_argument", "unsupported provider")
		return
	}
	if body.CallbackURL == "" {
		writeAuthError(w, http.StatusBadRequest, "invalid_argument", "callbackURL is required")
		return
	}

	// Local bypass: provision the debug admin, set the normal session cookie,
// and send the SPA straight to its callbackURL — same cookie auth as the
// Discord callback, no provider round-trip.
	if debugLoginEnabled() {
		sessionToken, serr := ensureDebugUserSession(ctx)
		if serr != nil {
			rlog.Error("failed to create debug session", "err", serr)
			writeAuthError(w, http.StatusInternalServerError, "internal", "failed to create debug session")
			return
		}
		setSessionCookie(w, sessionToken, time.Now().UTC().Add(sessionLifetime), s.cookieKey())
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"url": body.CallbackURL, "redirect": true})
		return
	}

	state := generateState()
	if err := s.storeOAuthState(ctx, state, body.CallbackURL, body.ErrorCallbackURL); err != nil {
		rlog.Error("failed to store OAuth state", "err", err)
		writeAuthError(w, http.StatusInternalServerError, "internal", "failed to initialize OAuth flow")
		return
	}

	conf := s.discordOAuthConfig("/api/auth/callback/discord")
	authURL := conf.AuthCodeURL(state, oauth2.SetAuthURLParam("prompt", "consent"))

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"url": authURL, "redirect": false})
}

// withOAuthError appends better-auth-style error params to a redirect target.
func withOAuthError(target, code, desc string) string {
	parsed, err := url.Parse(target)
	if err != nil {
		return target
	}
	q := parsed.Query()
	q.Set("error", code)
	if desc != "" {
		q.Set("error_description", desc)
	}
	parsed.RawQuery = q.Encode()
	return parsed.String()
}

// CompatDiscordCallback serves GET /api/auth/callback/discord: the OAuth
// redirect target registered with Discord. It validates state, exchanges the
// code, upserts user/account/session, sets the session cookie, and redirects
// to the frontend. Failures redirect with ?error=&error_description= so the
// /auth page can display them (see ts-legacy/frontend/src/routes/auth.tsx).
//
//encore:api public raw method=GET path=/api/auth/callback/discord
func (s *Service) CompatDiscordCallback(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	q := req.URL.Query()
	code, state := q.Get("code"), q.Get("state")
	if code == "" || state == "" {
		http.Error(w, "missing code or state parameter", http.StatusBadRequest)
		return
	}

	redir, err := s.consumeOAuthState(ctx, state)
	if err != nil {
		rlog.Error("invalid OAuth state", "err", err)
		http.Error(w, "invalid or expired state parameter", http.StatusBadRequest)
		return
	}
	fail := func(code, desc string) {
		oauthCallbackError.With(oauthCallbackErrorLabels{Error: code}).Add(1)
		dest := redir.ErrorRedirect
		if dest == "" {
			dest = redir.Redirect
		}
		if dest == "" {
			http.Error(w, desc, http.StatusInternalServerError)
			return
		}
		http.Redirect(w, req, withOAuthError(dest, code, desc), http.StatusFound)
	}

	conf := s.discordOAuthConfig("/api/auth/callback/discord")
	token, err := conf.Exchange(ctx, code)
	if err != nil {
		rlog.Error("failed to exchange OAuth code", "err", err)
		fail("oauth", "failed to exchange OAuth code")
		return
	}

	discordUser, err := fetchDiscordUser(ctx, conf, token)
	if err != nil {
		rlog.Error("failed to fetch Discord user", "err", err)
		fail("oauth", "failed to fetch user info")
		return
	}

	sessionToken, err := upsertUserAndSession(ctx, s, token, discordUser)
	if err != nil {
		rlog.Error("failed to upsert user/session", "err", err)
		fail("oauth", "failed to create session")
		return
	}

	setSessionCookie(w, sessionToken, time.Now().UTC().Add(sessionLifetime), s.cookieKey())
	dest := redir.Redirect
	if dest == "" {
		dest = "/"
	}
	http.Redirect(w, req, dest, http.StatusFound)
}

// CompatSignOut serves POST /api/auth/sign-out: deletes the session and
// clears the cookie. Idempotent like the TS sign-out.
//
//encore:api public raw method=POST path=/api/auth/sign-out
func (s *Service) CompatSignOut(w http.ResponseWriter, req *http.Request) {
	if token := s.compatSessionToken(req); token != "" {
		if err := signOutSession(req.Context(), token); err != nil {
			rlog.Error("failed to delete session on sign-out", "err", err)
		}
	}
	clearSessionCookie(w)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
}
