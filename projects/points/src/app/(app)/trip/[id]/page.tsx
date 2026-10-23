"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { TripDetail } from "@/components/TripDetail";
import { evalAll } from "@/engine/engine";
import { useDeck } from "@/lib/store";

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { input } = useDeck();
  // Every trip, not just the deck, so planned and far-off trips open too.
  const r = evalAll(input).find((x) => x.trip.id === id);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!r) {
    return <p className="p-6 text-muted">That trip isn&apos;t available from {input.origin}.</p>;
  }
  return (
    <TripDetail
      r={r}
      mode="member"
      onBack={() => (window.history.length > 1 ? router.back() : router.push("/discover"))}
      onUnlock={() => {}}
    />
  );
}
