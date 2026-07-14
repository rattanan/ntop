-- MariaDB 5.5 compatibility entrypoint.
-- The referenced migration uses only MariaDB 5.5-compatible tables, indexes,
-- DECIMAL values and foreign keys (no JSON, CTE or window functions).
SOURCE prisma/migrations/20260715003000_add_opportunity_related_information/migration.sql;
