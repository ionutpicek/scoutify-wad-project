# Firestore -> MySQL migration scaffold

This folder provides a starter migration path so you can move data without manual entry.

## Files

- `schema.mysql.sql` - starter MySQL schema (core columns + JSON payload backup).
- `firestore-to-mysql.mjs` - copies collections from Firestore into MySQL.
- `verify-counts.mjs` - compares Firestore document counts with MySQL row counts.

## Prerequisites

1. Run commands from `backend/` so `serviceAccountKey.json` is found.
2. Install MySQL driver (one-time):
   - `npm i mysql2`
3. Set connection env vars:
   - `MYSQL_HOST`
   - `MYSQL_PORT` (default `3306`)
   - `MYSQL_USER`
   - `MYSQL_PASSWORD`
   - `MYSQL_DATABASE`

## 1) Create schema

Use your MySQL client and run:

```sql
SOURCE migration/schema.mysql.sql;
```

or:

```bash
mysql -u <user> -p <db> < migration/schema.mysql.sql
```

## 2) Migrate data

```bash
node migration/firestore-to-mysql.mjs
```

Options:

- `--run-schema` applies `schema.mysql.sql` before migrating.
- `--schema=./migration/schema.mysql.sql` custom schema path.

Example:

```bash
node migration/firestore-to-mysql.mjs --run-schema
```

## 3) Verify counts

```bash
node migration/verify-counts.mjs
```

## Notes

- The schema stores both typed columns and `source_payload` JSON, so no Firestore field is lost during first migration.
- The script uses upserts (`ON DUPLICATE KEY UPDATE`) and is re-runnable.
- Password hashing is only needed if you move auth from Firebase Auth to your backend later.
