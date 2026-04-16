import { useState, useEffect, useCallback } from "react";
import { fetchDeals, fetchPremiumDeals } from "../services/dealsApi";
import { dealMatchesType } from "../lib/dealClassifier";
import { Deal, UserProfile } from "@trace/shared";
import { getItem, setItem } from "../lib/storage";

function isInternationalDeal(deal: Deal): boolean | null {
  if (deal.domestic_or_international) {
    return deal.domestic_or_international.toLowerCase().includes("international");
  }
  if (deal.continent) {
    return !deal.continent.toLowerCase().includes("north america");
  }
  return null;
}

function dedupeByDestination(arr: Deal[]): Deal[] {
  const seen = new Set<string>();
  return arr.filter((d) => {
    if (seen.has(d.destination)) return false;
    seen.add(d.destination);
    return true;
  });
}

function sortByBestDeal(arr: Deal[]): Deal[] {
  return [...arr].sort((a, b) => {
    if ((b.discount_pct || 0) !== (a.discount_pct || 0))
      return (b.discount_pct || 0) - (a.discount_pct || 0);
    return (a.price || 0) - (b.price || 0);
  });
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

async function buildDailyDeck(
  deals: Deal[],
  storagePrefix: string,
  homeAirport: string
): Promise<Deal[]> {
  if (deals.length === 0) return [];

  const sorted = sortByBestDeal(deals);
  const cheapest = sorted[0];
  const rest = sorted.slice(1);

  const today = new Date().toISOString().split("T")[0];
  const shuffleKey = `${storagePrefix}_shuffle_${today}_${homeAirport}`;

  let shuffledRest: Deal[] = [];
  const stored = await getItem<string[]>(shuffleKey);
  if (stored) {
    const idToDeal = new Map(rest.map((d) => [d.id, d]));
    shuffledRest = stored.map((id) => idToDeal.get(id)!).filter(Boolean);
    const storedIds = new Set(stored);
    const missing = rest.filter((d) => !storedIds.has(d.id));
    shuffledRest.push(...missing);
  }

  if (shuffledRest.length === 0) {
    shuffledRest = shuffle(rest);
    await setItem(
      shuffleKey,
      shuffledRest.map((d) => d.id)
    );
  }

  return [cheapest, ...shuffledRest];
}

export function useDealFetch(profile: (UserProfile & { id: string }) | null) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [premiumDeals, setPremiumDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showingAllDeals, setShowingAllDeals] = useState(false);

  const load = useCallback(async () => {
    console.log("[useDealFetch] load called, profile:", profile?.id, profile?.homeAirport);
    if (!profile) {
      console.log("[useDealFetch] no profile, bailing");
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const airportCode = profile.homeAirport || "LAX";
      console.log("[useDealFetch] fetching deals for", airportCode);
      let apiDeals = await fetchDeals(airportCode);
      console.log("[useDealFetch] got", apiDeals.length, "deals");

      // Filter by destination preference
      let filteredDeals = apiDeals;
      if (profile.destinationPreference && profile.destinationPreference !== "both") {
        const wantInternational = profile.destinationPreference === "international";
        const filtered = apiDeals.filter((deal) => {
          const intl = isInternationalDeal(deal);
          if (intl === null) return false;
          return wantInternational ? intl : !intl;
        });
        if (filtered.length > 0) filteredDeals = filtered;
      }

      // Filter by deal type preferences
      if (
        profile.dealTypes &&
        profile.dealTypes.length > 0 &&
        !profile.dealTypes.includes("surprise")
      ) {
        const dealsWithType = filteredDeals.filter((deal) =>
          profile.dealTypes.some((type) => dealMatchesType(deal, type))
        );
        if (dealsWithType.length > 0) filteredDeals = dealsWithType;
      }

      // Filter by travel timeframe
      if (
        profile.travelTimeframe &&
        profile.travelTimeframe.length > 0 &&
        !profile.travelTimeframe.includes("no_preference")
      ) {
        const now = new Date();
        const filteredByTimeframe = filteredDeals.filter((deal) => {
          if (!deal.dateString) return true;
          const months = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december",
          ];
          let dealDate: Date;
          if (deal.dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
            dealDate = new Date(deal.dateString);
          } else {
            const monthStr = deal.dateString.toLowerCase().trim();
            const month = months.indexOf(monthStr);
            if (month === -1) return true;
            let year = now.getFullYear();
            dealDate = new Date(year, month, 1);
            if (dealDate < now) dealDate = new Date(year + 1, month, 1);
          }

          const twoMonths = new Date(now);
          twoMonths.setMonth(twoMonths.getMonth() + 2);
          const threeMonths = new Date(now);
          threeMonths.setMonth(threeMonths.getMonth() + 3);
          const sixMonths = new Date(now);
          sixMonths.setMonth(sixMonths.getMonth() + 6);

          if (
            profile.travelTimeframe.includes("immediately") ||
            profile.travelTimeframe.includes("next_few_weeks") ||
            profile.travelTimeframe.includes("next_1_2_months")
          ) {
            return dealDate >= now && dealDate < twoMonths;
          } else if (profile.travelTimeframe.includes("3_months_plus")) {
            return dealDate >= threeMonths && dealDate < sixMonths;
          }
          return true;
        });
        if (filteredByTimeframe.length > 0) filteredDeals = filteredByTimeframe;
      }

      // Build deck
      const preferredIds = new Set(filteredDeals.map((d) => d.id));
      const remainingDeals = apiDeals.filter((d) => !preferredIds.has(d.id));
      const dedupedPreferred = dedupeByDestination(sortByBestDeal(filteredDeals));
      const dedupedRemaining = dedupeByDestination(sortByBestDeal(remainingDeals));
      const finalDeals =
        filteredDeals.length > 0
          ? [...dedupedPreferred, ...dedupedRemaining]
          : dedupeByDestination(sortByBestDeal(apiDeals));

      const deckDeals = await buildDailyDeck(finalDeals, "deck", airportCode);
      setDeals(deckDeals);
      setShowingAllDeals(filteredDeals.length === 0);

      // Fetch premium deals for business users — clear them if the user
      // has downgraded so we don't keep showing business-class deals.
      if (profile.subscriptionStatus === "business") {
        try {
          const prem = await fetchPremiumDeals(airportCode);
          const bizDeck = await buildDailyDeck(prem, "business_deck", airportCode);
          setPremiumDeals(bizDeck);
        } catch {
          // silent fail
        }
      } else {
        setPremiumDeals([]);
      }
    } catch (error) {
      console.error("Failed to fetch deals:", error);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.homeAirport, profile?.subscriptionStatus, profile?.destinationPreference]);

  useEffect(() => {
    load();
  }, [load]);

  return { deals, premiumDeals, loading, showingAllDeals, reload: load };
}
