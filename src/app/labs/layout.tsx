import type { ReactNode } from "react";

export default function LabsPublicLayout({ children }: { children: ReactNode }) {
  return (
    <div data-labs-root className="[color-scheme:light]" style={{ colorScheme: "light" }}>
      {children}
    </div>
  );
}
