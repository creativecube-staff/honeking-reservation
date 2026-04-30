-- Enable btree_gist extension.
-- Required for Phase 2 Reservation table's `EXCLUDE USING gist (...)` constraint
-- which prevents double-booking on (bedId, timerange) and (practitionerId, timerange).
-- See https://www.postgresql.org/docs/current/btree-gist.html
CREATE EXTENSION IF NOT EXISTS btree_gist;
