import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { secret } from "encore.dev/config";
import { prisma } from "./prisma";

// Store secrets using the Encore CLI:
//   encore secret set --type dev,local,pr,production AuthSecret
// Generate a strong value with: openssl rand -base64 32
const authSecret = secret("AuthSecret");

export const auth = betterAuth({
  secret: authSecret(),
  basePath: "/auth",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Origins that are allowed to make authenticated requests.
  // Add your frontend's URL here.
  trustedOrigins: [
    "http://localhost:4000",
    "http://localhost:3000",
  ],
  emailAndPassword: {
    enabled: true,
  },
});
