import Link from "next/link";
import { listPlatformUsers } from "@/lib/admin-data";
import { requireMegaAdmin } from "@/lib/admin-auth";
import { formatDateTime } from "@/lib/utils";

type SearchParams = {
  page?: string;
  pageSize?: string;
  search?: string;
  role?: string;
  organizationId?: string;
  status?: string;
};

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireMegaAdmin();

  const page = Number(searchParams.page ?? "1");
  const pageSize = Number(searchParams.pageSize ?? "20");
  const search = searchParams.search ?? "";
  const role = searchParams.role ?? "";
  const organizationId = searchParams.organizationId ?? "";
  const status = searchParams.status ?? "";

  const data = await listPlatformUsers({
    page,
    pageSize,
    search: search || undefined,
    role: role || undefined,
    organizationId: organizationId || undefined,
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

  const roleColors: Record<string, string> = {
    MEGA_ADMIN: "#ff4444",
    SUPER_ADMIN: "#ffcc00",
    HRM: "#00ccff",
    RECEPTIONIST: "#00ff88",
    LAB_SCIENTIST: "#a78bfa",
    RADIOGRAPHER: "#fb923c",
    MD: "#34d399",
  };

  const statusColors: Record<string, string> = {
    ACTIVE: "#00ff88",
    INACTIVE: "rgba(0,255,136,0.3)",
    SUSPENDED: "#ff4444",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        .adm-input::placeholder { color: rgba(0,255,136,0.25); }
        .adm-input:focus { border-color: rgba(0,255,136,0.5) !important; box-shadow: 0 0 12px rgba(0,255,136,0.1); }
        .adm-select option { background: #020408; color: #00ff88; }
        .adm-table-row:hover td { background: rgba(0,255,136,0.04) !important; }
      `}</style>

      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 3, height: 18, background: "#00ccff", boxShadow: "0 0 8px #00ccff" }} />
          <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.22em", color: "#00ccff", margin: 0, fontFamily: "'Orbitron', monospace" }}>
            PERSONNEL DATABASE
          </h1>
        </div>
        <p style={{ fontSize: 10, color: "rgba(0,204,255,0.35)", letterSpacing: "0.12em", margin: "0 0 0 11px" }}>
          PLATFORM-WIDE IDENTITY RECORDS // ALL ORGANIZATIONS
        </p>
      </div>

      {/* Filter form */}
      <form style={{
        border: "1px solid rgba(0,204,255,0.15)",
        borderRadius: 3,
        background: "rgba(0,8,4,0.8)",
        padding: 14,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,204,255,0.3)", marginBottom: 5 }}>SEARCH</div>
          <input type="text" name="search" defaultValue={search} placeholder="NAME OR EMAIL..." className="adm-input" style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,204,255,0.3)", marginBottom: 5 }}>ORG ID</div>
          <input type="text" name="organizationId" defaultValue={organizationId} placeholder="ORGANIZATION ID..." className="adm-input" style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,204,255,0.3)", marginBottom: 5 }}>CLEARANCE LEVEL</div>
          <select name="role" defaultValue={role} className="adm-select" style={inputStyle}>
            <option value="">ALL ROLES</option>
            <option value="MEGA_ADMIN">MEGA_ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="HRM">HRM</option>
            <option value="RECEPTIONIST">RECEPTIONIST</option>
            <option value="LAB_SCIENTIST">LAB_SCIENTIST</option>
            <option value="RADIOGRAPHER">RADIOGRAPHER</option>
            <option value="MD">MD</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,204,255,0.3)", marginBottom: 5 }}>STATUS</div>
          <select name="status" defaultValue={status} className="adm-select" style={inputStyle}>
            <option value="">ALL STATUS</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </div>
        <button
          style={{
            gridColumn: "1 / -1",
            background: "rgba(0,204,255,0.08)",
            border: "1px solid rgba(0,204,255,0.35)",
            borderRadius: 2,
            padding: "9px",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "#00ccff",
            cursor: "pointer",
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          ▶ EXECUTE QUERY
        </button>
      </form>

      {/* Table */}
      <div style={{ border: "1px solid rgba(0,204,255,0.18)", borderRadius: 3, background: "rgba(0,8,4,0.8)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,204,255,0.12)", background: "rgba(0,204,255,0.02)" }}>
                {["IDENTITY", "CONTACT", "CLEARANCE", "ORGANIZATION", "LAST SIGNAL", "REGISTERED"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 8, letterSpacing: "0.18em",
                    color: "rgba(0,204,255,0.35)", fontWeight: 400,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px 14px", textAlign: "center", fontSize: 11, color: "rgba(0,204,255,0.25)", letterSpacing: "0.1em" }}>
                    [ NO PERSONNEL MATCH QUERY PARAMETERS ]
                  </td>
                </tr>
              ) : (
                data.items.map((user) => (
                  <tr key={user.id} className="adm-table-row" style={{ borderBottom: "1px solid rgba(0,204,255,0.06)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ color: "#00ccff", fontWeight: 600, letterSpacing: "0.03em", marginBottom: 2 }}>{user.name}</div>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 8, letterSpacing: "0.1em",
                        color: statusColors[user.status] ?? "rgba(0,204,255,0.4)",
                        border: `1px solid ${(statusColors[user.status] ?? "#00ccff")}33`,
                        background: `${(statusColors[user.status] ?? "#00ccff")}0d`,
                        padding: "1px 6px", borderRadius: 2,
                      }}>
                        <span style={{
                          width: 4, height: 4, borderRadius: "50%",
                          background: statusColors[user.status] ?? "rgba(0,204,255,0.4)",
                          flexShrink: 0,
                        }} />
                        {user.status}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "rgba(0,204,255,0.45)", fontSize: 10 }}>{user.email}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        fontSize: 8, letterSpacing: "0.1em",
                        color: roleColors[user.role] ?? "rgba(0,255,136,0.6)",
                        border: `1px solid ${(roleColors[user.role] ?? "#00ff88")}33`,
                        background: `${(roleColors[user.role] ?? "#00ff88")}0d`,
                        padding: "2px 7px", borderRadius: 2,
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "rgba(0,204,255,0.45)", fontSize: 10 }}>
                      {user.organization?.name ?? <span style={{ color: "rgba(255,204,0,0.6)" }}>PLATFORM</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "rgba(0,204,255,0.35)", fontSize: 10 }}>
                      {user.lastSeen ? formatDateTime(user.lastSeen) : <span style={{ color: "rgba(255,68,68,0.4)" }}>NO SIGNAL</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "rgba(0,204,255,0.35)", fontSize: 10 }}>{formatDateTime(user.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{
        border: "1px solid rgba(0,204,255,0.15)",
        borderRadius: 3,
        background: "rgba(0,8,4,0.8)",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 10, color: "rgba(0,204,255,0.35)", letterSpacing: "0.1em" }}>
          PAGE {data.page} / {Math.max(data.totalPages, 1)} &nbsp;·&nbsp; {data.total} RECORDS
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "◀ PREV", href: `/admin/users?page=${Math.max(1, data.page - 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&role=${role}&organizationId=${organizationId}&status=${status}`, disabled: data.page <= 1 },
            { label: "NEXT ▶", href: `/admin/users?page=${Math.min(data.totalPages || 1, data.page + 1)}&pageSize=${data.pageSize}&search=${encodeURIComponent(search)}&role=${role}&organizationId=${organizationId}&status=${status}`, disabled: data.page >= data.totalPages },
          ].map((btn) => (
            <Link key={btn.label} href={btn.href} style={{
              fontSize: 9, padding: "5px 12px",
              border: `1px solid ${btn.disabled ? "rgba(0,204,255,0.08)" : "rgba(0,204,255,0.3)"}`,
              borderRadius: 2,
              color: btn.disabled ? "rgba(0,204,255,0.2)" : "#00ccff",
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