import { Service } from "encore.dev/service";

// The teams service owns team/organization endpoints (issue #6). Authentication
// and the RBAC matrix remain in the auth service, which this service calls into
// for permission checks.
// https://encore.dev/docs/ts/primitives/services

export default new Service("teammanager");
