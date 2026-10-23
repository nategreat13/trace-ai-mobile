"use client";

import { useRouter } from "next/navigation";
import { ResultsView } from "@/components/results/ResultsView";

export default function DiscoverPage() {
  const router = useRouter();
  return <ResultsView mode="member" onOpen={(r) => router.push(`/trip/${r.trip.id}`)} onPaywall={() => {}} />;
}
