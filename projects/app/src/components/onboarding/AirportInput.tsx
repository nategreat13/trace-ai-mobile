import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
} from "react-native";
import { colors } from "../../theme/colors";

const POPULAR_AIRPORTS = [
  "LAX",
  "JFK",
  "SFO",
  "ORD",
  "MIA",
  "ATL",
  "DFW",
  "SEA",
  "DEN",
  "BOS",
];

interface AirportInputProps {
  value: string;
  onChange: (code: string) => void;
}

export default function AirportInput({ value, onChange }: AirportInputProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const handleChangeText = (text: string) => {
    const upper = text.toUpperCase().replace(/[^A-Z]/g, "");
    if (upper.length <= 3) {
      onChange(upper);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        placeholder="Enter airport code (e.g. LAX)"
        placeholderTextColor={theme.mutedForeground}
        maxLength={3}
        autoCapitalize="characters"
        style={[
          styles.input,
          {
            backgroundColor: theme.muted,
            color: theme.foreground,
            borderColor: value.length === 3 ? colors.brand.traceRed : theme.border,
          },
        ]}
      />

      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        Popular airports
      </Text>

      <ScrollView
        contentContainerStyle={styles.chipsContainer}
        showsVerticalScrollIndicator={false}
      >
        {POPULAR_AIRPORTS.map((code) => {
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
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 24,
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
  },
  chipText: {
    fontSize: 15,
  },
});
