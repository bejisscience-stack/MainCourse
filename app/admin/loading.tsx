export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-navy-950 pt-16 md:pt-20 flex">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex flex-col w-60 bg-navy-900/80 border-r border-navy-800/60 animate-pulse">
        <div className="px-4 py-4 border-b border-navy-800/60">
          <div className="h-4 w-16 bg-navy-800/80 rounded" />
        </div>
        <div className="p-2 space-y-2">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-10 bg-navy-800/40 rounded-xl" />
          ))}
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 animate-pulse">
        {/* Header bar */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-navy-800/40">
          <div className="h-6 w-40 bg-navy-800/50 rounded" />
          <div className="h-4 w-28 bg-navy-800/30 rounded mt-2" />
        </div>
        {/* Content area */}
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-28 bg-navy-900/50 border border-navy-800/60 rounded-2xl"
              />
            ))}
          </div>
          {/* Content area skeleton */}
          <div className="h-96 bg-navy-900/50 border border-navy-800/60 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
