package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

)

func testCompatService() *Service {
	return &Service{secrets: &secrets{
		SessionCookieSecret:     "test-cookie-secret-at-least-32-bytes!",
		DiscordAuthClientID:     "test-client-id",
		DiscordAuthClientSecret: "test-client-secret",
	}}
}

func Test_cookieSignVerify(t *testing.T) {
	key := []byte("test-cookie-secret-at-least-32-bytes!")

	t.Run("round trip", func(t *testing.T) {
		signed := signSessionToken("abc123token", key)
		if got := verifySessionCookie(signed, key); got != "abc123token" {
			t.Errorf("verify = %q, want %q", got, "abc123token")
		}
	})

	t.Run("tampered token rejected", func(t *testing.T) {
		signed := signSessionToken("abc123token", key)
		if got := verifySessionCookie("evil"+signed[len("evil"):], key); got != "" {
			t.Errorf("verify tampered = %q, want empty", got)
		}
	})

	t.Run("wrong key rejected", func(t *testing.T) {
		signed := signSessionToken("abc123token", key)
		if got := verifySessionCookie(signed, []byte("wrong-key-00000000000000000000000")); got != "" {
			t.Errorf("verify wrong key = %q, want empty", got)
		}
	})

	t.Run("malformed rejected", func(t *testing.T) {
		for _, bad := range []string{"", "nodot", ".", "a.", ".b", "a.!!!not-base64!!!"} {
			if got := verifySessionCookie(bad, key); got != "" {
				t.Errorf("verify(%q) = %q, want empty", bad, got)
			}
		}
	})
}

func Test_oauthStateRoundTrip(t *testing.T) {
	ctx := context.Background()
	svc := testCompatService()

	state := generateState()
	if err := svc.storeOAuthState(ctx, state, "https://app.example/auth?redirect=/x", "https://app.example/auth?error=1"); err != nil {
		t.Fatalf("storeOAuthState failed: %v", err)
	}
	redir, err := svc.consumeOAuthState(ctx, state)
	if err != nil {
		t.Fatalf("consumeOAuthState failed: %v", err)
	}
	if redir.Redirect != "https://app.example/auth?redirect=/x" {
		t.Errorf("redirect = %q", redir.Redirect)
	}
	if redir.ErrorRedirect != "https://app.example/auth?error=1" {
		t.Errorf("errorRedirect = %q", redir.ErrorRedirect)
	}

	// Single-use: second consume must fail.
	if _, err := svc.consumeOAuthState(ctx, state); err == nil {
		t.Fatal("expected error on second consume")
	}
}

// Test_compatGetSession mirrors the browser get-session flow:
// GET /api/auth/get-session with the session cookie.
func Test_compatGetSession(t *testing.T) {
	ctx := context.Background()
	svc := testCompatService()

	userID := createUsersTestUser(t, ctx, "Cookie User", string(SiteRoleUser), "", "")
	token := createUsersTestSession(t, ctx, userID)

	cookieReq := func() *http.Request {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/get-session", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: signSessionToken(token, svc.cookieKey())})
		return req
	}

	t.Run("valid cookie returns session shape", func(t *testing.T) {
		rec := httptest.NewRecorder()
		svc.CompatGetSession(rec, cookieReq())
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var resp GetSessionResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp.Session.Token != token {
			t.Errorf("session token mismatch")
		}
		if resp.User.ID != userID {
			t.Errorf("user id = %q, want %q", resp.User.ID, userID)
		}
	})

	t.Run("bearer fallback works", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/get-session", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		svc.CompatGetSession(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("missing credentials 401", func(t *testing.T) {
		rec := httptest.NewRecorder()
		svc.CompatGetSession(rec, httptest.NewRequest(http.MethodGet, "/api/auth/get-session", nil))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("tampered cookie 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/get-session", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "tampered.invalid"})
		rec := httptest.NewRecorder()
		svc.CompatGetSession(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401", rec.Code)
		}
	})
}

