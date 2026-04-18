import Link from "next/link";
import { requireMegaAdmin } from "@/lib/admin-auth";
import { AdminSignOutButton } from "@/components/admin/admin-sign-out-button";

const links = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/labs", label: "Labs" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/analytics", label: "Analytics" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMegaAdmin();

  return (
    <div className="min-h-screen bg-[#05070d] text-[#d7e3ff] [background-image:radial-gradient(circle_at_20%_0%,rgba(57,111,255,0.18),transparent_40%),radial-gradient(circle_at_90%_10%,rgba(0,201,255,0.12),transparent_35%),linear-gradient(180deg,#05070d_0%,#060a12_35%,#04060c_100%)]">
      <div className="mx-auto flex w-full max-w-[1440px] gap-4 px-4 py-4 lg:px-6">
        <aside className="hidden w-60 shrink-0 rounded-xl border border-cyan-500/20 bg-[#080d18]/85 p-3 shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_18px_40px_rgba(2,8,23,0.7)] backdrop-blur lg:block">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
            Platform Admin
          </p>
          <nav className="mt-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg border border-transparent px-2 py-2 text-sm text-[#b6c7ee] transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 border-t border-cyan-500/20 pt-3">
            <p className="truncate text-xs font-semibold text-cyan-100">{user.fullName}</p>
            <p className="truncate text-xs text-[#90a8d9]">{user.email}</p>
            <AdminSignOutButton className="mt-2 w-full justify-start text-xs" />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-xl border border-cyan-500/20 bg-[#080d18]/85 p-3 shadow-[0_10px_28px_rgba(2,8,23,0.65)] backdrop-blur lg:hidden">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
              Platform Admin
            </p>
            <div className="flex flex-wrap gap-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                >
                  {link.label}
                </Link>
              ))}
              <AdminSignOutButton className="rounded-lg border border-red-400/40 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20 hover:text-red-100" />
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
