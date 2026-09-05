package auth

import (
	"context"
	"testing"
)

// Test_getSessionData mirrors the portable behavior of
// ts-legacy/auth/session.test.ts ("Better-Auth vrchatUsername in session").
//
// The TS tests exercise better-auth's signed-cookie machinery, which the Go
// service intentionally does not replicate; the frontend authenticates with
// `Authorization: Bearer <token>`. What must stay identical is the session
// user object: it carries vrchatUsername when set and a falsy value when not.
func Test_getSessionData(t *testing.T) {
	ctx := context.Background()

	t.Run("returns vrchatUsername in session user when set", func(t *testing.T) {
		userID := createUsersTestUser(t, ctx, "VRC User", string(SiteRoleUser), "", "TestVRChatUser123")
		token := createUsersTestSession(t, ctx, userID)

		resp, err := getSessionData(ctx, token, false)
		if err != nil {
			t.Fatalf("getSessionData failed: %v", err)
		}
		if resp.User.VrchatUsername == nil || *resp.User.VrchatUsername != "TestVRChatUser123" {
			t.Errorf("vrchatUsername = %v, want %q", resp.User.VrchatUsername, "TestVRChatUser123")
		}
		// Display name prefers the VRChat username, mirroring TS toProfile.
		if resp.User.Name != "TestVRChatUser123" {
			t.Errorf("name = %q, want %q", resp.User.Name, "TestVRChatUser123")
		}
		if resp.Session.Token != token {
			t.Errorf("session token mismatch")
		}
	})

	t.Run("returns falsy vrchatUsername in session when not set", func(t *testing.T) {
		userID := createUsersTestUser(t, ctx, "No VRC User", string(SiteRoleUser), "", "")
		token := createUsersTestSession(t, ctx, userID)

		resp, err := getSessionData(ctx, token, false)
		if err != nil {
			t.Fatalf("getSessionData failed: %v", err)
		}
		if resp.User.VrchatUsername != nil {
			t.Errorf("vrchatUsername = %q, want nil", *resp.User.VrchatUsername)
		}
	})
}
