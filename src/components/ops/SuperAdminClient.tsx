'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, PauseCircle, Plus, Search } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { showToast } from '@/components/ui/ToastRegion';
import { formatMinorCurrency } from '@/lib/ops/format';
import type { SuperAdminTenant } from '@/lib/ops/types';
import type { SubscriptionPlan, TenantStatus } from '@/server/db/types';

function createDemoTenants(): SuperAdminTenant[] {
  return [
    {
      id: 'ten-1',
      name: 'Zaika Hospitality Group',
      slug: 'zaika-bistro',
      plan: 'PRO',
      status: 'ACTIVE',
      currencyCode: 'BDT',
      outletCount: 3,
      activeTablesCount: 42,
      monthlyGmvMinor: 84200000,
      createdAt: '2026-06-15T10:00:00Z',
    },
    {
      id: 'ten-2',
      name: 'Dhaka Spice Collective',
      slug: 'dhaka-spice',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      currencyCode: 'BDT',
      outletCount: 8,
      activeTablesCount: 118,
      monthlyGmvMinor: 215000000,
      createdAt: '2026-08-02T09:30:00Z',
    },
    {
      id: 'ten-3',
      name: 'Olive & Hearth Bistro',
      slug: 'olive-hearth',
      plan: 'STARTER',
      status: 'TRIAL',
      currencyCode: 'BDT',
      outletCount: 1,
      activeTablesCount: 14,
      monthlyGmvMinor: 12900000,
      createdAt: '2026-11-12T14:20:00Z',
    },
  ];
}

