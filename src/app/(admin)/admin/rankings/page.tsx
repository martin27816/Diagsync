import { RankingsTable } from "@/components/admin/rankings-table";
import { requireMegaAdmin } from "@/lib/admin-auth";
import { getAllRankings, type RankingPeriod } from "@/lib/ranking/get-all-rankings";

type PageProps = {
  searchParams?: { period?: string };
};

function parsePeriod(period: string | undefined): RankingPeriod {
  return period === "monthly" ? "monthly" : "weekly";
}

export default async function AdminRankingsPage({ searchParams }: PageProps) {
  await requireMegaAdmin();
  const period = parsePeriod(searchParams?.period);
  const data = await getAllRankings(period);

  return <RankingsTable period={period} items={data.items} topLab={data.topLab} />;
}
