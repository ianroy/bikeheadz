-- Remove the Ads & Events feature. The left sidebar, `events.list` socket
-- command, and this table are all gone as of this migration.

DROP TABLE IF EXISTS events;
