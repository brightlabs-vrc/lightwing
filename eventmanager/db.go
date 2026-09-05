package eventmanager

import (
	"encore.dev/storage/sqldb"

	"encore.app/shared"
)

// db is this service's handle on the shared "lightwing" database.
//
// The database resource itself (plus its migrations) is defined in the
// shared package, but Encore only grants a service access to a database the
// service references directly. Every query in this package goes through this
// handle (declared via sqldb.Named so Encore's static analysis wires up the
// access), never through shared.DB.
var db = sqldb.Named("lightwing")

func init() {
	shared.RegisterDB(&db)
}
