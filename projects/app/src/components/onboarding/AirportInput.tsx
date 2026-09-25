import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { MapPin, BellRing, Check } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { findUnserved, nearestServed, type GeoAirport } from "../../lib/airportGeo";
import { createAirportRequest } from "../../services/firestore";
import { useAuth } from "../../context/AuthContext";
import { logEvent } from "../../lib/analytics";

export interface Airport {
  code: string;
  name: string;
  city: string;
  state: string;
}

// Only airports we actually service — deals are fetched for these codes only.
// Airports we actually have deals from — used for the home airport picker in onboarding.
export const HOME_AIRPORTS: Airport[] = [
  { code: "ATL", name: "Hartsfield-Jackson Atlanta International", city: "Atlanta", state: "GA" },
  { code: "AUS", name: "Austin-Bergstrom International", city: "Austin", state: "TX" },
  { code: "BOS", name: "Logan International", city: "Boston", state: "MA" },
  { code: "CLT", name: "Charlotte Douglas International", city: "Charlotte", state: "NC" },
  { code: "DEN", name: "Denver International", city: "Denver", state: "CO" },
  { code: "DFW", name: "Dallas/Fort Worth International", city: "Dallas", state: "TX" },
  { code: "DTW", name: "Detroit Metropolitan Wayne County", city: "Detroit", state: "MI" },
  { code: "EWR", name: "Newark Liberty International", city: "Newark", state: "NJ" },
  { code: "FLL", name: "Fort Lauderdale-Hollywood International", city: "Fort Lauderdale", state: "FL" },
  { code: "IAH", name: "George Bush Intercontinental", city: "Houston", state: "TX" },
  { code: "JFK", name: "John F. Kennedy International", city: "New York", state: "NY" },
  { code: "LAS", name: "Harry Reid International", city: "Las Vegas", state: "NV" },
  { code: "LAX", name: "Los Angeles International", city: "Los Angeles", state: "CA" },
  { code: "MCO", name: "Orlando International", city: "Orlando", state: "FL" },
  { code: "MIA", name: "Miami International", city: "Miami", state: "FL" },
  { code: "MSP", name: "Minneapolis-Saint Paul International", city: "Minneapolis", state: "MN" },
  { code: "ORD", name: "O'Hare International", city: "Chicago", state: "IL" },
  { code: "PHL", name: "Philadelphia International", city: "Philadelphia", state: "PA" },
  { code: "PHX", name: "Phoenix Sky Harbor International", city: "Phoenix", state: "AZ" },
  { code: "SAN", name: "San Diego International", city: "San Diego", state: "CA" },
  { code: "SEA", name: "Seattle-Tacoma International", city: "Seattle", state: "WA" },
  { code: "SFO", name: "San Francisco International", city: "San Francisco", state: "CA" },
  { code: "SLC", name: "Salt Lake City International", city: "Salt Lake City", state: "UT" },
];