export function SuperAdminClient() {
  const [tenants, setTenants] = useState<SuperAdminTenant[]>(() => createDemoTenants());
  const [search, setSearch] = useState('');
  const [provisionOpen, setProvisionOpen] = useState(false);

  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newPlan, setNewPlan] = useState<SubscriptionPlan>('GROWTH');
  const [newCurrency, setNewCurrency] = useState('BDT');
  const [newOutletName, setNewOutletName] = useState('Main Flagship');

  const loadTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/tenants', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { tenants?: SuperAdminTenant[] };
        if (data.tenants && data.tenants.length > 0) setTenants(data.tenants);
      }
    } catch {
      // Demo fallback retained
    }
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void loadTenants();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadTenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.plan.toLowerCase().includes(q),
    );
  }, [search, tenants]);

  const handleProvision = async () => {
    if (!newName.trim() || !newSlug.trim()) {
      showToast({ title: 'Tenant name and slug are required', variant: 'warning' });
      return;
    }

    const slug = newSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    const created: SuperAdminTenant = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      slug,
      plan: newPlan,
      status: 'TRIAL',
      currencyCode: newCurrency,
      outletCount: 1,
      activeTablesCount: 0,
      monthlyGmvMinor: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/v1/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: created.name,
          slug: created.slug,
          plan: created.plan,
          currencyCode: created.currencyCode,
          initialOutletName: newOutletName.trim() || 'Main Outlet',
        }),
      });
      if (res.ok) {
        await loadTenants();
      } else {
        setTenants((prev) => [created, ...prev]);
      }
    } catch {
      setTenants((prev) => [created, ...prev]);
    }

    setProvisionOpen(false);
    setNewName('');
    setNewSlug('');
    showToast({
      title: `Provisioned ${created.name}`,
      description: `Plan: ${created.plan} · Subdomain: ${created.slug}`,
      variant: 'success',
    });
  };

  const handleToggleStatus = async (tenant: SuperAdminTenant) => {
    const nextStatus: TenantStatus =
      tenant.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';

    setTenants((prev) =>
      prev.map((t) => (t.id === tenant.id ? { ...t, status: nextStatus } : t)),
    );

    try {
      await fetch(`/api/v1/admin/tenants/${tenant.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch {
      // Optimistic update retained
    }

    showToast({
      title: `${tenant.name} is now ${nextStatus}`,
      variant: nextStatus === 'ACTIVE' ? 'success' : 'warning',
    });
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#262630] bg-[#111115] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Provisioned Tenants
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#F4F4F5]">
            {tenants.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262630] bg-[#111115] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Active Outlets
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#FF5412]">
            {tenants.reduce((acc, t) => acc + t.outletCount, 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262630] bg-[#111115] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Active Tables
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#10B981]">
            {tenants.reduce((acc, t) => acc + t.activeTablesCount, 0)}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative flex min-w-[240px] max-w-md flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-3 size-4 text-[#A1A1AA]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenants by name, slug, or plan…"
            className="min-h-11 w-full rounded-xl border border-[#262630] bg-[#111115] pl-9 pr-3 text-sm text-[#F4F4F5] placeholder:text-[#A1A1AA] focus:border-[#FF5412]"
          />
        </label>

        <button
          type="button"
          onClick={() => setProvisionOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF5412] px-4 text-xs font-semibold text-white shadow-beam transition-colors hover:bg-[#FF7033]"
        >
          <Plus className="size-4" aria-hidden="true" />
          Provision New Tenant
        </button>
      </div>

      <ResponsiveTable<SuperAdminTenant>
        caption="Multi-tenant subscriptions and provisioning status"
        getRowKey={(row) => row.id}
        rows={filtered}
        columns={[
          {
            key: 'name',
            header: 'Tenant',
            isRowHeader: true,
            render: (row) => (
              <div className="flex items-center gap-2.5">
                <Building2 className="size-4 text-[#FF5412]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-[#F4F4F5]">{row.name}</p>
                  <p className="font-mono text-xs text-[#A1A1AA]">{row.slug}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'plan',
            header: 'Plan',
            render: (row) => (
              <span className="rounded-full border border-[#262630] bg-[#18181F] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#F4F4F5]">
                {row.plan}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  row.status === 'ACTIVE'
                    ? 'bg-[#10B981]/15 text-[#10B981]'
                    : row.status === 'TRIAL'
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      : 'bg-[#EF4444]/15 text-[#EF4444]'
                }`}
              >
                {row.status === 'ACTIVE' ? (
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                ) : (
                  <PauseCircle className="size-3" aria-hidden="true" />
                )}
                {row.status}
              </span>
            ),
          },
          {
            key: 'outlets',
            header: 'Outlets',
            align: 'right',
            render: (row) => (
              <span className="font-mono text-[#F4F4F5]">{row.outletCount}</span>
            ),
          },
          {
            key: 'gmv',
            header: 'Monthly GMV',
            align: 'right',
            render: (row) => (
              <span className="font-mono font-semibold text-[#F4F4F5]">
                {formatMinorCurrency(row.monthlyGmvMinor, 'BDT')}
              </span>
            ),
          },
          {
            key: 'actions',
            header: 'Action',
            align: 'right',
            render: (row) => (
              <button
                type="button"
                onClick={() => void handleToggleStatus(row)}
                className="min-h-11 rounded-xl border border-[#262630] bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
              >
                {row.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
              </button>
            ),
          },
        ]}
      />

      <Dialog
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
        title="Provision New Restaurant Tenant"
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Brand / Tenant Name
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (!newSlug) {
                  setNewSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, ''),
                  );
                }
              }}
              placeholder="e.g. Spice Route Hospitality"
              className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
            />
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Subdomain Slug
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="spice-route"
              className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 font-mono text-sm text-[#F4F4F5]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Subscription Plan
              <select
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value as SubscriptionPlan)}
                className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
              >
                <option value="STARTER">STARTER</option>
                <option value="GROWTH">GROWTH</option>
                <option value="PRO">PRO</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Default Currency
              <select
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 font-mono text-sm text-[#F4F4F5]"
              >
                <option value="BDT">BDT (৳)</option>
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Initial Outlet Name
            <input
              type="text"
              value={newOutletName}
              onChange={(e) => setNewOutletName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setProvisionOpen(false)}
              className="min-h-11 rounded-xl border border-[#262630] bg-[#18181F] px-4 text-xs font-semibold text-[#F4F4F5]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleProvision()}
              className="min-h-11 rounded-xl bg-[#FF5412] px-5 text-xs font-semibold text-white shadow-beam hover:bg-[#FF7033]"
            >
              Provision Tenant
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
