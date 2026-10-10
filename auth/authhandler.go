package auth

import (
	"context"

	encoreauth "encore.dev/beta/auth"
)

//encore:authhandler
func (s *Service) AuthHandler(ctx context.Context, token string) (encoreauth.UID, *Actor, error) {
	actor, err := resolveActor(ctx, token)
	if err != nil {
		return "", nil, err
	}
	return encoreauth.UID(actor.UserID), actor, nil
}
