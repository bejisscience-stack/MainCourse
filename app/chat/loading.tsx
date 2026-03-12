export default function ChatLoading() {
  return (
    <div className="flex flex-col h-screen bg-[rgb(15,23,42)]">
      <div className="h-16 bg-navy-900/50 border-b border-navy-800/30 animate-pulse" />
      <div className="flex-1 flex">
        {/* Sidebar skeleton */}
        <div className="w-64 bg-navy-900/30 border-r border-navy-800/30 p-4 space-y-4 hidden md:block animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-navy-700/50 rounded" />
              <div className="h-8 w-full bg-navy-700/30 rounded" />
              <div className="h-8 w-full bg-navy-700/30 rounded" />
            </div>
          ))}
        </div>
        {/* Main area skeleton */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4" />
            <p className="text-gray-300">Loading chat...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
