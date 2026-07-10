import { APIError, Gateway, Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { prisma } from "./prisma";

interface AuthParams {
  authorization: Header<"Authorization">;
}

interface AuthData {
  userID: string;
  activeOrganizationId: string | null;
  siteRole: string;
}

export const sessionAuthHandler = authHandler<AuthParams, AuthData>(
  async ({ authorization }) => {
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      throw APIError.unauthenticated("missing session token");
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: { select: { siteRole: true } } },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw APIError.unauthenticated("invalid or expired session");
    }

    return {
      userID: session.userId,
      activeOrganizationId: session.activeOrganizationId ?? null,
      siteRole: session.user.siteRole,
    };
  },
);

export const gateway = new Gateway({
  authHandler: sessionAuthHandler,
});
