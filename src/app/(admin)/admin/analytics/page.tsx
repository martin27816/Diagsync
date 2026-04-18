import { getAdminAnalytics } from "@/lib/admin-analytics";
import { requireMegaAdmin } from "@/lib/admin-auth";

export default async function AdminAnalyticsPage() {
  await requireMegaAdmin();
  const analytics = await getAdminAnalytics();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        .adm-table-row:hover td { background: rgba(0,255,136,0.04) !important; }
      `}</style>

      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 3, height: 18, background: "#00ccff", boxShadow: "0 0 8px #00ccff" }} />
          <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.22em", color: "#00ccff", margin: 0, fontFamily: "'Orbitron', monospace" }}>
            INTEL FEED
          </h1>
        </div>
        <p style={{ fontSize: 10, color: "rgba(0,204,255,0.35)", letterSpacing: "0.12em", margin: "0 0 0 11px" }}>
          GROWTH ANALYSIS & ACTIVITY INTELLIGENCE // ALL ORGANIZATIONS
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "GROWTH DATA POINTS", value: analytics.growthSeries.length, color: "#00ccff" },
          { label: "MOST ACTIVE LABS", value: analytics.activity.mostActiveLabs.length, color: "#00ff88" },
          { label: "ACTIVE TODAY", value: analytics.summary.activeToday, color: "#ffcc00" },
        ].map((c) => (
          <div key={c.label} style={{
            border: "1px solid rgba(0,204,255,0.15)",
            borderRadius: 3,
            background: "rgba(0,8,4,0.8)",
            padding: 16,
          }}>
            <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,204,255,0.35)", marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color, fontFamily: "'Orbitron', monospace" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Growth over time */}
      <div style={{ border: "1px solid rgba(0,204,255,0.18)", borderRadius: 3, background: "rgba(0,8,4,0.8)", overflow: "hidden" }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid rgba(0,204,255,0.12)",
          background: "rgba(0,204,255,0.03)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(0,204,255,0.5)" }}>◎</span>
          <span style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(0,204,255,0.6)", fontWeight: 600 }}>
            GROWTH TRAJECTORY — MONTHLY
          </span>
        </div>
        {analytics.growthSeries.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 11, color: "rgba(0,204,255,0.25)", letterSpacing: "0.1em" }}>
            [ INSUFFICIENT DATA — NO GROWTH RECORDS ]
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,204,255,0.1)" }}>
                  {["PERIOD", "LABS CREATED", "USERS CREATED"].map((h, i) => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: i > 0 ? "right" : "left",
                      fontSize: 8, letterSpacing: "0.18em", color: "rgba(0,204,255,0.35)",
                      fontWeight: 400, background: "rgba(0,204,255,0.02)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics.growthSeries.map((row) => (
                  <tr key={row.month} className="adm-table-row" style={{ borderBottom: "1px solid rgba(0,204,255,0.06)" }}>
                    <td style={{ padding: "10px 16px", color: "#00ccff", letterSpacing: "0.06em" }}>{row.month}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "#00ff88", fontFamily: "'Orbitron', monospace", fontWeight: 700 }}>{row.labs}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "#ffcc00", fontFamily: "'Orbitron', monospace", fontWeight: 700 }}>{row.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Most active labs */}
      <div style={{ border: "1px solid rgba(0,255,136,0.18)", borderRadius: 3, background: "rgba(0,8,4,0.8)", overflow: "hidden" }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid rgba(0,255,136,0.12)",
          background: "rgba(0,255,136,0.03)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(0,255,136,0.5)" }}>◈</span>
          <span style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(0,255,136,0.6)", fontWeight: 600 }}>
            HIGH-ACTIVITY TARGETS
          </span>
        </div>
        {analytics.activity.mostActiveLabs.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 11, color: "rgba(0,255,136,0.25)", letterSpacing: "0.1em" }}>
            [ NO ACTIVE TARGETS IDENTIFIED ]
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,255,136,0.1)" }}>
                  {["ENTITY", "CONTACT", "ACTIVITY INDEX"].map((h, i) => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: i === 2 ? "right" : "left",
                      fontSize: 8, letterSpacing: "0.18em", color: "rgba(0,255,136,0.35)",
                      fontWeight: 400, background: "rgba(0,255,136,0.02)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics.activity.mostActiveLabs.map((lab, idx) => (
                  <tr key={lab.organizationId ?? lab.name} className="adm-table-row" style={{ borderBottom: "1px solid rgba(0,255,136,0.06)" }}>
                    <td style={{ padding: "10px 16px", color: "#00ff88", fontWeight: 600 }}>
                      {idx === 0 && <span style={{ color: "#ffcc00", marginRight: 6 }}>▶</span>}
                      {lab.name}
                    </td>
                    <td style={{ padding: "10px 16px", color: "rgba(0,255,136,0.4)", fontSize: 10 }}>{lab.email || "—"}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "#00ccff", fontFamily: "'Orbitron', monospace", fontWeight: 700, fontSize: 14 }}>{lab.activityCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}