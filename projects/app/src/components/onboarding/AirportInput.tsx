import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
} from "react-native";
import { colors } from "../../theme/colors";

const AIRPORTS = [
  "ATL",
  "AUS",
  "BOS",
  "CLT",
  "DEN",
  "DFW",
  "DTW",
  "EWR",
  "FLL",
  "IAH",
  "JFK",
  "LAS",
  "LAX",
  "MCO",
  "MIA",
  "MSP",
  "ORD",
  "PHL",
  "PHX",
  "SAN",
  "SEA",
  "SFO",
  "SLC",
];

interface AirportInputProps {
  value: string;
  onChange: (code: string) => void;
}

export default function AirportInput({ value, onChange }: AirportInputProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        Select your airport
      </Text>

      <ScrollView
        contentContainerStyle={styles.chipsContainer}
        showsVerticalScrollIndicator={false}
      >
        {AIRPORTS.map((code) => {
          const isSelected = value === code;
          return (
            <TouchableOpacity
              key={code}
              onPress={() => onChange(code)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? colors.brand.traceRed
                    : theme.muted,
                  borderColor: isSelected
                    ? colors.brand.traceRed
                    : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected ? "#ffffff" : theme.foreground,
                    fontWeight: isSelected ? "700" : "500",
                  },
                ]}
              >
                {code}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 72,
    alignItems: "center",
  },
  chipText: {
    fontSize: 15,
  },
});
