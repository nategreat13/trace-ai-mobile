"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/analytics", label: "Dashboard" },
  { href: "/cohorts", label: "Cohorts" },
  { href: "/users", label: "Users" },
  { href: "/devices", label: "Installs" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/promo-codes", label: "Promo codes" },
  { href: "/notifications", label: "Notifications" },
  { href: "/exclusions", label: "Exclusions" },
  { href: "/email-whitelist", label: "Email whitelist" },
  { href: "/spend", label: "Spend" },
  { href: "/audit", label: "Audit log" },
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
