'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChefHat,
  Columns2,
  ExternalLink,
  LayoutDashboard,
  RefreshCw,
  Smartphone,
  UtensilsCrossed,
} from 'lucide-react';

const SEEDED_QR_TOKEN =
  'eyJ0IjoiMTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTExIiwibyI6IjIyMjIyMjIyLTIyMjItNDIyMi04MjIyLTIyMjIyMjIyMjIyMiIsInRibCI6IjY2NjY2NjY2LTY2NjYtNDY2Ni04NjY2LTY2NjY2NjY2NjYwMSIsIm4iOiJ6YWlrYTAxIiwiaWF0IjoxNzk1NjMyMDAwfQ.9_no91QOTl60pCNPzfmloMFIzjebyk0Wz8mItpBqPYI';

type OpsWorkspaceTab = 'POS' | 'KDS' | 'DASHBOARD';

const OPS_TABS: Array<{
  id: OpsWorkspaceTab;
  label: string;
  href: string;
  icon: typeof UtensilsCrossed;
}> = [
  {
    id: 'POS',
    label: 'FOH POS',
    href: '/pos/zaika-bistro',
    icon: UtensilsCrossed,
  },
  {
    id: 'KDS',
    label: 'Kitchen KDS',
    href: '/kds/zaika-bistro',
    icon: ChefHat,
  },
  {
    id: 'DASHBOARD',
    label: 'Owner BI',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
];

export function DemoSplitClient() {
  const [activeTab, setActiveTab] = useState<OpsWorkspaceTab>('POS');
  const [splitView, setSplitView] = useState(true);
  const [opsReloadKey, setOpsReloadKey] = useState(0);
  const [phoneReloadKey, setPhoneReloadKey] = useState(0);

  const currentOps = OPS_TABS.find((t) => t.id === activeTab) ?? OPS_TABS[0]!;
  const guestUrl = `/t/${SEEDED_QR_TOKEN}`;

  return (
    <div className="space-y-4">
      {/* Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#262630] bg-[#111115] px-4 py-3">
        <div role="tablist" aria-label="Operations surface switcher" className="flex flex-wrap gap-2">
          {OPS_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[#FF5412] bg-[#FF5412] text-white shadow-beam'
                    : 'border-[#262630] bg-[#18181F] text-[#F4F4F5] hover:border-[#FF5412]/60'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={splitView}
            onClick={() => setSplitView((v) => !v)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
              splitView
                ? 'border-[#FF5412] bg-[#FF5412]/15 text-[#FF5412]'
                : 'border-[#262630] bg-[#18181F] text-[#F4F4F5] hover:border-[#FF5412]'
            }`}
          >
            <Columns2 className="size-3.5" aria-hidden="true" />
            <span>Live Split View: {splitView ? 'ON' : 'OFF'}</span>
          </button>

          <Link
            href={currentOps.href}
            target="_blank"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#262630] bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] hover:border-[#FF5412]"
          >
            <ExternalLink className="size-3.5 text-[#FF5412]" aria-hidden="true" />
            <span>Open {currentOps.label}</span>
          </Link>
        </div>
      </div>

      {/* Split Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left: Operations Workspace */}
        <section
          aria-label={`${currentOps.label} workspace`}
          className={`flex flex-col overflow-hidden rounded-3xl border border-[#262630] bg-[#111115] ${
            splitView ? 'xl:col-span-8' : 'xl:col-span-12'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#262630] bg-[#18181F] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#10B981]" aria-hidden="true" />
              <span className="font-mono text-xs font-semibold text-[#F4F4F5]">
                {currentOps.href}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpsReloadKey((k) => k + 1)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#262630] bg-[#111115] px-2.5 text-[11px] font-semibold text-[#A1A1AA] hover:border-[#FF5412] hover:text-[#F4F4F5]"
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              Reload Pane
            </button>
          </div>
          <iframe
            key={`${currentOps.id}-${opsReloadKey}`}
            src={currentOps.href}
            title={`PlateBeam ${currentOps.label}`}
            className="h-[78dvh] min-h-[620px] w-full border-0 bg-[#09090B]"
          />
        </section>

        {/* Right: Docked 395px Guest QR Phone Simulator */}
        {splitView && (
          <aside
            aria-label="Guest QR Phone Simulator"
            className="flex flex-col items-center xl:col-span-4"
          >
            <div className="w-full max-w-[395px] overflow-hidden rounded-[2.5rem] border-[6px] border-[#262630] bg-[#111115] shadow-2xl">
              {/* Phone Notch / Status Header */}
              <div className="flex items-center justify-between border-b border-[#262630] bg-[#18181F] px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <Smartphone className="size-3.5 text-[#FF5412]" aria-hidden="true" />
                  <span className="font-mono text-[11px] font-semibold text-[#F4F4F5]">
                    Guest QR · Table T1 (395px)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Reload Guest QR Simulator"
                    onClick={() => setPhoneReloadKey((k) => k + 1)}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-[#262630] bg-[#111115] text-[#A1A1AA] hover:border-[#FF5412] hover:text-[#F4F4F5]"
                  >
                    <RefreshCw className="size-3" aria-hidden="true" />
                  </button>
                  <Link
                    href={guestUrl}
                    target="_blank"
                    aria-label="Open Guest QR in new tab"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-[#262630] bg-[#111115] text-[#A1A1AA] hover:border-[#FF5412] hover:text-[#F4F4F5]"
                  >
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <iframe
                key={`guest-phone-${phoneReloadKey}`}
                src={guestUrl}
                title="PlateBeam Guest QR Mobile Simulator"
                className="h-[74dvh] min-h-[590px] w-full border-0 bg-[#FAF7F2]"
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
