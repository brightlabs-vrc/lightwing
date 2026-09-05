package shared

import (
	"encore.dev/storage/cache"
	"encore.dev/storage/sqldb"
)

// Shared infrastructure resources for all Lightwing services.
//
// Mirrors ts-legacy/db.ts (SQLDatabase "lightwing" with Prisma migrations)
// and ts-legacy/cache.ts (shared "lightwing-cache" cluster, volatile-ttl).
// Services reference these instead of declaring their own: the auth service
// aliases them, and other services import this package directly.
var DB = sqldb.NewDatabase("lightwing", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

var Cache = cache.NewCluster("lightwing-cache", cache.ClusterConfig{
	EvictionPolicy: cache.VolatileTTL,
})

// SetTestDB repoints the shared database at an isolated test database.
// Called once from TestMain; production code never calls it.
func SetTestDB(testDB *sqldb.Database) {
	DB = testDB
}
