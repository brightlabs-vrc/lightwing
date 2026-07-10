import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";

// Encore will consider this directory and all its subdirectories as part of the "frontend" service.
// https://encore.dev/docs/ts/primitives/services
export default new Service("frontend");

// Serve static files from the ./dist directory
export const assets = api.static({
  expose: true,
  path: "/!path",
  dir: "./dist",
  notFound: "./dist/index.html",
});
