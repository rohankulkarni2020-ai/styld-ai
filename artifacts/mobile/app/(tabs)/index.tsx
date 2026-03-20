import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { getApiUrl } from "@/utils/api";

const EXAMPLE_PROMPTS = [
  "GenZ casual outfit for 22-year-old woman, Goa beach trip",
  "Office-to-dinner look for 28-year-old man, corporate but stylish",
  "Festive Diwali outfit for 30-year-old woman, traditional with a modern twist",
  "Street style winter fit for 20-year-old, Delhi cold weather",
  "Budget resort wear for honeymoon in Maldives, couple under ₹5000 each",
];

const ALL_PORTALS = [
  { name: "Myntra",        color: "#FF3F6C" },
  { name: "Amazon Fashion",color: "#FF9900" },
  { name: "Ajio",          color: "#C00D0D" },
  { name: "Flipkart",      color: "#2874F0" },
  { name: "Nykaa Fashion", color: "#FC2779" },
  { name: "Meesho",        color: "#9747FF" },
  { name: "H&M",           color: "#E50010" },
  { name: "Zara",          color: "#1D1D1B" },
];

const RATING_OPTIONS = [3, 3.5, 4, 4.5];

const BUDGET_PRESETS = [
  { key: "budget",     label: "Under ₹1K",  min: 0,     max: 1000  },
  { key: "affordable", label: "₹1K – 3K",   min: 1000,  max: 3000  },
  { key: "mid",        label: "₹3K – 10K",  min: 3000,  max: 10000 },
  { key: "premium",    label: "₹10K+",      min: 10000, max: 50000 },
];

const COUNT_OPTIONS = [1, 2, 3];

