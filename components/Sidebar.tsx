"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/customers", label: "Customers", icon: "◉" },
  { href: "/estimates", label: "Estimates", icon: "▤" },
  { href: "/proposals", label: "Proposals", icon: "✎" },
  { href: "/color-sheets", label: "Color Sheets", icon: "🎨" },
  { href: "/change-orders", label: "Change Orders", icon: "⇄" },
  { href: "/invoices", label: "Invoices", icon: "🧾" },
  { href: "/price-book", label: "Price Book", icon: "▦" },
  { href: "/budget", label: "Budget", icon: "$" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar({ showSignOut = false }: { showSignOut?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 248,
        flexShrink: 0,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "28px 18px",
      }}
    >
      <div style={{ padding: "0 8px 28px" }}>
        <div
          className="font-display"
          style={{
            fontSize: 34,
            letterSpacing: "0.04em",
            color: "var(--text-primary)",
            lineHeight: 1,
          }}
        >
          ACRES
        </div>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginTop: 6,
            fontWeight: 600,
          }}
        >
          Painting Co.
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 9,
                fontSize: 14.5,
                fontWeight: 600,
                textDecoration: "none",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                background: active ? "rgba(34,197,94,0.12)" : "transparent",
                border: active
                  ? "1px solid rgba(34,197,94,0.3)"
                  : "1px solid transparent",
                transition: "all 0.16s ease",
              }}
              className="nav-link"
            >
              <span
                style={{
                  width: 22,
                  textAlign: "center",
                  fontSize: 15,
                  opacity: active ? 1 : 0.7,
                }}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          padding: "16px 12px 0",
          borderTop: "1px solid var(--border-light)",
          fontSize: 12,
          color: "var(--text-dim)",
          lineHeight: 1.6,
        }}
      >
        <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>Koleson</div>
        Philadelphia Suburbs
        <div style={{ marginTop: 6, opacity: 0.7 }}>Internal CRM · localhost</div>
        {showSignOut && (
          <form action={logout} style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
              ↪ Sign out
            </button>
          </form>
        )}
      </div>

      <style>{`
        .nav-link:hover { background: var(--bg-card-hover) !important; color: var(--text-primary) !important; }
      `}</style>
    </aside>
  );
}
