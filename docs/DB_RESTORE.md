# DB restore runbook

> Untested backups are not backups. This runbook walks through restoring
> the BikeHeadz Managed PostgreSQL database to a *fork* (never to prod) and
> verifying the staging app comes up clean.

## Where backups live

Digital Ocean Managed PostgreSQL keeps:
- **Continuous WAL** — point-in-time restore for the last 7 days.
- **Daily snapshots** — retained 7 days on Basic, 14 days on higher tiers.

Both are visible in the DO Cloud control panel: **Databases → bikeheadz-db → Backups**.

## Recovery time objective (RTO)

- 50 GB DB: ~10 min for the fork to provision + ~5 min to point staging.
- 200 GB DB: budget 30–45 min end to end.
- The DO control panel shows estimated time once you start the fork.

## Drill — quarterly

Run this at least once per quarter, ideally just after a schema migration
lands so the new schema is exercised.

### 1. Fork the database

```sh
doctl databases fork bikeheadz-db \
  --name bikeheadz-db-restore-$(date +%Y%m%d) \
  --backup-restore-type point_in_time \
  --backup-restore-time "$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)"
```

For a snapshot-based fork:

```sh
doctl databases fork bikeheadz-db \
  --name bikeheadz-db-restore-$(date +%Y%m%d) \
  --backup-restore-type snapshot \
  --backup-id <BACKUP_ID>
```

DO emits a new connection string on completion; copy it.

### 2. Point a staging app at the fork

In the DO App Platform staging app:

```
DATABASE_URL=<the new fork connection string>
DATABASE_SSL=true
```

Trigger a redeploy. Watch logs for:
- `db.connected version=PostgreSQL 18.x ...`
- `migrate.skip ...` for every migration in `server/migrations/`
- No `db.pool.error` lines

### 3. Smoke verify

In a fresh browser, confirm:
- `/health` returns 200 and reports `db.ok` if we add that field
- `auth.requestMagicLink` works against a non-prod email
- `designs.list` returns the demo dataset (or your real designs if your
  email is in `ADMIN_EMAILS`)
- `payments.catalogue` returns three items
- A test STL generation completes (use Stripe test keys in staging)

### 4. Tear down

```sh
doctl databases delete bikeheadz-db-restore-<date>
```

Reset staging's `DATABASE_URL` back to the original.

## Drill log

| Date       | RTO observed | Operator     | Notes |
|------------|--------------|--------------|-------|
| _(empty)_  | _(empty)_    | _(empty)_    | first drill pending |

> Append a row each time. Treat the absence of recent rows as a signal that
> we don't actually know if backups work.
