import { Service } from "encore.dev/service";

// Encore will consider this directory and all its subdirectories as part of the "dataset-ingest" service.
// https://encore.dev/docs/ts/primitives/services

// dataset-ingest service responds to requests related to dataset ingestion.
// this is mainly for datasets from external sources and historical data.
export default new Service("dataset-ingest");
