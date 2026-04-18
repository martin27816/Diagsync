import Link from "next/link";
import { listOrganizations } from "@/lib/admin-data";
import { requireMegaAdmin } from "@/lib/admin-auth";
import { formatDateTime } from "@/lib/utils";
import { activateLabAction, suspendLabAction } from "./actions";

type SearchParams = {
  page?: string;
  pageSize?: string;
  search?: string;
  plan?: string;
  status?: string;
};

export default async function AdminLabsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireMegaAdmin();

  const page = Number(searchParams.page ?? "1");
  const pageSize = Number(searchParams.pageSize ?? "20");
  const search = searchParams.search ?? "";
  const plan = searchParams.plan ?? "";
  const status = searchParams.status ?? "";

  const data = await listOrganizations({
    page,
    pageSize,
    search: search || undefined,
    plan: plan || undefined,
    status: status || undefined,
  });

  const inputStyle: React.CSSProperties = {
    background: "rgba(0,8,4,0.8)",
    border: "1px solid rgba(0,255,136,0.2)",
    borderRadius: 2,
    padding: "8px 12px",
    fontSize: 11,
    color: "#00ff88",
    letterSpacing: "0.06em",
    outline: "none",
    width: "100%",
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        .adm-input::placeholder { color: rgba(0,255,136,0.25); }
        .adm-input:focus { border-color: rgba(0,255,136,0.5) !important; box-shadow: 0 0 12px rgba(0,255,136,0.1); }
        .adm-select option { background: #020408; color: #00ff88; }
        .adm-table-row:hover td { background: rgba(0,255,136,0.04) !important; }
        .adm-btn-suspend:hover { background: rgba(255,68,68,0.15) !important; border-color: rgba(255,68,68,0.6) !important; }
        .adm-btn-activate:hover { background: rgba(0,255,136,0.12) !important; border-color: rgba(0,255,136,0.6) !important; }
        .adm-btn-view:hover { background: rgba(0,204,255,0.1) !important; border-color: rgba(0,204,255,0.5) !important; color: #00ccff !important; }
      `}</style>

      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 3, height: 18, background: "#00ff88", boxShadow: "0 0 8px #00ff88" }} />
          <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.22em", color: "#00ff88", margin: 0, fontFamily: "'Orbitron', monospace" }}>
            LAB REGISTRY
          </h1>
        </div>
        <p style={{ fontSize: 10, color: "rgba(0,255,136,0.35)", letterSpacing: "0.12em", margin: "0 0 0 11px" }}>
          MONITOR & CONTROL ALL REGISTERED ORGANIZATIONS
        </p>
      </div>

      {/* Filter form */}
      <form style={{
        border: "1px solid rgba(0,255,136,0.15)",
        borderRadius: 3,
        background: "rgba(0,8,4,0.8)",
        padding: 14,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr auto",
        gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,255,136,0.3)", marginBottom: 5 }}>SEARCH</div>
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="LAB NAME OR EMAIL..."
            className="adm-input"
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,255,136,0.3)", marginBottom: 5 }}>PLAN TIER</div>
          <select name="plan" defaultValue={plan} className="adm-select" style={inputStyle}>
            <option value="">ALL TIERS</option>
            <option value="STARTER">STARTER</option>
            <option value="ENTERPRISE">ENTERPRISE</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,255,136,0.3)", marginBottom: 5 }}>STATUS</div>
          <select name="status" defaultValue={status} className="adm-select" style={inputStyle}>
            <option value="">ALL STATUS</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button style={{
            background: "rgba(0,255,136,0.1)",
            border: "1px solid rgba(0,255,136,0.4)",
            borderRadius: 2,
            padding: "8px 16px",
            fontSize: 10,
            letterSpacing: "0.16em",
            color: "#00ff88",
            cursor: "pointer",
            fontFamily: "'Share Tech Mono', monospace",
            whiteSpace: "nowrap",
          }}>
            ▶ EXECUTE
          </button>
        </div>
      </form>

      {/* Table */}
      <div style={{ border: "1px solid rgba(0,255,136,0.18)", borderRadius: 3, background: "rgba(0,8,4,0.8)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,255,136,0.12)", background: "rgba(0,255,136,0.03)" }}>
                {["LAB ENTITY", "CONTACT", "TIER", "STATUS", "USERS", "REGISTERED", "LAST SIGNAL", "ACTIONS"].map((h, i) => (
                  <th key={h} style={{
                    padding: "10px 14px",
                    textAlign: i === 4 ? "right" : "left",
                    fontSize: 8, letterSpacing: "0.18em",
                    color: "rgba(0,255,136,0.35)", fontWeight: 400,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "32px 14px", textAlign: "center", fontSize: 11, color: "rgba(0,255,136,0.25)", letterSpacing: "0.1em" }}>
                    [ NO TARGETS MATCH QUERY PARAMETERS ]
                  </td>
                </tr>
              ) : (
                data.items.map((lab) => (
                  <tr key={lab.id} className="adm-table-row" style={{ borderBottom: "1px solid rgba(0,255,136,0.06)" }}>
                    <td style={{ padding: "10px 14px", color: "#00ff88", fontWeight: 600, letterSpacing: "0.03em" }}>{lab.name}</td>
                    <td style={{ padding: "10px 14px", color: "rgba(0,255,136,0.45)", fontSize: 10 }}>{lab.email}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        fontSize: 8, letterSpacing: "0.1em",
                        color: lab.plan === "ENTERPRISE" ? "rgba(255,204,0,0.85)" : "rgba(0,204,255,0.7)",
                        border: `1px solid ${lab.plan === "ENTERPRISE" ? "rgba(255,204,0,0.25)" : "rgba(0,204,255,0.2)"}`,
                        background: lab.plan === "ENTERPRISE" ? "rgba(255,204,0,0.06)" : "rgba(0,204,255,0.05)",
                        padding: "2px 7px", borderRadius: 2,
                      }}>
                        {lab.plan}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        fontSize: 8, letterSpacing: "0.1em",
                        color: lab.status === "ACTIVE" ? "#00ff88" : "#ff4444",
                        border: `1px solid ${lab.status === "ACTIVE" ? "rgba(0,255,136,0.3)" : "rgba(255,68,68,0.3)"}`,
                        background: lab.status === "ACTIVE" ? "rgba(0,255,136,0.07)" : "rgba(255,68,68,0.07)",
                        padding: "2px 7px", borderRadius: 2,
                        display: "flex", alignItems: "center", gap: 4, width: "fit-content",
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: lab.status === "ACTIVE" ? "#00ff88" : "#ff4444",
                          boxShadow: `0 0 4px ${lab.status === "ACTIVE" ? "#00ff88" : "#ff4444"}`,
                          flexShrink: 0,
                        }} />
                        {lab.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#00ccff", fontFamily: "'Orbitron', monospace", fontWeight: 700 }}>{lab.totalUsers}</td>
                    <td style={{ padding: "10px 14px", color: "rgba(0,255,136,0.35)", fontSize: 10 }}>{formatDateTime(lab.createdAt)}</td>
                    <td style={{ padding: "10px 14px", color: "rgba(0,255,136,0.35)", fontSize: 10 }}>
                      {lab.lastActivity ? formatDateTime(lab.lastActivity) : <span style={{ color: "rgba(255,68,68,0.4)" }}>NO SIGNAL</span>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Link href={`/admin/labs/${lab.id}`} className="adm-btn-view" style={{
                          fontSize: 9, padding: "4px 9px",
                          border: "1px solid rgba(0,204,255,0.25)",
                          borderRadius: 2, color: "rgba(0,204,255,0.7)",
                          textDecoration: "none", letterSpacing: "0.1em",
                          transition: "all 0.15s",
                        }}>
                          VIEW
                        </Link>
                        {lab.status === "ACTIVE" ? (
                          <form action={suspendLabAction}>
                            <input type="hidden" name="organizationId" value={lab.id} />
                            <button className="adm-btn-suspend" style={{
                              fontSize: 9, padding: "4px 9px",
                              border: "1px solid rgba(255,68,68,0.3)",
                              borderRadius: 2, color: "rgba(255,68,68,0.75)",
                              cursor: "pointer", letterSpacing: "0.1em",
                              background: "transparent",
                              fontFamily: "'Share Tech Mono', monospace",
                              transition: "all 0.15s",
                            }}>
                              SUSPEND
                            </button>
                          </form>
                        ) : (
                          <form action={activateLabAction}>
                            <input type="hidden" name="organizationId" value={lab.id} />
                            <button className="adm-btn-activate" style={{
                              fontSize: 9, padding: "4px 9px",
                              border: "1px solid rgba(0,255,136,0.3)",
                              borderRadius: 2, color: "rgba(0,255,136,0.75)",
                              cursor: "pointer", letterSpacing: "0.1em",
                              background: "transparent",
                              fontFamily: "'Share Tech Mono', monospace",
                              transition: "all 0.15s",
                            }}>
                              ACTIVATE
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{
        border: "1px solid rgba(0,255,136,0.15)",
        borderRadius: 3,
        background: "rgba(0,8,4,0.8)",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 10, color: "rgba(0,255,136,0.35)", letterSpacing: "0.1em" }}>
          PAGE {data.page} / {Math.max(data.totalPages, 1)} &nbsp;·&nbsp; {data.total} RECORDS
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "◀ PREV", href: `/admin/labs?page=${Math.max(1, data.page - 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&plan=${plan}&status=${status}`, disabled: data.page <= 1 },
            { label: "NEXT ▶", href: `/admin/labs?page=${Math.min(data.totalPages || 1, data.page + 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&plan=${plan}&status=${status}`, disabled: data.page >= data.totalPages },
          ].map((btn) => (
            <Link key={btn.label} href={btn.href} style={{
              fontSize: 9, padding: "5px 12px",
              border: `1px solid ${btn.disabled ? "rgba(0,255,136,0.08)" : "rgba(0,255,136,0.3)"}`,
              borderRadius: 2,
              color: btn.disabled ? "rgba(0,255,136,0.2)" : "#00ff88",
              textDecoration: "none", letterSpacing: "0.12em",
              pointerEvents: btn.disabled ? "none" : "auto",
            }}>
              {btn.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}