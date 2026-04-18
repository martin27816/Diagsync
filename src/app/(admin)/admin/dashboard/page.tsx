import { getAdminAnalytics } from "@/lib/admin-analytics";
import { requireMegaAdmin } from "@/lib/admin-auth";

export default async function AdminDashboardPage() {
  await requireMegaAdmin();
  const analytics = await getAdminAnalytics();
  const summary = analytics.summary;

  const cards = [
    { label: "TOTAL LABS", value: summary.totalLabs, color: "#00ff88", alert: false },
    { label: "ACTIVE LABS", value: summary.activeLabs, color: "#00ff88", alert: false },
    { label: "SUSPENDED", value: summary.suspendedLabs, color: "#ff4444", alert: summary.suspendedLabs > 0 },
    { label: "TOTAL USERS", value: summary.totalUsers, color: "#00ccff", alert: false },
    { label: "TOTAL PATIENTS", value: summary.totalPatients, color: "#00ccff", alert: false },
    { label: "ACTIVE TODAY", value: summary.activeToday, color: "#ffcc00", alert: false },
    { label: "TEST REQUESTS", value: summary.totalTestRequests, color: "#00ccff", alert: false },
    { label: "LABS THIS MONTH", value: summary.labsCreatedThisMonth, color: "#00ff88", alert: false },
    { label: "USERS ACTIVE / WEEK", value: summary.usersActiveThisWeek, color: "#ffcc00", alert: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        .adm-metric-card {
          border-radius: 3px;
          padding: 16px;
          position: relative;
          overflow: hidden;
          transition: all 0.2s;
        }
        .adm-metric-card:hover {
          transform: translateY(-1px);
        }
        .adm-metric-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
        }
        .adm-table-row:hover td {
          background: rgba(0,255,136,0.04) !important;
        }
        @keyframes adm-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .adm-alert { animation: adm-pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Page header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 3, height: 18, background: "#00ff88", boxShadow: "0 0 8px #00ff88" }} />
          <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.22em", color: "#00ff88", margin: 0, fontFamily: "'Orbitron', monospace" }}>
            COMMAND CENTER
          </h1>
        </div>
        <p style={{ fontSize: 10, color: "rgba(0,255,136,0.35)", letterSpacing: "0.12em", margin: "0 0 0 11px" }}>
          REAL-TIME PLATFORM METRICS // ALL ORGANIZATIONS
        </p>
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
        {cards.map((card) => (
          <div
            key={card.label}
            className="adm-metric-card"
            style={{
              background: "rgba(0,8,4,0.8)",
              border: `1px solid ${card.alert ? "rgba(255,68,68,0.4)" : "rgba(0,255,136,0.15)"}`,
              boxShadow: card.alert ? "0 0 20px rgba(255,68,68,0.1)" : "none",
            }}
          >
            {card.alert && (
              <div className="adm-alert" style={{
                position: "absolute", top: 8, right: 8,
                width: 6, height: 6, borderRadius: "50%",
                background: "#ff4444",
                boxShadow: "0 0 6px #ff4444",
              }} />
            )}
            <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,255,136,0.35)", marginBottom: 8 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color, fontFamily: "'Orbitron', monospace", letterSpacing: "0.05em", lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ marginTop: 8, height: 1, background: `${card.color}22` }} />
          </div>
        ))}
      </div>

      {/* Most active labs table */}
      <div style={{
        border: "1px solid rgba(0,255,136,0.18)",
        borderRadius: 3,
        background: "rgba(0,8,4,0.8)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(0,255,136,0.12)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(0,255,136,0.03)",
        }}>
          <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "rgba(0,255,136,0.5)" }}>◎</span>
          <span style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(0,255,136,0.6)", fontWeight: 600 }}>
            MOST ACTIVE LABS — THIS WEEK
          </span>
        </div>

        {analytics.activity.mostActiveLabs.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 11, color: "rgba(0,255,136,0.25)", letterSpacing: "0.1em" }}>
            [ NO LAB ACTIVITY DETECTED THIS WEEK ]
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,255,136,0.1)" }}>
                  {["LAB ENTITY", "EMAIL", "ACTIVITY COUNT"].map((h, i) => (
                    <th key={h} style={{
                      padding: "10px 16px",
                      textAlign: i === 2 ? "right" : "left",
                      fontSize: 8,
                      letterSpacing: "0.18em",
                      color: "rgba(0,255,136,0.35)",
                      fontWeight: 400,
                      background: "rgba(0,255,136,0.02)",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics.activity.mostActiveLabs.map((lab, idx) => (
                  <tr
                    key={lab.organizationId ?? lab.name}
                    className="adm-table-row"
                    style={{ borderBottom: "1px solid rgba(0,255,136,0.06)" }}
                  >
                    <td style={{ padding: "10px 16px", color: "#00ff88", fontWeight: 600, letterSpacing: "0.04em" }}>
                      {idx === 0 && <span style={{ color: "#ffcc00", marginRight: 6, fontSize: 10 }}>▶</span>}
                      {lab.name}
                    </td>
                    <td style={{ padding: "10px 16px", color: "rgba(0,255,136,0.45)", fontSize: 10 }}>{lab.email || "—"}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "#00ccff", fontFamily: "'Orbitron', monospace", fontSize: 13, fontWeight: 700 }}>
                      {lab.activityCount}
                    </td>
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