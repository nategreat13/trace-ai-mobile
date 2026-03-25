import { redirect } from "next/navigation";

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; email?: string }>;
}) {
  const params = await searchParams;
  const plan = params.plan === "business" ? "business" : "premium";
  const qs = params.email ? `?email=${encodeURIComponent(params.email)}` : "";
  redirect(`/subscribe/${plan}${qs}`);
}
