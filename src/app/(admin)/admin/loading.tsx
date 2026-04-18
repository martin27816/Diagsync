export default function AdminLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        @keyframes adm-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .adm-skeleton {
          border-radius: 3px;
          background: linear-gradient(
            90deg,
            rgba(0,255,136,0.04) 25%,
            rgba(0,255,136,0.09) 50%,
            rgba(0,255,136,0.04) 75%
          );
          background-size: 800px 100%;
          animation: adm-shimmer 1.8s infinite linear;
          border: 1px solid rgba(0,255,136,0.1);
        }
        @keyframes adm-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .adm-cursor { animation: adm-blink 1s step-end infinite; color: #00ff88; }
      `}</style>

      {/* Header skeleton */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 18, background: "rgba(0,255,136,0.2)", borderRadius: 1 }} />
        <div className="adm-skeleton" style={{ height: 14, width: 200 }} />
        <span className="adm-cursor">▮</span>
      </div>

      {/* Cards skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="adm-skeleton" style={{ height: 80, opacity: 1 - i * 0.08 }} />
        ))}
      </div>

      {/* Table skeleton */}
      <div style={{ border: "1px solid rgba(0,255,136,0.1)", borderRadius: 3, overflow: "hidden" }}>
        <div className="adm-skeleton" style={{ height: 40, borderRadius: 0 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            height: 42,
            borderBottom: "1px solid rgba(0,255,136,0.06)",
            background: `rgba(0,255,136,${0.015 - i * 0.002})`,
            display: "flex", alignItems: "center", padding: "0 14px", gap: 20
          }}>
            <div className="adm-skeleton" style={{ height: 8, width: 120, opacity: 0.7 }} />
            <div className="adm-skeleton" style={{ height: 8, width: 160, opacity: 0.5 }} />
            <div className="adm-skeleton" style={{ height: 8, width: 60, opacity: 0.4 }} />
          </div>
        ))}
      </div>

      {/* Status line */}
      <div style={{ fontSize: 9, color: "rgba(0,255,136,0.3)", letterSpacing: "0.12em" }}>
        LOADING SECURE DATA<span className="adm-cursor">...</span>
      </div>
    </div>
  );
}