"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/analytics", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/promo-codes", label: "Promo codes" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/exclusions", label: "Exclusions" },
  { href: "/admin/spend", label: "Spend" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors " +
              (active
                ? "bg-rose-50 text-rose-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
