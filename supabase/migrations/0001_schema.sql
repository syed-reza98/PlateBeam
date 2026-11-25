-- PlateBeam PostgreSQL Schema Migration (0001_schema.sql)
-- 26 tables: 25 core SRS tables + shift_registers (FR-035)
-- Monetary columns use BIGINT minor currency units.
-- UUID primary keys are generated in application code (with gen_random_uuid() fallback).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. tenants
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'STARTER',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED')),
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. outlets
CREATE TABLE outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    subdomain VARCHAR(100) NOT NULL UNIQUE,
    address TEXT,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    tax_reg_no VARCHAR(64),
    wifi_ssid VARCHAR(100),
    wifi_password_enc TEXT,
    qr_security_policy JSONB NOT NULL DEFAULT '{"geofenceEnabled": false, "maxRadiusMeters": 100, "pinRequired": false}'::jsonb,
    geo_lat DOUBLE PRECISION,
    geo_lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_outlets_tenant ON outlets (tenant_id, id);

-- 3. roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(80) NOT NULL,
    default_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_roles_tenant_name ON roles (tenant_id, name);

-- 4. users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    password_hash TEXT NOT NULL,
    pos_pin_hash TEXT,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_users_tenant_email ON users (tenant_id, email);
CREATE INDEX idx_users_tenant_outlet ON users (tenant_id, outlet_id, is_active);

-- 5. user_permission_overrides
CREATE TABLE user_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key VARCHAR(120) NOT NULL,
    effect VARCHAR(10) NOT NULL CHECK (effect IN ('GRANT', 'DENY')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_user_perm_overrides ON user_permission_overrides (tenant_id, user_id, permission_key);

-- 6. floor_zones
CREATE TABLE floor_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_floor_zones_tenant_outlet ON floor_zones (tenant_id, outlet_id, display_order);

-- 7. dining_tables (active_session_id FK added after table_sessions)
CREATE TABLE dining_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    zone_id UUID NOT NULL REFERENCES floor_zones(id) ON DELETE RESTRICT,
    table_number VARCHAR(30) NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    qr_token VARCHAR(255) NOT NULL UNIQUE,
    qr_rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pos_x INT NOT NULL DEFAULT 0,
    pos_y INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'CLEANING', 'RESERVED')),
    active_session_id UUID
);
CREATE UNIQUE INDEX uq_dining_tables_tenant_outlet_num ON dining_tables (tenant_id, outlet_id, table_number);
CREATE INDEX idx_dining_tables_tenant_outlet_status ON dining_tables (tenant_id, outlet_id, status);

-- 8. kitchen_stations
CREATE TABLE kitchen_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    printer_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sla_target_mins INT NOT NULL DEFAULT 15
);
CREATE INDEX idx_kitchen_stations_tenant_outlet ON kitchen_stations (tenant_id, outlet_id);

-- 9. menu_categories
CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    schedule_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_menu_categories_tenant_outlet ON menu_categories (tenant_id, outlet_id, sort_order);

-- 10. tax_slabs
CREATE TABLE tax_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    rate_bps INT NOT NULL DEFAULT 0,
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    hsn_code VARCHAR(30),
    is_inclusive BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_tax_slabs_tenant_outlet ON tax_slabs (tenant_id, outlet_id);

-- 11. menu_items
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    station_id UUID NOT NULL REFERENCES kitchen_stations(id) ON DELETE RESTRICT,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    base_price_minor BIGINT NOT NULL DEFAULT 0,
    tax_slab_id UUID NOT NULL REFERENCES tax_slabs(id) ON DELETE RESTRICT,
    dietary_type VARCHAR(30) NOT NULL DEFAULT 'VEG' CHECK (dietary_type IN ('VEG', 'NON_VEG', 'VEGAN', 'EGG', 'GLUTEN_FREE')),
    allergens TEXT[] NOT NULL DEFAULT '{}',
    spice_levels TEXT[] NOT NULL DEFAULT '{}',
    prep_time_mins INT NOT NULL DEFAULT 15,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_menu_items_tenant_outlet_cat ON menu_items (tenant_id, outlet_id, category_id, is_available);

-- 12. item_variants_modifiers
CREATE TABLE item_variants_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    group_name VARCHAR(100) NOT NULL,
    option_name VARCHAR(100) NOT NULL,
    price_delta_minor BIGINT NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    max_select INT NOT NULL DEFAULT 1
);
CREATE INDEX idx_item_modifiers_tenant_item ON item_variants_modifiers (tenant_id, menu_item_id);

-- 13. upsell_rules
CREATE TABLE upsell_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    trigger_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    trigger_category_id UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
    suggested_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    promo_price_minor BIGINT NOT NULL DEFAULT 0,
    priority INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_upsell_rules_tenant_outlet ON upsell_rules (tenant_id, outlet_id, priority DESC);

-- 14. guests
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    phone VARCHAR(30),
    email VARCHAR(255),
    display_name VARCHAR(150),
    loyalty_points INT NOT NULL DEFAULT 0,
    loyalty_tier VARCHAR(40) NOT NULL DEFAULT 'BRONZE',
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_guests_tenant_phone ON guests (tenant_id, phone);
CREATE INDEX idx_guests_tenant_email ON guests (tenant_id, email);