// Test_compatSignInSocial mirrors the browser sign-in initiation:
// POST /api/auth/sign-in/social {provider, callbackURL, ...} -> {url, redirect}.
func Test_compatSignInSocial(t *testing.T) {
	ctx := context.Background()
	svc := testCompatService()

	t.Run("discord returns authorize url and stores state", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{
			"provider":         "discord",
			"callbackURL":      "https://app.example/auth?redirect=/events",
			"errorCallbackURL": "https://app.example/auth",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/sign-in/social", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		svc.CompatSignInSocial(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var resp struct {
			URL      string `json:"url"`
			Redirect bool   `json:"redirect"`
		}
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if !strings.Contains(resp.URL, "discord.com") || !strings.Contains(resp.URL, "state=") {
			t.Errorf("url = %q, want discord authorize url with state", resp.URL)
		}
		if resp.Redirect {
			t.Errorf("redirect = true, want false")
		}

		// The issued state must be consumable with the stored targets.
		u, err := url.Parse(resp.URL)
		if err != nil {
			t.Fatalf("failed to parse url: %v", err)
		}
		redir, err := svc.consumeOAuthState(ctx, u.Query().Get("state"))
		if err != nil {
			t.Fatalf("consumeOAuthState failed: %v", err)
		}
		if redir.Redirect != "https://app.example/auth?redirect=/events" {
			t.Errorf("redirect = %q", redir.Redirect)
		}
		if redir.ErrorRedirect != "https://app.example/auth" {
			t.Errorf("errorRedirect = %q", redir.ErrorRedirect)
		}
	})

	t.Run("unsupported provider rejected", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"provider": "github", "callbackURL": "https://app.example/auth"})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/sign-in/social", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		svc.CompatSignInSocial(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", rec.Code)
		}
	})

	t.Run("missing callbackURL rejected", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"provider": "discord"})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/sign-in/social", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		svc.CompatSignInSocial(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", rec.Code)
		}
	})
}

// Test_compatSignOut mirrors the browser sign-out: session deleted, cookie cleared.
func Test_compatSignOut(t *testing.T) {
	ctx := context.Background()
	svc := testCompatService()

	userID := createUsersTestUser(t, ctx, "Signout User", string(SiteRoleUser), "", "")
	token := createUsersTestSession(t, ctx, userID)

	signedReq := func() *http.Request {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/sign-out", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: signSessionToken(token, svc.cookieKey())})
		return req
	}

	rec := httptest.NewRecorder()
	svc.CompatSignOut(rec, signedReq())
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// Session row must be gone.
	var count int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM "session" WHERE "token" = $1`, token).Scan(&count); err != nil {
		t.Fatalf("failed to check session: %v", err)
	}
	if count != 0 {
		t.Errorf("session still present after sign-out")
	}

	// Cookie must be cleared.
	cleared := false
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookieName && c.MaxAge < 0 {
			cleared = true
		}
	}
	if !cleared {
		t.Errorf("session cookie not cleared")
	}

	// Idempotent: second call still 200.
	rec2 := httptest.NewRecorder()
	svc.CompatSignOut(rec2, signedReq())
	if rec2.Code != http.StatusOK {
		t.Errorf("second sign-out status = %d, want 200", rec2.Code)
	}

	// get-session with the old cookie is now 401.
	rec3 := httptest.NewRecorder()
	svc.CompatGetSession(rec3, signedReq())
	if rec3.Code != http.StatusUnauthorized {
		t.Errorf("get-session after sign-out = %d, want 401", rec3.Code)
	}
}

func Test_withOAuthError(t *testing.T) {
	got := withOAuthError("https://app.example/auth?redirect=/x", "oauth", "boom")
	if !strings.Contains(got, "error=oauth") || !strings.Contains(got, "redirect=%2Fx") {
		t.Errorf("got %q", got)
	}
}
