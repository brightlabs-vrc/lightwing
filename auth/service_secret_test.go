package auth

import (
	"testing"
)

func TestIsProduction(t *testing.T) {
	tests := []struct {
		name     string
		env      string
		goEnv    string
		expected bool
	}{
		{name: "Default non-prod", env: "", goEnv: "", expected: false},
		{name: "ENV=production", env: "production", goEnv: "", expected: true},
		{name: "ENV=prod", env: "prod", goEnv: "", expected: true},
		{name: "GO_ENV=production", env: "", goEnv: "production", expected: true},
		{name: "GO_ENV=prod", env: "", goEnv: "prod", expected: true},
		{name: "ENV=development", env: "development", goEnv: "", expected: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("ENV", tc.env)
			t.Setenv("GO_ENV", tc.goEnv)
			got := isProduction()
			if got != tc.expected {
				t.Errorf("isProduction() = %v, want %v", got, tc.expected)
			}
		})
	}
}

func TestLoadSecrets_EphemeralInDev(t *testing.T) {
	t.Setenv("ENV", "development")
	t.Setenv("GO_ENV", "development")
	t.Setenv("SESSION_COOKIE_SECRET", "")

	s := loadSecrets()
	if !s.ephemeralCookieKey {
		t.Errorf("expected ephemeralCookieKey to be true in dev when secret is missing")
	}
	if s.SessionCookieSecret == "" {
		t.Errorf("expected generated SessionCookieSecret to be non-empty")
	}
}

func TestLoadSecrets_ProvidedSecretInDev(t *testing.T) {
	t.Setenv("ENV", "development")
	t.Setenv("SESSION_COOKIE_SECRET", "custom-secret-key-1234567890123456")

	s := loadSecrets()
	if s.ephemeralCookieKey {
		t.Errorf("expected ephemeralCookieKey to be false when secret is provided")
	}
	if s.SessionCookieSecret != "custom-secret-key-1234567890123456" {
		t.Errorf("SessionCookieSecret = %q, want %q", s.SessionCookieSecret, "custom-secret-key-1234567890123456")
	}
}

func TestLoadSecrets_PanicsInProductionWhenMissing(t *testing.T) {
	t.Setenv("ENV", "production")
	t.Setenv("SESSION_COOKIE_SECRET", "")

	defer func() {
		r := recover()
		if r == nil {
			t.Errorf("expected loadSecrets() to panic in production when SESSION_COOKIE_SECRET is missing")
		} else {
			errMsg, ok := r.(string)
			if !ok || errMsg != "SESSION_COOKIE_SECRET must be configured in production" {
				t.Errorf("unexpected panic message: %v", r)
			}
		}
	}()

	_ = loadSecrets()
}