// Full airport list for destination search in Explore.
export const AIRPORTS: Airport[] = [
  ...HOME_AIRPORTS,
  // Additional US airports
  { code: "ABQ", name: "Albuquerque International Sunport", city: "Albuquerque", state: "NM" },
  { code: "ANC", name: "Ted Stevens Anchorage International", city: "Anchorage", state: "AK" },
  { code: "BHM", name: "Birmingham-Shuttlesworth International", city: "Birmingham", state: "AL" },
  { code: "BOI", name: "Boise Airport", city: "Boise", state: "ID" },
  { code: "BNA", name: "Nashville International", city: "Nashville", state: "TN" },
  { code: "BUF", name: "Buffalo Niagara International", city: "Buffalo", state: "NY" },
  { code: "BUR", name: "Hollywood Burbank Airport", city: "Burbank", state: "CA" },
  { code: "CHS", name: "Charleston International", city: "Charleston", state: "SC" },
  { code: "CID", name: "Eastern Iowa Airport", city: "Cedar Rapids", state: "IA" },
  { code: "CLE", name: "Cleveland Hopkins International", city: "Cleveland", state: "OH" },
  { code: "CMH", name: "John Glenn Columbus International", city: "Columbus", state: "OH" },
  { code: "COS", name: "Colorado Springs Airport", city: "Colorado Springs", state: "CO" },
  { code: "CVG", name: "Cincinnati/Northern Kentucky International", city: "Cincinnati", state: "OH" },
  { code: "DAL", name: "Dallas Love Field", city: "Dallas", state: "TX" },
  { code: "DAY", name: "Dayton International", city: "Dayton", state: "OH" },
  { code: "ELP", name: "El Paso International", city: "El Paso", state: "TX" },
  { code: "EUG", name: "Eugene Airport", city: "Eugene", state: "OR" },
  { code: "EVV", name: "Evansville Regional", city: "Evansville", state: "IN" },
  { code: "FAT", name: "Fresno Yosemite International", city: "Fresno", state: "CA" },
  { code: "GEG", name: "Spokane International", city: "Spokane", state: "WA" },
  { code: "GRR", name: "Gerald R. Ford International", city: "Grand Rapids", state: "MI" },
  { code: "GSO", name: "Piedmont Triad International", city: "Greensboro", state: "NC" },
  { code: "HNL", name: "Daniel K. Inouye International", city: "Honolulu", state: "HI" },
  { code: "HOU", name: "William P. Hobby Airport", city: "Houston", state: "TX" },
  { code: "HSV", name: "Huntsville International", city: "Huntsville", state: "AL" },
  { code: "ICT", name: "Wichita Dwight D. Eisenhower National", city: "Wichita", state: "KS" },
  { code: "IND", name: "Indianapolis International", city: "Indianapolis", state: "IN" },
  { code: "JAX", name: "Jacksonville International", city: "Jacksonville", state: "FL" },
  { code: "KOA", name: "Ellison Onizuka Kona International", city: "Kailua-Kona", state: "HI" },
  { code: "LGB", name: "Long Beach Airport", city: "Long Beach", state: "CA" },
  { code: "LIH", name: "Lihue Airport", city: "Lihue", state: "HI" },
  { code: "LIT", name: "Bill and Hillary Clinton National", city: "Little Rock", state: "AR" },
  { code: "MCI", name: "Kansas City International", city: "Kansas City", state: "MO" },
  { code: "MEM", name: "Memphis International", city: "Memphis", state: "TN" },
  { code: "MHT", name: "Manchester-Boston Regional", city: "Manchester", state: "NH" },
  { code: "MKE", name: "Milwaukee Mitchell International", city: "Milwaukee", state: "WI" },
  { code: "MOB", name: "Mobile Regional Airport", city: "Mobile", state: "AL" },
  { code: "MSN", name: "Dane County Regional", city: "Madison", state: "WI" },
  { code: "MSY", name: "Louis Armstrong New Orleans International", city: "New Orleans", state: "LA" },
  { code: "OAK", name: "Oakland International", city: "Oakland", state: "CA" },
  { code: "OKC", name: "Will Rogers World Airport", city: "Oklahoma City", state: "OK" },
  { code: "OMA", name: "Eppley Airfield", city: "Omaha", state: "NE" },
  { code: "ONT", name: "Ontario International", city: "Ontario", state: "CA" },
  { code: "PBI", name: "Palm Beach International", city: "West Palm Beach", state: "FL" },
  { code: "PDX", name: "Portland International", city: "Portland", state: "OR" },
  { code: "PIT", name: "Pittsburgh International", city: "Pittsburgh", state: "PA" },
  { code: "PVD", name: "Providence T.F. Green International", city: "Providence", state: "RI" },
  { code: "RDU", name: "Raleigh-Durham International", city: "Raleigh", state: "NC" },
  { code: "RIC", name: "Richmond International", city: "Richmond", state: "VA" },
  { code: "RNO", name: "Reno-Tahoe International", city: "Reno", state: "NV" },
  { code: "ROC", name: "Greater Rochester International", city: "Rochester", state: "NY" },
  { code: "RSW", name: "Southwest Florida International", city: "Fort Myers", state: "FL" },
  { code: "SAT", name: "San Antonio International", city: "San Antonio", state: "TX" },
  { code: "SAV", name: "Savannah/Hilton Head International", city: "Savannah", state: "GA" },
  { code: "SJC", name: "Norman Y. Mineta San Jose International", city: "San Jose", state: "CA" },
  { code: "SJU", name: "Luis Muñoz Marín International", city: "San Juan", state: "PR" },
  { code: "SMF", name: "Sacramento International", city: "Sacramento", state: "CA" },
  { code: "SNA", name: "John Wayne Airport", city: "Santa Ana", state: "CA" },
  { code: "STL", name: "St. Louis Lambert International", city: "St. Louis", state: "MO" },
  { code: "SYR", name: "Syracuse Hancock International", city: "Syracuse", state: "NY" },
  { code: "TPA", name: "Tampa International", city: "Tampa", state: "FL" },
  { code: "TUL", name: "Tulsa International", city: "Tulsa", state: "OK" },
  { code: "TUS", name: "Tucson International", city: "Tucson", state: "AZ" },
  // International
  { code: "NRT", name: "Narita International", city: "Tokyo", state: "Japan" },
  { code: "HND", name: "Haneda Airport", city: "Tokyo", state: "Japan" },
  { code: "LHR", name: "Heathrow Airport", city: "London", state: "UK" },
  { code: "LGW", name: "Gatwick Airport", city: "London", state: "UK" },
  { code: "CDG", name: "Charles de Gaulle Airport", city: "Paris", state: "France" },
  { code: "AMS", name: "Amsterdam Airport Schiphol", city: "Amsterdam", state: "Netherlands" },
  { code: "FRA", name: "Frankfurt Airport", city: "Frankfurt", state: "Germany" },
  { code: "DXB", name: "Dubai International", city: "Dubai", state: "UAE" },
  { code: "SIN", name: "Singapore Changi Airport", city: "Singapore", state: "Singapore" },
  { code: "HKG", name: "Hong Kong International", city: "Hong Kong", state: "China" },
  { code: "ICN", name: "Incheon International", city: "Seoul", state: "South Korea" },
  { code: "SYD", name: "Sydney Kingsford Smith Airport", city: "Sydney", state: "Australia" },
  { code: "MEL", name: "Melbourne Airport", city: "Melbourne", state: "Australia" },
  { code: "YYZ", name: "Toronto Pearson International", city: "Toronto", state: "Canada" },
  { code: "YVR", name: "Vancouver International", city: "Vancouver", state: "Canada" },
  { code: "YUL", name: "Montréal-Trudeau International", city: "Montreal", state: "Canada" },
  { code: "MEX", name: "Benito Juárez International", city: "Mexico City", state: "Mexico" },
  { code: "CUN", name: "Cancún International", city: "Cancún", state: "Mexico" },
  { code: "GDL", name: "Miguel Hidalgo y Costilla International", city: "Guadalajara", state: "Mexico" },
  { code: "BCN", name: "Josep Tarradellas Barcelona-El Prat", city: "Barcelona", state: "Spain" },
  { code: "MAD", name: "Adolfo Suárez Madrid-Barajas", city: "Madrid", state: "Spain" },
  { code: "FCO", name: "Leonardo da Vinci International", city: "Rome", state: "Italy" },
  { code: "MXP", name: "Milan Malpensa Airport", city: "Milan", state: "Italy" },
  { code: "GRU", name: "São Paulo–Guarulhos International", city: "São Paulo", state: "Brazil" },
  { code: "EZE", name: "Ministro Pistarini International", city: "Buenos Aires", state: "Argentina" },
  { code: "BOG", name: "El Dorado International", city: "Bogotá", state: "Colombia" },
  { code: "LIM", name: "Jorge Chávez International", city: "Lima", state: "Peru" },
  { code: "SCL", name: "Arturo Merino Benítez International", city: "Santiago", state: "Chile" },
  { code: "NBO", name: "Jomo Kenyatta International", city: "Nairobi", state: "Kenya" },
  { code: "JNB", name: "O.R. Tambo International", city: "Johannesburg", state: "South Africa" },
  { code: "CPT", name: "Cape Town International", city: "Cape Town", state: "South Africa" },
  { code: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", state: "Thailand" },
  { code: "KUL", name: "Kuala Lumpur International", city: "Kuala Lumpur", state: "Malaysia" },
  { code: "DEL", name: "Indira Gandhi International", city: "New Delhi", state: "India" },
  { code: "BOM", name: "Chhatrapati Shivaji Maharaj International", city: "Mumbai", state: "India" },
  { code: "PVG", name: "Shanghai Pudong International", city: "Shanghai", state: "China" },
  { code: "PEK", name: "Beijing Capital International", city: "Beijing", state: "China" },
  { code: "IST", name: "Istanbul Airport", city: "Istanbul", state: "Turkey" },
  { code: "ATH", name: "Athens International", city: "Athens", state: "Greece" },
  { code: "VIE", name: "Vienna International", city: "Vienna", state: "Austria" },
  { code: "ZRH", name: "Zurich Airport", city: "Zurich", state: "Switzerland" },
  { code: "CPH", name: "Copenhagen Airport", city: "Copenhagen", state: "Denmark" },
  { code: "ARN", name: "Stockholm Arlanda Airport", city: "Stockholm", state: "Sweden" },
  { code: "OSL", name: "Oslo Gardermoen Airport", city: "Oslo", state: "Norway" },
  { code: "HEL", name: "Helsinki-Vantaa Airport", city: "Helsinki", state: "Finland" },
  { code: "DUB", name: "Dublin Airport", city: "Dublin", state: "Ireland" },
  { code: "LIS", name: "Humberto Delgado Airport", city: "Lisbon", state: "Portugal" },
  { code: "MNL", name: "Ninoy Aquino International", city: "Manila", state: "Philippines" },
  { code: "CGK", name: "Soekarno-Hatta International", city: "Jakarta", state: "Indonesia" },
  { code: "DPS", name: "Ngurah Rai International", city: "Bali", state: "Indonesia" },
  { code: "AKL", name: "Auckland Airport", city: "Auckland", state: "New Zealand" },
];

interface AirportInputProps {
  value: string;
  onChange: (code: string) => void;
}

export default function AirportInput({ value, onChange }: AirportInputProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const selected = HOME_AIRPORTS.find((a) => a.code === value) ?? null;

  const results =
    query.trim().length > 0
      ? HOME_AIRPORTS.filter((a) => {
          const q = query.toLowerCase();
          return (
            a.code.toLowerCase().includes(q) ||
            a.city.toLowerCase().includes(q) ||
            a.state.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q)
          );
        }).slice(0, 8)
      : [];

  // Note: dropdown visibility is deliberately decoupled from `focused`.
  // Earlier this read `focused && query.trim().length > 0 && results.length > 0`,
  // which broke a real workflow on small phones: keyboard covers the list,
  // user taps "Done" to dismiss it, onBlur fires → focused becomes false →
  // dropdown disappears even though there's a perfectly good query and
  // matching results. Now the dropdown stays visible whenever there's
  // a query with matches, so the user can pick from it after dismissing
  // the keyboard.
  const showDropdown = query.trim().length > 0 && results.length > 0;

  /**
   * The dead end. A query with no serviced match used to render nothing at
   * all — no rows, no message, Continue grey — which stranded 13% of one
   * cohort and produced 58% of all onboarding drop-off. Now an unmatched
   * search is answered: we name the airport if we recognise it, point at the
   * nearest origin we do cover, and offer to write when their city launches.
   */
  const trimmed = query.trim();
  const unserved: GeoAirport[] = showDropdown ? [] : findUnserved(trimmed);
  const deadEnd = trimmed.length >= 2 && results.length === 0;
  const match = unserved[0] ?? null;
  const nearest = match ? nearestServed(match) : null;

  const [requested, setRequested] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const { user, profile } = useAuth();

  const requestAirport = async () => {
    if (requesting) return;
    setRequesting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const label = match ? `${match.city}, ${match.state}` : trimmed;
    try {
      await createAirportRequest({
        userId: user?.uid ?? null,
        email: user?.email ?? profile?.email ?? null,
        airportCode: match?.code ?? null,
        query: trimmed,
        nearestCode: nearest?.airport.code ?? null,
        nearestMiles: nearest ? Math.round(nearest.miles) : null,
      });
      logEvent("airport_request_submitted", {
        airport_code: match?.code ?? null,
        query: trimmed,
        nearest_code: nearest?.airport.code ?? null,
      });
      setRequested(label);
    } catch (err) {
      console.warn("[airport] request failed:", err);
      // Still acknowledge — the user did their part, and a lost write is
      // not worth turning a recovery into a second dead end.
      setRequested(label);
    } finally {
      setRequesting(false);
    }
  };

  // A new search clears the acknowledgement so the panel tracks the query.
  const lastQueryRef = useRef(trimmed);
  if (lastQueryRef.current !== trimmed) {
    lastQueryRef.current = trimmed;
    if (requested) setRequested(null);
  }

  // Size the wall directly. Logged once per distinct query rather than per
  // keystroke, so the count is "searches that found nothing" and not
  // "characters typed on the way there".
  const loggedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!deadEnd || loggedRef.current.has(trimmed)) return;
    loggedRef.current.add(trimmed);
    logEvent("airport_dead_end_shown", {
      query: trimmed,
      recognized_code: match?.code ?? null,
      nearest_code: nearest?.airport.code ?? null,
      nearest_miles: nearest ? Math.round(nearest.miles) : null,
    });
  }, [deadEnd, trimmed]);

  const handleSelect = (airport: Airport) => {
    onChange(airport.code);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <View>
      {/* Selected airport pill */}
      {selected && !focused && (
        <TouchableOpacity
          onPress={handleClear}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.brand.traceRed + "15",
            borderWidth: 1.5,
            borderColor: colors.brand.traceRed,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginBottom: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 22 }}>✈️</Text>
              <View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.brand.traceRed }}>
                  {selected.code}
                </Text>
                <Text style={{ fontSize: 13, color: theme.foreground, fontWeight: "600" }}>
                  {selected.city}, {selected.state}
                </Text>
              </View>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: theme.mutedForeground }}>Change</Text>
        </TouchableOpacity>
      )}

      {/* Search input */}
      {(!selected || focused) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.muted,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: focused ? colors.brand.traceRed : theme.border,
            paddingHorizontal: 14,
            marginBottom: showDropdown ? 0 : 0,
          }}
        >
          <Text style={{ fontSize: 18, marginRight: 10 }}>🔍</Text>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search by city, state, or code…"
            placeholderTextColor={theme.mutedForeground}
            autoCorrect={false}
            autoCapitalize="characters"
            style={{
              flex: 1,
              fontSize: 16,
              color: theme.foreground,
              paddingVertical: 14,
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 18, color: theme.mutedForeground }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Dropdown */}
      {/* Dead end: answered, not silent. */}
      {deadEnd && (
        <Animated.View
          entering={FadeIn.duration(220)}
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 14,
            marginTop: 6,
            padding: 14,
            gap: 12,
          }}
        >
          {requested ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: colors.brand.traceGreen,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={15} color="#fff" strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: theme.foreground }}>
                  We'll email you when {requested} opens up
                </Text>
                <Text style={{ fontSize: 13, color: theme.mutedForeground, marginTop: 3, lineHeight: 18 }}>
                  {nearest
                    ? `In the meantime you can start from ${nearest.airport.city} below.`
                    : "In the meantime, pick any airport below to look around."}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={{ gap: 3 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: theme.foreground }}>
                  {match
                    ? `We don't fly from ${match.city} yet`
                    : `No match for "${trimmed}"`}
                </Text>
                <Text style={{ fontSize: 13, color: theme.mutedForeground, lineHeight: 18 }}>
                  {match
                    ? `${match.code} isn't one of our ${HOME_AIRPORTS.length} airports — we're adding more.`
                    : `Try a city or airport code. We currently fly from ${HOME_AIRPORTS.length} US airports.`}
                </Text>
              </View>

              {/* The nearest airport we do cover. For a lot of people this is
                  a drive they already make. */}
              {!!nearest && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    logEvent("airport_nearest_accepted", {
                      from_query: trimmed,
                      chosen_code: nearest.airport.code,
                      miles: Math.round(nearest.miles),
                    });
                    handleSelect(nearest.airport);
                  }}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: colors.brand.traceRed + "10",
                    borderWidth: 1.5,
                    borderColor: colors.brand.traceRed,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                  }}
                >
                  <MapPin size={17} color={colors.brand.traceRed} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: "700", color: theme.foreground }}>
                      Use {nearest.airport.city} ({nearest.airport.code})
                    </Text>
                    <Text style={{ fontSize: 12.5, color: theme.mutedForeground, marginTop: 1 }}>
                      Closest airport we cover — about {Math.round(nearest.miles)} miles away
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={requestAirport}
                disabled={requesting}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 12,
                  paddingVertical: 11,
                  opacity: requesting ? 0.5 : 1,
                }}
              >
                <BellRing size={15} color={theme.mutedForeground} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>
                  Tell me when you launch {match ? match.city : "here"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      )}

      {showDropdown && (
        <View
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 14,
            marginTop: 6,
            overflow: "hidden",
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}>
            {results.map((airport, index) => (
              <TouchableOpacity
                key={airport.code}
                onPress={() => handleSelect(airport)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.brand.traceRed, width: 36 }}>
                  {airport.code}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground, flex: 1 }} numberOfLines={1}>
                  {airport.city}, {airport.state}
                </Text>
                <Text style={{ fontSize: 11, color: theme.mutedForeground }} numberOfLines={1}>
                  {airport.name.split(" ").slice(0, 2).join(" ")}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Hint when nothing typed yet and nothing selected */}
      {!selected && !focused && (
        <Text style={{ fontSize: 13, color: theme.mutedForeground, marginTop: 8, textAlign: "center" }}>
          Tap above and type to search
        </Text>
      )}
    </View>
  );
}
