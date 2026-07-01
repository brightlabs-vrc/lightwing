import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { secret } from "encore.dev/config";
import { db } from "./db";

// Store secrets using the Encore CLI:
//   encore secret set --type dev,local,pr,production AuthSecret
// Generate a strong value with: openssl rand -base64 32
const authSecret = secret("AuthSecret");

// Create a pg Pool for Better Auth using Encore's connection string.
const pool = new Pool({
  connectionString: db.connectionString,
});

export const auth = betterAuth({
  secret: authSecret(),
  basePath: "/auth",
  database: pool,
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
