export default function CoursesLoading() {
  return (
    <div className="min-h-screen bg-[rgb(15,23,42)] pt-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-navy-800/50 rounded-lg mb-8 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl bg-navy-800/30 animate-pulse">
              <div className="h-44 bg-navy-700/50 rounded-t-xl" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-3/4 bg-navy-700/50 rounded" />
                <div className="h-4 w-1/2 bg-navy-700/50 rounded" />
                <div className="h-9 w-full bg-navy-700/50 rounded-lg mt-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
