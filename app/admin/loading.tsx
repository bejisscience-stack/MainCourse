export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[rgb(15,23,42)] pt-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto animate-pulse">
        {/* Tab bar skeleton */}
        <div className="flex space-x-2 mb-8 overflow-x-auto">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-10 w-32 bg-navy-800/50 rounded-lg flex-shrink-0"
            />
          ))}
        </div>
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-navy-800/30 rounded-xl" />
          ))}
        </div>
        {/* Content area skeleton */}
        <div className="h-96 bg-navy-800/20 rounded-xl" />
      </div>
    </div>
  );
}
