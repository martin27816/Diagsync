type Props = {
  insights: string[];
};

export function PatientInsights({ insights }: Props) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient Insights</p>
      <ul className="mt-2 space-y-1">
        {insights.map((insight, idx) => (
          <li key={`${insight}-${idx}`} className="text-xs text-slate-600">
            • {insight}
          </li>
        ))}
      </ul>
    </section>
  );
}

