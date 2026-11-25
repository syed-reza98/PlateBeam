-- PlateBeam Multi-Tenant Row-Level Security Migration (0002_rls_policies.sql)
-- Enables and FORCES ROW LEVEL SECURITY on all 26 tables.
-- Uses RESTRICTIVE tenant_isolation_policy checking app.tenant_id via NULLIF(current_setting('app.tenant_id', true), '')::uuid.
-- Also defines permissive authenticated policies so Supabase Data API / authenticated sessions
-- cannot bypass tenant isolation and anon has zero direct table access.

-- Non-privileged runtime role for server-side transactions (never owns tables, no BYPASSRLS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime_role') THEN
        CREATE ROLE app_runtime_role NOLOGIN NOINHERIT;
    END IF;
END
$$;

-- Safe SECURITY INVOKER helper with immutable search_path
CREATE OR REPLACE FUNCTION public.current_app_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

-- Grant schema usage to runtime role and authenticated
GRANT USAGE ON SCHEMA public TO app_runtime_role, authenticated;

-- 1. tenants (scoped by id = current_app_tenant_id())
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON tenants
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (id = public.current_app_tenant_id())
    WITH CHECK (id = public.current_app_tenant_id());

CREATE POLICY tenants_authenticated_access ON tenants
    AS PERMISSIVE
    FOR ALL
    TO authenticated, app_runtime_role
    USING (id = public.current_app_tenant_id())
    WITH CHECK (id = public.current_app_tenant_id());

-- 2. roles (allows reading global system roles where tenant_id IS NULL, or tenant-owned roles)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON roles
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
    WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY roles_authenticated_access ON roles
    AS PERMISSIVE
    FOR ALL
    TO authenticated, app_runtime_role
    USING (tenant_id IS NULL OR tenant_id = public.current_app_tenant_id())
    WITH CHECK (tenant_id = public.current_app_tenant_id());

-- 3..26. All standard tenant-scoped tables with tenant_id UUID NOT NULL
DO $$
DECLARE
    tbl TEXT;
    tenant_tables TEXT[] := ARRAY[
        'outlets',
        'users',
        'user_permission_overrides',
        'floor_zones',
        'dining_tables',
        'kitchen_stations',
        'menu_categories',
        'tax_slabs',
        'menu_items',
        'item_variants_modifiers',
        'upsell_rules',
        'guests',
        'table_sessions',
        'orders',
        'order_items',
        'service_requests',
        'invoices',
        'payments',
        'reviews',
        'mini_game_sessions',
        'inventory_items',
        'menu_item_recipes',
        'audit_logs',
        'shift_registers'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);

        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I
                AS RESTRICTIVE
                FOR ALL
                TO public
                USING (tenant_id = public.current_app_tenant_id())
                WITH CHECK (tenant_id = public.current_app_tenant_id());',
            tbl
        );

        EXECUTE format(
            'CREATE POLICY authenticated_tenant_access ON %I
                AS PERMISSIVE
                FOR ALL
                TO authenticated, app_runtime_role
                USING (tenant_id = public.current_app_tenant_id())
                WITH CHECK (tenant_id = public.current_app_tenant_id());',
            tbl
        );

        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO app_runtime_role;', tbl);
    END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenants, roles TO app_runtime_role;
