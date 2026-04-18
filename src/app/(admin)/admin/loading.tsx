import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-44 bg-cyan-500/20" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-24 border border-cyan-500/20 bg-[#0a1321]" />
        <Skeleton className="h-24 border border-cyan-500/20 bg-[#0a1321]" />
        <Skeleton className="h-24 border border-cyan-500/20 bg-[#0a1321]" />
      </div>
      <Skeleton className="h-72 border border-cyan-500/20 bg-[#0a1321]" />
    </div>
  );
}
