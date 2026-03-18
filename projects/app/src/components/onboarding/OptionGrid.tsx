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
}

export default function OptionGrid({
  options,
  selected,
  onSelect,
  multi = false,
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

  const renderItem = ({ item }: { item: Option }) => {
    const active = isSelected(item.value);

    return (
      <TouchableOpacity
        onPress={() => handleSelect(item.value)}
        activeOpacity={0.7}
        style={[
          styles.card,
          {
            backgroundColor: active ? colors.brand.traceRed + "12" : theme.card,
            borderColor: active ? colors.brand.traceRed : theme.border,
          },
        ]}
      >
        <Text style={styles.icon}>{item.icon}</Text>
        <Text style={[styles.label, { color: theme.foreground }]}>
          {item.label}
        </Text>
        <Text style={[styles.sub, { color: theme.mutedForeground }]}>
          {item.sub}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={options}
      keyExtractor={(item) => item.value}
      renderItem={renderItem}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  row: {
    gap: 12,
  },
  card: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  sub: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
});
