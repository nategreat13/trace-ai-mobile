import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from "react-native";
import { colors } from "../../theme/colors";

interface Airport {
  code: string;
  name: string;
  city: string;
  state: string;
}

// Only airports we actually service — deals are fetched for these codes only.
export const AIRPORTS: Airport[] = [
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

  const selected = AIRPORTS.find((a) => a.code === value) ?? null;

  const results =
    query.trim().length > 0
      ? AIRPORTS.filter((a) => {
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
