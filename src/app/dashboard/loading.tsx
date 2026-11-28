export default function DashboardLoading() {
  return (
    <div className="grid-bg flex min-h-dvh flex-col bg-[#09090B] text-[#F4F4F5]">
      <header className="border-b border-[#262630] bg-[#111115]/90 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 animate-pulse rounded-xl bg-[#18181F]" />
            <div className="space-y-1.5">
              <div className="h-5 w-36 animate-pulse rounded bg-[#18181F]" />
              <div className="h-3 w-48 animate-pulse rounded bg-[#18181F]" />
            </div>
          </div>
          <div className="h-11 w-28 animate-pulse rounded-xl bg-[#18181F]" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-32 animate-pulse rounded-2xl border border-[#262630] bg-[#111115] p-4"
            />
          ))}
        </div>
        <div className="h-11 w-full max-w-2xl animate-pulse rounded-xl bg-[#111115]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl border border-[#262630] bg-[#111115]" />
          <div className="h-72 animate-pulse rounded-2xl border border-[#262630] bg-[#111115]" />
        </div>
      </main>
    </div>
  );
}
