-- Keep Supabase access behind the authenticated Core API. The application
-- database owner can continue to use Prisma, while direct anon/authenticated
-- clients receive no table policy. This intentionally avoids references to
-- the managed `auth` schema so the migration works with pooled DB credentials.

DO $$
DECLARE
    public_table RECORD;
BEGIN
    FOR public_table IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', public_table.tablename);
    END LOOP;
END
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated;
    END IF;
END
$$;