-- 15. table_sessions
CREATE TABLE table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    table_id UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('DINE_IN', 'TAKEAWAY')),
    token_number INT,
    status VARCHAR(25) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'BILL_REQUESTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
    guest_count INT NOT NULL DEFAULT 1,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    subtotal_minor BIGINT NOT NULL DEFAULT 0,
    tax_minor BIGINT NOT NULL DEFAULT 0,
    discount_minor BIGINT NOT NULL DEFAULT 0,
    service_charge_minor BIGINT NOT NULL DEFAULT 0,
    tip_minor BIGINT NOT NULL DEFAULT 0,
    total_minor BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_sessions_tenant_outlet_status ON table_sessions (tenant_id, outlet_id, status);
CREATE INDEX idx_sessions_tenant_opened ON table_sessions (tenant_id, opened_at DESC);

ALTER TABLE dining_tables
    ADD CONSTRAINT fk_dining_tables_active_session
    FOREIGN KEY (active_session_id) REFERENCES table_sessions(id) ON DELETE SET NULL;

-- 16. orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE RESTRICT,
    order_number VARCHAR(40) NOT NULL,
    round_number INT NOT NULL DEFAULT 1,
    source VARCHAR(20) NOT NULL CHECK (source IN ('QR', 'WAITER', 'COUNTER')),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('DRAFT', 'PENDING', 'CONFIRMED', 'IN_KITCHEN', 'COMPLETED', 'CANCELLED')),
    placed_by_guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_tenant_session ON orders (tenant_id, session_id, round_number);
CREATE INDEX idx_orders_tenant_outlet_created ON orders (tenant_id, outlet_id, created_at DESC);

-- 17. order_items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    station_id UUID NOT NULL REFERENCES kitchen_stations(id) ON DELETE RESTRICT,
    item_name_snapshot VARCHAR(160) NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_minor BIGINT NOT NULL DEFAULT 0,
    modifiers_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    spice_level VARCHAR(40),
    notes TEXT,
    tax_minor BIGINT NOT NULL DEFAULT 0,
    kds_status VARCHAR(25) NOT NULL DEFAULT 'NEW' CHECK (kds_status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')),
    started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ
);
CREATE INDEX idx_order_items_tenant_order ON order_items (tenant_id, order_id);
CREATE INDEX idx_order_items_tenant_station_kds ON order_items (tenant_id, station_id, kds_status);

-- 18. service_requests
CREATE TABLE service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE RESTRICT,
    table_id UUID NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
    request_type VARCHAR(30) NOT NULL CHECK (request_type IN ('WATER', 'NAPKINS', 'BILL', 'HELP', 'CUTLERY')),
    note TEXT,
    status VARCHAR(25) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_service_requests_tenant_outlet_status ON service_requests (tenant_id, outlet_id, status);

-- 19. invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(64) NOT NULL,
    tax_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_minor BIGINT NOT NULL DEFAULT 0,
    pdf_url TEXT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_invoices_tenant_outlet_number ON invoices (tenant_id, outlet_id, invoice_number);
CREATE INDEX idx_invoices_tenant_session ON invoices (tenant_id, session_id);

-- 20. payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE RESTRICT,
    invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    split_group_id UUID,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    provider VARCHAR(40) NOT NULL,
    method VARCHAR(40) NOT NULL,
    amount_minor BIGINT NOT NULL DEFAULT 0,
    tip_minor BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(25) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED')),
    gateway_txn_id VARCHAR(160),
    raw_webhook JSONB,
    paid_at TIMESTAMPTZ
);
CREATE INDEX idx_payments_tenant_session ON payments (tenant_id, session_id, status);

-- 21. reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE RESTRICT,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    manager_notified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reviews_tenant_outlet_created ON reviews (tenant_id, outlet_id, created_at DESC);

-- 22. mini_game_sessions
CREATE TABLE mini_game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE RESTRICT,
    game_type VARCHAR(50) NOT NULL,
    player_nickname VARCHAR(60) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    reward_coupon_code VARCHAR(40),
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mini_games_tenant_session ON mini_game_sessions (tenant_id, session_id);

-- 23. inventory_items
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    sku VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    current_qty NUMERIC(12, 3) NOT NULL DEFAULT 0,
    reorder_level NUMERIC(12, 3) NOT NULL DEFAULT 0,
    cost_per_unit_minor BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_inventory_tenant_outlet_sku ON inventory_items (tenant_id, outlet_id, sku);

-- 24. menu_item_recipes
CREATE TABLE menu_item_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    qty_required NUMERIC(12, 3) NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_recipes_tenant_menu_inv ON menu_item_recipes (tenant_id, menu_item_id, inventory_item_id);

-- 25. audit_logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at DESC);

-- 26. shift_registers (FR-035: cashier opening float, petty cash, Z-Report reconciliation)
CREATE TABLE shift_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    opened_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    closed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    opening_float_minor BIGINT NOT NULL DEFAULT 0,
    cash_sales_minor BIGINT NOT NULL DEFAULT 0,
    card_sales_minor BIGINT NOT NULL DEFAULT 0,
    upi_sales_minor BIGINT NOT NULL DEFAULT 0,
    petty_cash_minor BIGINT NOT NULL DEFAULT 0,
    expected_cash_minor BIGINT NOT NULL DEFAULT 0,
    actual_cash_minor BIGINT,
    variance_minor BIGINT,
    notes TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);
CREATE INDEX idx_shift_registers_tenant_outlet_status ON shift_registers (tenant_id, outlet_id, status);
