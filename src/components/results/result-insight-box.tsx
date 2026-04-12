type Props = {
  messages: string[];
};

export function ResultInsightBox({ messages }: Props) {
  return (
    <section className="rounded-md border border-blue-100 bg-blue-50/60 p-3">
      <p className="text-xs font-semibold text-blue-700">System Note</p>
      <div className="mt-2 space-y-1">
        {messages.map((message, idx) => (
          <p key={`${message}-${idx}`} className="text-xs text-blue-900">
            {message}
          </p>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-blue-700">
        Final interpretation should be done by a medical professional.
      </p>
    </section>
  );
}

