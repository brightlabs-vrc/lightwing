import { api } from "encore.dev/api";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";

// apparently we don't need anything else more than this according to this docs
// https://better-auth.com/docs/integrations/encore
// but I get conflicting information from Encore (maybe older version of better-auth?) because we need a more
// elaborate version?
// https://encore.dev/blog/betterauth-tutorial
//
// anyways, I will trust better-auth's version for now and if it doesn't work I blame Cairo
export const authHandler = api.raw(
  { expose: true, path: "/api/auth/*path", method: "*" },
  toNodeHandler(auth)
);
