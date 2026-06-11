import { useState, useEffect, useCallback } from "react";
import { fetchDeals, fetchPremiumDeals } from "../services/dealsApi";
import { dealMatchesType } from "../lib/dealClassifier";
import { weightedShuffle } from "../lib/dealScorer";
import { logEvent } from "../lib/analytics";
import { Deal, UserProfile } from "@trace/shared";


function isInternationalDeal(deal: Deal): boolean | null {
  if (deal.domestic_or_international) {
    return deal.domestic_or_international.toLowerCase().includes("international");
  }
  if (deal.continent) {
    return !deal.continent.toLowerCase().includes("north america");
  }
  return null;
}

// How many "closer to home" (domestic) deals to guarantee at the very front
// of a new deck, so a user's first cards are recognizable US destinations
// instead of an obscure international city the weighted shuffle happened to
// float to the top.
const LEAD_WITH_NEARBY_COUNT = 2;

/**
 * Pull the first couple of confidently-domestic deals to the front of the
 * deck. Skipped for users who explicitly chose international-only (we respect
 * their choice). Deals whose origin is unknown (isInternationalDeal === null)
 * are never used as the lead — only deals we're sure are domestic. The rest
 * of the deck keeps its existing (weighted-shuffled) order.
 */
function leadWithNearby(deck: Deal[], destinationPreference?: string): Deal[] {
  if (destinationPreference === "international") return deck;
  const leadIdx: number[] = [];
  for (let i = 0; i < deck.length && leadIdx.length < LEAD_WITH_NEARBY_COUNT; i++) {
    if (isInternationalDeal(deck[i]) === false) leadIdx.push(i);
  }
  if (leadIdx.length === 0) return deck;
  const picked = new Set(leadIdx);
  return [...leadIdx.map((i) => deck[i]), ...deck.filter((_, i) => !picked.has(i))];
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

      if (apiDeals.length === 0) {
        // API resolved but with no deals — the user lands on a blank
        // deck and bounces. We want this distinguishable from a
        // thrown error so we can tell "API broke" from "API is fine
        // but returned nothing for this airport".
        logEvent("deals_load_failed", {
          reason: "empty_response",
          airport: airportCode,
        });
      }

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

      // Final global dedup: if a destination appeared in BOTH the matched
      // and unmatched buckets (e.g. some Sydney deals matched preferences,
      // others didn't), one copy slipped through each bucket's individual
      // dedup pass. This catches those cross-bucket duplicates.
      const globalDeduped = dedupeByDestination(finalDeals);
      // Weighted-shuffle for variety, then guarantee the first couple of cards
      // are "closer to home" so a new user isn't greeted by an unfamiliar
      // international destination. Domestic-only decks are unaffected;
      // international-only users are exempted inside leadWithNearby.
      const deckDeals = leadWithNearby(
        weightedShuffle(globalDeduped),
        profile.destinationPreference
      );
      setDeals(deckDeals);
      setShowingAllDeals(filteredDeals.length === 0);

      // Fetch premium deals for business users — clear them if the user
      // has downgraded so we don't keep showing business-class deals.
      if (profile.subscriptionStatus === "business") {
        try {
          const prem = await fetchPremiumDeals(airportCode);
          setPremiumDeals(weightedShuffle(prem));
        } catch {
          // silent fail
        }
      } else {
        setPremiumDeals([]);
      }
    } catch (error) {
      console.error("Failed to fetch deals:", error);
      const message = error instanceof Error ? error.message : String(error);
      logEvent("deals_load_failed", {
        reason: "fetch_error",
        airport: profile.homeAirport || "LAX",
        error_message: message.slice(0, 200),
      });
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
