export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(15,23,42)]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4" />
        <p className="text-gray-300">Loading Swavleba...</p>
      </div>
    </div>
  );
}
