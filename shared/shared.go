package shared

import (
	"sync"

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

// dbHandles tracks every service-local database handle (see db.go in each
// service) so tests can repoint them all at once.
var (
	dbMu      sync.Mutex
	dbHandles []*sqldb.Database
)

// RegisterDB records a service-local handle created via sqldb.Named.
// Called from init in each service's db.go.
func RegisterDB(db **sqldb.Database) {
	dbMu.Lock()
	defer dbMu.Unlock()
	dbHandles = append(dbHandles, *db)
}

// SetTestDB repoints the shared database and every registered service-local
// handle at an isolated test database. Called once from TestMain; production
// code never calls it.
func SetTestDB(testDB *sqldb.Database) {
	dbMu.Lock()
	defer dbMu.Unlock()
	DB = testDB
	for _, h := range dbHandles {
		*h = *testDB
	}
}
