import Link from "next/link";
import { requireMegaAdmin } from "@/lib/admin-auth";
import { AdminSignOutButton } from "@/components/admin/admin-sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const links = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/labs", label: "Labs" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/analytics", label: "Analytics" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMegaAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between shadow-sm">
        <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Platform Admin</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AdminSignOutButton className="h-8 border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900" />
          <div className="h-7 w-7 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
            {user.fullName.charAt(0)}
          </div>
          <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] gap-5 px-4 py-5 lg:px-6">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sticky top-16">
            <nav className="space-y-0.5">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors font-medium"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-800 truncate">{user.fullName}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
              <span className="mt-2 inline-block text-[10px] font-semibold tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                MEGA ADMIN
              </span>
              <AdminSignOutButton className="mt-3 w-full justify-center border-gray-300 bg-white text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900" />
            </div>
          </div>
        </aside>

        {/* Mobile nav */}
        <div className="lg:hidden w-full">
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm mb-4 flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {link.label}
              </Link>
            ))}
            <AdminSignOutButton className="border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900" />
          </div>
          <div>{children}</div>
        </div>

        {/* Desktop main */}
        <div className="hidden lg:block min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
