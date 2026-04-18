import Link from "next/link";
import { requireMegaAdmin } from "@/lib/admin-auth";

const links = [
  { href: "/admin/dashboard", label: "COMMAND CENTER", icon: "⬡" },
  { href: "/admin/labs", label: "LAB REGISTRY", icon: "◈" },
  { href: "/admin/users", label: "PERSONNEL", icon: "◉" },
  { href: "/admin/analytics", label: "INTEL FEED", icon: "◎" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMegaAdmin();

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#020408",
        backgroundImage: `
          radial-gradient(ellipse at 20% 0%, rgba(0,255,136,0.05) 0%, transparent 55%),
          radial-gradient(ellipse at 80% 100%, rgba(0,160,255,0.04) 0%, transparent 55%),
          repeating-linear-gradient(0deg, transparent, transparent 49px, rgba(0,255,136,0.025) 49px, rgba(0,255,136,0.025) 50px),
          repeating-linear-gradient(90deg, transparent, transparent 49px, rgba(0,255,136,0.025) 49px, rgba(0,255,136,0.025) 50px)
        `,
        fontFamily: "'Courier New', Courier, monospace",
        color: "#a0ffcc",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap');
        .adm { font-family: 'Share Tech Mono', 'Courier New', monospace; }
        .adm-title { font-family: 'Orbitron', monospace; }
        @keyframes adm-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes adm-flicker { 0%,19%,21%,23%,25%,54%,56%,100%{opacity:1} 20%,24%,55%{opacity:0.7} }
        .adm-blink { animation: adm-blink 1.2s step-end infinite; }
        .adm-flicker { animation: adm-flicker 10s linear infinite; }
        .adm-nav-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          font-size: 10px;
          letter-spacing: 0.14em;
          color: rgba(0,255,136,0.5);
          border: 1px solid transparent;
          border-radius: 2px;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .adm-nav-link:hover {
          color: #00ff88;
          border-color: rgba(0,255,136,0.35);
          background: rgba(0,255,136,0.07);
          box-shadow: 0 0 16px rgba(0,255,136,0.12), inset 0 0 8px rgba(0,255,136,0.05);
          padding-left: 16px;
        }
        .adm-card {
          border: 1px solid rgba(0,255,136,0.18);
          border-radius: 3px;
          background: rgba(0,8,4,0.8);
          backdrop-filter: blur(10px);
        }
        .adm-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #00ff88;
          box-shadow: 0 0 6px #00ff88, 0 0 14px rgba(0,255,136,0.5);
          flex-shrink: 0;
        }
      `}</style>

      {/* TOP BAR */}
      <header style={{
        borderBottom: "1px solid rgba(0,255,136,0.12)",
        background: "rgba(2,4,8,0.9)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "9px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="adm-dot adm-blink" />
          <span className="adm-title adm-flicker" style={{ fontSize: 10, letterSpacing: "0.28em", color: "#00ff88", fontWeight: 700 }}>
            DIAGSYNC // MEGA ADMIN TERMINAL
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 9, color: "rgba(0,255,136,0.35)", letterSpacing: "0.12em" }}>
            CLEARANCE: <span style={{ color: "rgba(255,60,60,0.85)" }}>LEVEL 5</span>
          </span>
          <span style={{ fontSize: 9, color: "rgba(0,255,136,0.4)", letterSpacing: "0.1em" }}>
            SESSION ACTIVE <span className="adm-blink" style={{ color: "#00ff88" }}>▮</span>
          </span>
        </div>
      </header>

      <div style={{ display: "flex", maxWidth: 1400, margin: "0 auto", padding: "16px", gap: 14 }}>

        {/* SIDEBAR desktop */}
        <aside className="adm hidden lg:block" style={{ width: 210, flexShrink: 0 }}>
          <div className="adm-card" style={{ padding: 14, position: "sticky", top: 52 }}>
            <div style={{
              fontSize: 9, letterSpacing: "0.18em", color: "rgba(255,50,50,0.8)",
              padding: "4px 8px", border: "1px solid rgba(255,50,50,0.25)",
              background: "rgba(255,50,50,0.06)", borderRadius: 2,
              marginBottom: 14, textAlign: "center",
            }}>
              ⚠ TOP SECRET / SCI
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="adm-nav-link">
                  <span style={{ color: "rgba(0,255,136,0.35)", fontSize: 12 }}>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </nav>
            <div style={{ margin: "16px 0", height: 1, background: "rgba(0,255,136,0.1)" }} />
            <div>
              <div style={{ fontSize: 8, color: "rgba(0,255,136,0.3)", letterSpacing: "0.18em", marginBottom: 8 }}>OPERATOR IDENTIFICATION</div>
              <div style={{ fontSize: 11, color: "#00ff88", letterSpacing: "0.04em", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.fullName}
              </div>
              <div style={{ fontSize: 10, color: "rgba(0,255,136,0.38)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </div>
              <div style={{
                marginTop: 10, display: "inline-block", fontSize: 8, letterSpacing: "0.12em",
                color: "rgba(255,180,0,0.85)", background: "rgba(255,180,0,0.07)",
                border: "1px solid rgba(255,180,0,0.25)", padding: "3px 7px", borderRadius: 2,
              }}>
                ◈ MEGA_ADMIN
              </div>
            </div>
            <div style={{ marginTop: 20, fontSize: 8, color: "rgba(0,255,136,0.18)", letterSpacing: "0.08em", lineHeight: 1.9 }}>
              UNAUTHORIZED ACCESS IS A<br />FEDERAL CRIME — 18 U.S.C § 1030<br />ALL ACTIONS ARE LOGGED
            </div>
          </div>
        </aside>

        {/* MOBILE NAV */}
        <div className="adm lg:hidden w-full">
          <div className="adm-card" style={{ padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 8, color: "rgba(255,50,50,0.7)", letterSpacing: "0.2em", marginBottom: 8 }}>⚠ TOP SECRET // PLATFORM CONTROL</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {links.map((link) => (
                <Link key={link.href} href={link.href} style={{
                  fontSize: 9, padding: "5px 10px", border: "1px solid rgba(0,255,136,0.3)",
                  borderRadius: 2, color: "#00ff88", textDecoration: "none",
                  letterSpacing: "0.1em", background: "rgba(0,255,136,0.04)",
                }}>
                  {link.icon} {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>{children}</div>
        </div>

        {/* DESKTOP MAIN */}
        <div className="adm hidden lg:block min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}