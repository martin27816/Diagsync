export default function AdminLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-5 w-36 rounded-lg bg-gray-100" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-gray-100" />
    </div>
  );
}