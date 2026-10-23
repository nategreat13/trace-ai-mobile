import { AppShell } from "@/components/app/AppShell";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
