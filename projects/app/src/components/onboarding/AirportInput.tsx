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

const AIRPORTS: Airport[] = [
  { code: "ATL", name: "Hartsfield-Jackson Atlanta International", city: "Atlanta", state: "GA" },
  { code: "AUS", name: "Austin-Bergstrom International", city: "Austin", state: "TX" },
  { code: "BDL", name: "Bradley International", city: "Hartford", state: "CT" },
  { code: "BNA", name: "Nashville International", city: "Nashville", state: "TN" },
  { code: "BOS", name: "Logan International", city: "Boston", state: "MA" },
  { code: "BUF", name: "Buffalo Niagara International", city: "Buffalo", state: "NY" },
  { code: "BWI", name: "Baltimore/Washington International", city: "Baltimore", state: "MD" },
  { code: "CLT", name: "Charlotte Douglas International", city: "Charlotte", state: "NC" },
  { code: "CMH", name: "John Glenn Columbus International", city: "Columbus", state: "OH" },
  { code: "DAL", name: "Dallas Love Field", city: "Dallas", state: "TX" },
  { code: "DEN", name: "Denver International", city: "Denver", state: "CO" },
  { code: "DFW", name: "Dallas/Fort Worth International", city: "Dallas", state: "TX" },
  { code: "DTW", name: "Detroit Metropolitan Wayne County", city: "Detroit", state: "MI" },
  { code: "EWR", name: "Newark Liberty International", city: "Newark", state: "NJ" },
  { code: "FLL", name: "Fort Lauderdale-Hollywood International", city: "Fort Lauderdale", state: "FL" },
  { code: "HNL", name: "Daniel K. Inouye International", city: "Honolulu", state: "HI" },
  { code: "HOU", name: "William P. Hobby Airport", city: "Houston", state: "TX" },
  { code: "IAD", name: "Washington Dulles International", city: "Washington", state: "DC" },
  { code: "IAH", name: "George Bush Intercontinental", city: "Houston", state: "TX" },
  { code: "IND", name: "Indianapolis International", city: "Indianapolis", state: "IN" },
  { code: "JFK", name: "John F. Kennedy International", city: "New York", state: "NY" },
  { code: "LAS", name: "Harry Reid International", city: "Las Vegas", state: "NV" },
  { code: "LAX", name: "Los Angeles International", city: "Los Angeles", state: "CA" },
  { code: "LGA", name: "LaGuardia Airport", city: "New York", state: "NY" },
  { code: "MCI", name: "Kansas City International", city: "Kansas City", state: "MO" },
  { code: "MCO", name: "Orlando International", city: "Orlando", state: "FL" },
  { code: "MDW", name: "Chicago Midway International", city: "Chicago", state: "IL" },
  { code: "MEM", name: "Memphis International", city: "Memphis", state: "TN" },
  { code: "MIA", name: "Miami International", city: "Miami", state: "FL" },
  { code: "MKE", name: "Milwaukee Mitchell International", city: "Milwaukee", state: "WI" },
  { code: "MSP", name: "Minneapolis-Saint Paul International", city: "Minneapolis", state: "MN" },
  { code: "MSY", name: "Louis Armstrong New Orleans International", city: "New Orleans", state: "LA" },
  { code: "OAK", name: "Oakland International", city: "Oakland", state: "CA" },
  { code: "OGG", name: "Kahului Airport", city: "Maui", state: "HI" },
  { code: "OMA", name: "Eppley Airfield", city: "Omaha", state: "NE" },
  { code: "ONT", name: "Ontario International", city: "Ontario", state: "CA" },
  { code: "ORD", name: "O'Hare International", city: "Chicago", state: "IL" },
  { code: "ORF", name: "Norfolk International", city: "Norfolk", state: "VA" },
  { code: "PBI", name: "Palm Beach International", city: "West Palm Beach", state: "FL" },
  { code: "PDX", name: "Portland International", city: "Portland", state: "OR" },
  { code: "PHL", name: "Philadelphia International", city: "Philadelphia", state: "PA" },
  { code: "PHX", name: "Phoenix Sky Harbor International", city: "Phoenix", state: "AZ" },
  { code: "PIT", name: "Pittsburgh International", city: "Pittsburgh", state: "PA" },
  { code: "PVD", name: "T.F. Green International", city: "Providence", state: "RI" },
  { code: "RDU", name: "Raleigh-Durham International", city: "Raleigh", state: "NC" },
  { code: "RIC", name: "Richmond International", city: "Richmond", state: "VA" },
  { code: "RNO", name: "Reno-Tahoe International", city: "Reno", state: "NV" },
  { code: "RSW", name: "Southwest Florida International", city: "Fort Myers", state: "FL" },
  { code: "SAN", name: "San Diego International", city: "San Diego", state: "CA" },
  { code: "SAT", name: "San Antonio International", city: "San Antonio", state: "TX" },
  { code: "SEA", name: "Seattle-Tacoma International", city: "Seattle", state: "WA" },
  { code: "SFO", name: "San Francisco International", city: "San Francisco", state: "CA" },
  { code: "SJC", name: "Norman Y. Mineta San Jose International", city: "San Jose", state: "CA" },
  { code: "SJU", name: "Luis Muñoz Marín International", city: "San Juan", state: "PR" },
  { code: "SLC", name: "Salt Lake City International", city: "Salt Lake City", state: "UT" },
  { code: "SMF", name: "Sacramento International", city: "Sacramento", state: "CA" },
  { code: "SNA", name: "John Wayne Airport", city: "Orange County", state: "CA" },
  { code: "STL", name: "St. Louis Lambert International", city: "St. Louis", state: "MO" },
  { code: "TPA", name: "Tampa International", city: "Tampa", state: "FL" },
  { code: "TUL", name: "Tulsa International", city: "Tulsa", state: "OK" },
  { code: "TUS", name: "Tucson International", city: "Tucson", state: "AZ" },
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

  const showDropdown = focused && query.trim().length > 0 && results.length > 0;

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
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}>
            {results.map((airport, index) => (
              <TouchableOpacity
                key={airport.code}
                onPress={() => handleSelect(airport)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: theme.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "800", color: theme.foreground }}>
                    {airport.code}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: theme.foreground }}>
                    {airport.city}, {airport.state}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 1 }} numberOfLines={1}>
                    {airport.name}
                  </Text>
                </View>
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
