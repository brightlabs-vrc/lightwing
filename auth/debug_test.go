package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"encore.app/shared"
)

// Debug bypass end-to-end through the browser sign-in endpoint: provision the
// debug admin, set the normal session cookie, return the callbackURL.
func Test_DebugSignInBypass(t *testing.T) {
	t.Setenv("LIGHTWING_DEBUG_LOGIN", "1")
	svc := testCompatService()

	body, _ := json.Marshal(map[string]string{
		"provider":    "discord",
		"callbackURL": "http://localhost:5173/auth?redirect=/events",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/sign-in/social", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	svc.CompatSignInSocial(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var payload struct {
		URL      string `json:"url"`
		Redirect bool   `json:"redirect"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.URL != "http://localhost:5173/auth?redirect=/events" {
		t.Errorf("url = %q, want the callbackURL", payload.URL)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("no session cookie set")
	}

	// The cookie authenticates get-session like a real Discord login.
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == sessionCookieName {
			sessionCookie = c
		}
	}
	if sessionCookie == nil {
		t.Fatalf("no %q cookie among %v", sessionCookieName, cookies)
	}
	getReq := httptest.NewRequest(http.MethodGet, "/api/auth/get-session", nil)
	getReq.AddCookie(sessionCookie)
	getRec := httptest.NewRecorder()
	svc.CompatGetSession(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get-session status = %d, want 200", getRec.Code)
	}
	var session struct {
		User struct {
			ID       string `json:"id"`
			SiteRole string `json:"siteRole"`
		} `json:"user"`
	}
	if err := json.NewDecoder(getRec.Body).Decode(&session); err != nil {
		t.Fatalf("decode session: %v", err)
	}
	if session.User.ID != debugUserID {
		t.Errorf("user id = %q, want %q", session.User.ID, debugUserID)
	}
	if session.User.SiteRole != string(SiteRoleSiteAdmin) {
		t.Errorf("siteRole = %q, want SITE_ADMIN", session.User.SiteRole)
	}
}

// Without the env var the endpoint keeps the Discord flow: it stores state
// and returns a Discord authorize URL, setting no session cookie.
func Test_DebugBypassDisabledKeepsDiscordFlow(t *testing.T) {
	t.Setenv("LIGHTWING_DEBUG_LOGIN", "")
	svc := testCompatService()

	body, _ := json.Marshal(map[string]string{
		"provider":    "discord",
		"callbackURL": "http://localhost:5173/auth",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/sign-in/social", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	svc.CompatSignInSocial(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var payload struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !strings.Contains(payload.URL, "discord.com") {
		t.Errorf("url = %q, want a Discord authorize URL", payload.URL)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookieName {
			t.Errorf("session cookie must not be set when bypass is disabled")
		}
	}
}

// ensureDebugUserSession provisions the admin and rotates the single session.
func Test_EnsureDebugUserSession(t *testing.T) {
	t.Setenv("LIGHTWING_DEBUG_LOGIN", "1")
	ctx := context.Background()

	token, err := ensureDebugUserSession(ctx)
	if err != nil {
		t.Fatalf("ensureDebugUserSession: %v", err)
	}
	actor, err := resolveActor(ctx, "Bearer "+token)
	if err != nil {
		t.Fatalf("resolveActor: %v", err)
	}
	if actor.UserID != debugUserID || !isSiteAdmin(actor.SiteRole) {
		t.Errorf("actor = %+v, want debug SITE_ADMIN", actor)
	}
	token2, err := ensureDebugUserSession(ctx)
	if err != nil {
		t.Fatalf("re-login: %v", err)
	}
	if token2 == token {
		t.Error("expected a fresh token on re-login")
	}
	// Old session row is gone (single active session). Note resolveActor may
	// still serve the old token from the actor cache until its TTL lapses —
	// same staleness as the Discord rotation path.
	var remaining int
	if err := shared.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM "session" WHERE "userId" = $1`, debugUserID,
	).Scan(&remaining); err != nil {
		t.Fatalf("count sessions: %v", err)
	}
	if remaining != 1 {
		t.Errorf("sessions = %d, want exactly 1", remaining)
	}
}
