import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { getApiUrl } from "@/utils/api";

type Outfit = {
  outfitTitle: string;
  totalBudgetMin: number;
  totalBudgetMax: number;
  items: { category: string }[];
};

type OutfitJob = {
  jobId: string;
  status: string;
  prompt: string;
  outfits: Outfit[];
  createdAt: string;
};

async function fetchHistory(): Promise<OutfitJob[]> {
  const res = await fetch(getApiUrl("/api/outfit/history"));
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json() as Promise<OutfitJob[]>;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function HistoryCard({ item }: { item: OutfitJob }) {
  const outfit = item.outfits[0];
  const categories = outfit?.items?.map((i) => i.category).slice(0, 3) ?? [];

  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.container,
        pressed && cardStyles.pressed,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/results",
          params: { jobId: item.jobId, prompt: item.prompt },
        });
      }}
    >
      <View style={cardStyles.topRow}>
        <View style={cardStyles.icon}>
          <Icon name="zap" size={16} color={Colors.light.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.title} numberOfLines={1}>
            {outfit?.outfitTitle ?? item.prompt}
          </Text>
          <Text style={cardStyles.date}>{formatDate(item.createdAt)}</Text>
        </View>
        <Icon name="chevron-right" size={18} color={Colors.light.textTertiary} />
      </View>
      <Text style={cardStyles.prompt} numberOfLines={2}>
        {item.prompt}
      </Text>
      {categories.length > 0 && (
        <View style={cardStyles.tags}>
          {categories.map((cat, i) => (
            <View key={i} style={cardStyles.tag}>
              <Text style={cardStyles.tagText}>{cat}</Text>
            </View>
          ))}
          {outfit && (
            <View style={[cardStyles.tag, { backgroundColor: Colors.light.tintLight }]}>
              <Text style={[cardStyles.tagText, { color: Colors.light.tint }]}>
                ₹{isFinite(Number(outfit.totalBudgetMin)) ? Number(outfit.totalBudgetMin).toLocaleString("en-IN") : "—"}+
              </Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: {
    backgroundColor: Colors.light.backgroundSecondary,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 2,
  },
  date: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  prompt: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
});

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch, error } = useQuery<OutfitJob[]>({
    queryKey: ["outfit-history"],
    queryFn: fetchHistory,
    refetchInterval: 30000,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={[histStyles.container, { paddingTop: topPad }]}>
      <View style={histStyles.header}>
        <Text style={histStyles.headerTitle}>History</Text>
        <Text style={histStyles.headerSub}>Your past outfit lookups</Text>
      </View>

      {isLoading ? (
        <View style={histStyles.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : error ? (
        <View style={histStyles.centered}>
          <Icon name="wifi-off" size={40} color={Colors.light.textTertiary} />
          <Text style={histStyles.emptyText}>Couldn&apos;t load history</Text>
          <Pressable style={histStyles.retryBtn} onPress={() => refetch()}>
            <Text style={histStyles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : !data || data.length === 0 ? (
        <View style={histStyles.centered}>
          <View style={histStyles.emptyIcon}>
            <Icon name="clock" size={28} color={Colors.light.textTertiary} />
          </View>
          <Text style={histStyles.emptyTitle}>No outfits yet</Text>
          <Text style={histStyles.emptyText}>
            Your generated outfits will appear here
          </Text>
          <Pressable
            style={histStyles.ctaBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/");
            }}
          >
            <Icon name="zap" size={14} color="#fff" />
            <Text style={histStyles.ctaBtnText}>Generate Your First Outfit</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.jobId}
          renderItem={({ item }) => <HistoryCard item={item} />}
          contentContainerStyle={[
            histStyles.list,
            { paddingBottom: isWeb ? 34 : insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.light.tint}
            />
          }
          scrollEnabled={!!data && data.length > 0}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const histStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.light.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.light.text,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 8,
  },
  ctaBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  retryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.tint,
  },
});
