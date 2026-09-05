package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"time"

)

// Local debug login bypass.
//
// Discord OAuth does not work on localhost, so local development needs a way
// to sign in without a provider. When the LIGHTWING_DEBUG_LOGIN environment
// variable is set (to any non-empty value), the browser sign-in endpoint
// (POST /api/auth/sign-in/social) provisions a fixed SITE_ADMIN "debug user",
// sets the normal session cookie, and returns the caller's callbackURL — the
// SPA navigates there and picks up the session through the regular
// get-session cookie flow. Same auth, no provider round-trip.
//
// NEVER set LIGHTWING_DEBUG_LOGIN in production: anyone could mint an admin
// session.

// debugUserID is the stable id of the local debug user.
const debugUserID = "debug-user-local"

// debugLoginEnabled reports whether the local debug login bypass is active.
func debugLoginEnabled() bool {
	return os.Getenv("LIGHTWING_DEBUG_LOGIN") != ""
}

// ensureDebugUserSession upserts the debug user (SITE_ADMIN, so local testing
// covers admin flows) and mints a fresh single active session for it.
func ensureDebugUserSession(ctx context.Context) (string, error) {
	now := time.Now().UTC()
	expiresAt := now.Add(sessionLifetime)
	sessionToken := generateSessionToken()

	tx, err := db.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var existingID string
	err = tx.QueryRow(ctx, `SELECT id FROM "user" WHERE id = $1`, debugUserID).Scan(&existingID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		slug, serr := GenerateUniqueUserSlug(db.Stdlib(), "Debug User", debugUserID)
		if serr != nil {
			return "", fmt.Errorf("failed to generate debug user slug: %w", serr)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO "user" (id, name, email, image, "siteRole", "vrchatUsername", slug, "createdAt", "updatedAt")
			 VALUES ($1, 'Debug User', 'debug-user@local.invalid', '', 'SITE_ADMIN', '', $2, $3, $3)`,
			debugUserID, slug, now); err != nil {
			return "", fmt.Errorf("failed to insert debug user: %w", err)
		}
	case err != nil:
		return "", fmt.Errorf("failed to look up debug user: %w", err)
	}

	var activeOrgID string
	err = tx.QueryRow(ctx,
		`SELECT "organizationId" FROM "member" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
		debugUserID,
	).Scan(&activeOrgID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("failed to fetch active org: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM "session" WHERE "userId" = $1`, debugUserID); err != nil {
		return "", fmt.Errorf("failed to delete old sessions: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO "session" (id, "userId", token, "activeOrganizationId", "expiresAt", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $5, $6, $6)`,
		generateID(), debugUserID, sessionToken,
		sql.NullString{String: activeOrgID, Valid: activeOrgID != ""},
		expiresAt, now); err != nil {
		return "", fmt.Errorf("failed to insert session: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("failed to commit transaction: %w", err)
	}
	return sessionToken, nil
}
