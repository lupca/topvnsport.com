// Fixed-size placeholder shown inside <main> while the catalog loads: header/footer are already on
// screen, and min-h-svh matches <main>, so swapping in the real page shifts nothing.
export default function PageSkeleton() {
  return (
    <div id="page-skeleton" role="status" aria-label="Đang tải" className="max-w-[1280px] mx-auto px-4 md:px-[24px] pt-2 min-h-svh animate-pulse">
      <div className="h-8 w-40 mx-auto rounded bg-gray-200 mb-4" />
      <div className="flex gap-2 mb-6 overflow-hidden">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-11 w-24 shrink-0 rounded-full bg-gray-200" />)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="space-y-2">
            <div className="aspect-square rounded-xl bg-gray-200" />
            <div className="h-4 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
