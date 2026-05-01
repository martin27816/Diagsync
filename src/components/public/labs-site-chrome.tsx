import Link from "next/link";
import Image from "next/image";

export function LabsSiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/diagsync-logo.png"
            alt="Diagsync"
            width={32}
            height={32}
            className="h-8 w-8 rounded object-cover"
          />
          <span className="text-sm font-bold tracking-wide text-slate-900">DiagSync Public Labs</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex">
          <Link href="/labs" className="hover:text-slate-900">Directory</Link>
          <span className="text-slate-300">|</span>
          <Link href="/insights/reports" className="hover:text-slate-900">Insights</Link>
          <span className="text-slate-300">|</span>
          <Link href="/login" className="hover:text-slate-900">Lab Login</Link>
        </nav>
      </div>
    </header>
  );
}

export function LabsSiteFooter() {
  return (
    <footer className="mt-14 border-t border-slate-200 bg-slate-950 text-slate-200">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-300">DiagSync Directory</h3>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Trusted diagnostic lab ranking and profile discovery platform with city-level visibility and operational performance indicators.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-300">Explore</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li><Link href="/labs" className="hover:text-white">All Cities</Link></li>
            <li><Link href="/insights/reports" className="hover:text-white">Insights Reports</Link></li>
            <li><Link href="/login" className="hover:text-white">Staff Portal</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-300">Data Policy</h3>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Public pages use validated profile signals, website content extraction, and operational ranking metrics. Information updates regularly.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        © {new Date().getFullYear()} DiagSync. Public Lab Directory.
      </div>
    </footer>
  );
}