function getSuggestedPortals(prompt: string): string[] {
  const p = prompt.toLowerCase();
  if (p.match(/ethnic|kurta|saree|lehenga|salwar|dupatta|anarkali|wedding|mehndi|puja|festive|traditional/))
    return ["Myntra", "Ajio", "Meesho"];
  if (p.match(/budget|affordable|cheap|economical/))
    return ["Meesho", "Flipkart", "Amazon Fashion"];
  if (p.match(/luxury|premium|designer|high.end/))
    return ["Zara", "H&M", "Myntra"];
  if (p.match(/western|streetwear|genz|gen z|jeans|hoodie|sneaker/))
    return ["H&M", "Myntra", "Flipkart"];
  if (p.match(/office|formal|corporate|blazer|suit/))
    return ["Myntra", "Amazon Fashion", "H&M"];
  if (p.match(/women|girl|female|ladies|her\b|she\b/))
    return ["Myntra", "Nykaa Fashion", "Ajio"];
  return ["Myntra", "Amazon Fashion", "Ajio"];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const [selectedPortals, setSelectedPortals] = useState<string[]>(["Myntra", "Amazon Fashion"]);
  const [minRating, setMinRating] = useState<number>(4);
  const [budgetKey, setBudgetKey] = useState<string>("mid");
  const [outfitCount, setOutfitCount] = useState<number>(1);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const suggestedPortals = prompt.length > 15 ? getSuggestedPortals(prompt) : [];
  const selectedBudget = BUDGET_PRESETS.find((b) => b.key === budgetKey) ?? BUDGET_PRESETS[2];

  const togglePortal = (name: string) => {
    Haptics.selectionAsync();
    setSelectedPortals((prev) =>
      prev.includes(name)
        ? prev.length > 1 ? prev.filter((p) => p !== name) : prev
        : [...prev, name]
    );
  };

  const handleOutfitCount = (n: number) => {
    if (n > 2) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowPremiumModal(true);
      return;
    }
    Haptics.selectionAsync();
    setOutfitCount(n);
  };

  const handleFocus = () => setFocused(true);
  const handleBlur = () => setFocused(false);

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting) return;
    Keyboard.dismiss();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const response = await fetch(getApiUrl("/api/outfit/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          portals: selectedPortals,
          minRating,
          budgetMin: selectedBudget.min,
          budgetMax: selectedBudget.max,
          outfitCount,
        }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = (await response.json()) as { jobId: string };
      router.push({ pathname: "/results", params: { jobId: data.jobId, prompt: prompt.trim() } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to connect. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExamplePress = (example: string) => {
    setPrompt(example);
    inputRef.current?.focus();
    Haptics.selectionAsync();
  };

  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Styld<Text style={styles.logoAccent}>.ai</Text></Text>
          <Text style={styles.logoSub}>AI Fashion Curator</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>India&apos;s AI Style Assistant</Text>
          <Text style={styles.heroHeading}>Describe your{"\n"}perfect look.</Text>
          <Text style={styles.heroSub}>
            AI-curated outfit recommendations from India&apos;s best fashion portals.
          </Text>
        </View>

        {/* Search box */}
        <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="e.g. Casual summer look for beach trip in Goa..."
            placeholderTextColor={Colors.light.textTertiary}
            value={prompt}
            onChangeText={setPrompt}
            onFocus={handleFocus}
            onBlur={handleBlur}
            multiline
            maxLength={300}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.searchFooter}>
            <Text style={styles.charCount}>
              {prompt.length > 0 ? `${prompt.length} / 300` : "Tap to describe your look"}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!prompt.trim() || submitting}
          style={({ pressed }) => [
            styles.searchBtn,
            (!prompt.trim() || submitting) && styles.searchBtnDisabled,
            pressed && styles.searchBtnPressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="zap" size={15} color="#fff" />
          )}
          <Text style={styles.searchBtnText}>
            {submitting ? "Finding outfits..." : "Find My Outfit"}
          </Text>
          {!submitting && <Icon name="arrow-right" size={15} color="#fff" />}
        </Pressable>

        {submitError ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={14} color={Colors.light.error} />
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        {/* ── Filters card ── */}
        <View style={styles.filtersCard}>

          {/* Portals */}
          <View style={styles.filterHeader}>
            <Icon name="shopping-bag" size={13} color={Colors.light.tint} />
            <Text style={styles.filterLabel}>SHOP FROM</Text>
            <View style={styles.portalCountBadge}>
              <Text style={styles.portalCountText}>{selectedPortals.length} selected</Text>
            </View>
            {suggestedPortals.length > 0 && (
              <Pressable
                onPress={() => { setSelectedPortals(suggestedPortals); Haptics.selectionAsync(); }}
                style={styles.suggestBtn}
              >
                <Icon name="zap" size={10} color={Colors.light.tint} />
                <Text style={styles.suggestBtnText}>AI picks</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.portalGrid}>
            {ALL_PORTALS.map((portal) => {
              const active = selectedPortals.includes(portal.name);
              const suggested = suggestedPortals.includes(portal.name);
              return (
                <Pressable
                  key={portal.name}
                  onPress={() => togglePortal(portal.name)}
                  style={({ pressed }) => [
                    styles.portalGridChip,
                    active
                      ? { backgroundColor: portal.color + "18", borderColor: portal.color, borderWidth: 1.5 }
                      : styles.portalGridChipInactive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.portalGridDot, { backgroundColor: active ? portal.color : Colors.light.border }]} />
                  <Text
                    style={[
                      styles.portalGridText,
                      active
                        ? { color: portal.color, fontFamily: "Inter_600SemiBold" }
                        : styles.portalGridTextInactive,
                    ]}
                    numberOfLines={1}
                  >
                    {portal.name}
                  </Text>
                  {!active && suggested && <View style={styles.suggestDot} />}
                  {active && <Icon name="check" size={11} color={portal.color} />}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.filterDivider} />

          {/* Min Rating */}
          <View style={styles.filterHeader}>
            <Icon name="star" size={13} color={Colors.light.tint} />
            <Text style={styles.filterLabel}>MIN RATING</Text>
          </View>
          <View style={styles.filterRow}>
            {RATING_OPTIONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => { setMinRating(r); Haptics.selectionAsync(); }}
                style={[styles.filterChip, minRating === r && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, minRating === r && styles.filterChipTextActive]}>
                  ★ {r}+
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.filterDivider} />

          {/* Budget */}
          <View style={styles.filterHeader}>
            <Icon name="tag" size={13} color={Colors.light.tint} />
            <Text style={styles.filterLabel}>BUDGET RANGE</Text>
          </View>
          <View style={styles.filterRow}>
            {BUDGET_PRESETS.map((b) => (
              <Pressable
                key={b.key}
                onPress={() => { setBudgetKey(b.key); Haptics.selectionAsync(); }}
                style={[styles.filterChip, budgetKey === b.key && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, budgetKey === b.key && styles.filterChipTextActive]}>
                  {b.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.filterDivider} />

          {/* Outfit count */}
          <View style={styles.filterHeader}>
            <Icon name="layers" size={13} color={Colors.light.tint} />
            <Text style={styles.filterLabel}>OUTFIT SUGGESTIONS</Text>
          </View>
          <View style={styles.filterRow}>
            {COUNT_OPTIONS.map((n) => {
              const isPro = n > 2;
              const active = outfitCount === n && !isPro;
              return (
                <Pressable
                  key={n}
                  onPress={() => handleOutfitCount(n)}
                  style={[styles.filterChip, active && styles.filterChipActive, isPro && styles.filterChipPro]}
                >
                  <View style={styles.countChipInner}>
                    {isPro && <Icon name="lock" size={10} color={Colors.light.textTertiary} style={{ marginRight: 3 }} />}
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive, isPro && styles.filterChipTextPro]}>
                      {n} look{n > 1 ? "s" : ""}
                    </Text>
                    {isPro && (
                      <View style={styles.proBadge}>
                        <Text style={styles.proBadgeText}>PRO</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Example prompts */}
        <View style={styles.examples}>
          <Text style={styles.examplesLabel}>Try these</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.examplesRow}>
            {EXAMPLE_PROMPTS.map((example, i) => (
              <Pressable
                key={i}
                onPress={() => handleExamplePress(example)}
                style={({ pressed }) => [styles.exampleChip, pressed && styles.exampleChipPressed]}
              >
                <Text style={styles.exampleChipText}>{example}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.footer}>
          Powered by Claude AI · Searches India&apos;s best fashion portals
        </Text>
      </ScrollView>

      {/* Premium upgrade modal */}
      <Modal
        visible={showPremiumModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPremiumModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPremiumModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.crownCircle}>
              <Text style={styles.crownEmoji}>👑</Text>
            </View>
            <Text style={styles.modalTitle}>Upgrade to Premium</Text>
            <Text style={styles.modalSub}>
              Get up to 3 outfit suggestions per search, priority AI processing, and exclusive style insights.
            </Text>
            <View style={styles.modalFeatures}>
              {["3 outfit suggestions per search", "Priority AI generation", "Exclusive brand access", "Advanced style analytics"].map((f) => (
                <View key={f} style={styles.modalFeatureRow}>
                  <Icon name="check-circle" size={14} color={Colors.light.success} />
                  <Text style={styles.modalFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.85 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowPremiumModal(false); }}
            >
              <Icon name="zap" size={15} color="#fff" />
              <Text style={styles.upgradeBtnText}>Upgrade Now — ₹199/mo</Text>
            </Pressable>
            <Pressable onPress={() => setShowPremiumModal(false)} style={styles.laterBtn}>
              <Text style={styles.laterBtnText}>Maybe Later</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "web" ? 34 : 100 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, marginTop: 4 },
  logo: { fontFamily: "Inter_700Bold", fontSize: 21, color: Colors.light.text, letterSpacing: -0.5 },
  logoAccent: { color: Colors.light.tint },
  logoSub: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textTertiary, letterSpacing: 1.2, textTransform: "uppercase" },
  hero: { marginBottom: 16 },
  eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.light.tint, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  heroHeading: { fontFamily: "Inter_700Bold", fontSize: Platform.OS === "web" ? 32 : 28, color: Colors.light.text, lineHeight: Platform.OS === "web" ? 38 : 34, letterSpacing: -0.8, marginBottom: 6 },
  heroSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },
  searchBox: { backgroundColor: Colors.light.background, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.light.border, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  searchBoxFocused: { borderColor: Colors.light.tint, shadowOpacity: 0.12 },
  searchInput: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.light.text, padding: 16, minHeight: Platform.OS === "web" ? 100 : 90, textAlignVertical: "top", lineHeight: 22 },
  searchFooter: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2, borderTopWidth: 1, borderTopColor: Colors.light.borderLight },
  charCount: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textTertiary },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.tint, paddingVertical: 14, borderRadius: 16, marginBottom: 12, shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  searchBtnDisabled: { backgroundColor: Colors.light.textTertiary },
  searchBtnPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  searchBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.error, flex: 1 },

  // Filters card
  filtersCard: { backgroundColor: Colors.light.card, borderRadius: 20, borderWidth: 1, borderColor: Colors.light.border, padding: 18, marginBottom: 28, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  filterHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  filterLabel: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.light.textTertiary, letterSpacing: 1.5, textTransform: "uppercase", flex: 1 },
  suggestBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.light.tintLight, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  suggestBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.light.tint },
  filterDivider: { height: 1, backgroundColor: Colors.light.borderLight, marginVertical: 16 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  // Portal grid
  portalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  portalGridChip: { flexDirection: "row", alignItems: "center", gap: 6, width: "47.5%", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  portalGridChipInactive: { backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.borderLight, opacity: 0.55 },
  portalGridDot: { width: 9, height: 9, borderRadius: 5 },
  portalGridText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, flex: 1 },
  portalGridTextInactive: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textTertiary, flex: 1 },
  suggestDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.light.tint },
  portalCountBadge: { backgroundColor: Colors.light.tint + "15", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 4 },
  portalCountText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.light.tint },

  // Filter chips (rating, budget, count)
  filterChip: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1.5, borderColor: Colors.light.border, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: Colors.light.tintLight, borderColor: Colors.light.tint },
  filterChipPro: { borderStyle: "dashed", borderColor: Colors.light.border },
  filterChipText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  filterChipTextActive: { fontFamily: "Inter_600SemiBold", color: Colors.light.tint },
  filterChipTextPro: { color: Colors.light.textTertiary },
  countChipInner: { flexDirection: "row", alignItems: "center", gap: 3 },
  proBadge: { backgroundColor: "#F3E8FF", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4 },
  proBadgeText: { fontFamily: "Inter_700Bold", fontSize: 8, color: "#9747FF", letterSpacing: 0.5 },

  examples: { marginBottom: 32 },
  examplesLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.light.textTertiary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 },
  examplesRow: { gap: 8, paddingRight: 4 },
  exampleChip: { backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8 },
  exampleChipPressed: { backgroundColor: Colors.light.tintLight, borderColor: Colors.light.tint + "40" },
  exampleChipText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  footer: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textTertiary, textAlign: "center" },

  // Premium modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: Colors.light.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40, alignItems: "center" },
  crownCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#FFF9E6", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  crownEmoji: { fontSize: 36 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.light.text, letterSpacing: -0.5, marginBottom: 10, textAlign: "center" },
  modalSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary, textAlign: "center", lineHeight: 21, marginBottom: 20 },
  modalFeatures: { width: "100%", gap: 10, marginBottom: 24 },
  modalFeatureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalFeatureText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.text },
  upgradeBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.light.tint, paddingHorizontal: 28, paddingVertical: 15, borderRadius: 50, width: "100%", justifyContent: "center", marginBottom: 12 },
  upgradeBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  laterBtn: { paddingVertical: 8 },
  laterBtnText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textSecondary },
});
