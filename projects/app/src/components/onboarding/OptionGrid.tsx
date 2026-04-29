import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { colors } from "../../theme/colors";

interface Option {
  value: string;
  icon: string;
  label: string;
  sub: string;
}

interface OptionGridProps {
  options: Option[];
  selected: string | string[];
  onSelect: (value: string | string[]) => void;
  multi?: boolean;
  numColumns?: number;
}

export default function OptionGrid({
  options,
  selected,
  onSelect,
  multi = false,
  numColumns = 2,
}: OptionGridProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? colors.dark : colors.light;

  const isSelected = (value: string): boolean => {
    if (multi && Array.isArray(selected)) {
      return selected.includes(value);
    }
    return selected === value;
  };

  const handleSelect = (value: string) => {
    if (multi) {
      const arr = Array.isArray(selected) ? selected : [];
      if (arr.includes(value)) {
        onSelect(arr.filter((v) => v !== value));
      } else {
        onSelect([...arr, value]);
      }
    } else {
      onSelect(value);
    }
  };

  const compact = numColumns >= 3;

  const renderItem = ({ item }: { item: Option }) => {
    const active = isSelected(item.value);

    return (
      <TouchableOpacity
        onPress={() => handleSelect(item.value)}
        activeOpacity={0.7}
        style={[
          styles.card,
          compact && styles.cardCompact,
          {
            backgroundColor: active ? colors.brand.traceRed + "12" : theme.card,
            borderColor: active ? colors.brand.traceRed : theme.border,
          },
        ]}
      >
        <Text style={compact ? styles.iconCompact : styles.icon}>{item.icon}</Text>
        <Text style={[compact ? styles.labelCompact : styles.label, { color: theme.foreground }]}>
          {item.label}
        </Text>
        {!compact && (
          <Text style={[styles.sub, { color: theme.mutedForeground }]}>
            {item.sub}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={options}
      keyExtractor={(item) => item.value}
      renderItem={renderItem}
      numColumns={numColumns}
      key={numColumns}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    gap: 10,
  },
  card: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 110,
  },
  cardCompact: {
    padding: 10,
    minHeight: 82,
    borderRadius: 12,
  },
  icon: {
    fontSize: 30,
    marginBottom: 8,
  },
  iconCompact: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  labelCompact: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  sub: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
});
