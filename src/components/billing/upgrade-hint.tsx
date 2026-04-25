"use client";

import Link from "next/link";

type UpgradeHintProps = {
  message: string;
  href?: string;
  ctaLabel?: string;
  className?: string;
};

export function UpgradeHint({
  message,
  href = "/dashboard/billing",
  ctaLabel = "Upgrade plan",
  className = "",
}: UpgradeHintProps) {
  return (
    <div className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 ${className}`}>
      <p>{message}</p>
      <Link href={href} className="mt-1 inline-flex font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900">
        {ctaLabel}
      </Link>
    </div>
  );
}

