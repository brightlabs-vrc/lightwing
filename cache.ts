import { CacheCluster } from "encore.dev/storage/cache";

/**
 * Shared Redis-backed cache cluster used by all Lightwing services.
 * Encore provisions and manages the Redis instance automatically.
 */
export const cluster = new CacheCluster("lightwing-cache", {
  evictionPolicy: "allkeys-lru",
});
