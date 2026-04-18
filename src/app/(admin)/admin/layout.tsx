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
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-4 py-4 lg:px-6">
        <aside className="hidden w-56 shrink-0 rounded-lg border border-slate-200 bg-white p-3 lg:block">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Platform Admin
          </p>
          <nav className="mt-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 border-t border-slate-100 pt-3">
            <p className="truncate text-xs font-medium text-slate-700">{user.fullName}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
            <AdminSignOutButton className="mt-2 w-full justify-start text-xs" />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3 lg:hidden">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Platform Admin
            </p>
            <div className="flex flex-wrap gap-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700"
                >
                  {link.label}
                </Link>
              ))}
              <AdminSignOutButton className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:text-red-600" />
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
