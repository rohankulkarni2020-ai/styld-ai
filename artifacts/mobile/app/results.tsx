import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { getApiUrl } from "@/utils/api";

type PortalProduct = {
  portal: string;
  portalColor: string;
  productName: string;
  brand: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  productUrl: string;
  isBestBuy: boolean;
  bestBuyReason: string;
};

type OutfitItem = {
  id: string;
  category: string;
  description: string;
  color: string;
  whyRecommended: string;
  portalProducts: PortalProduct[];
};

type Outfit = {
  outfitTitle: string;
  styleDescription: string;
  occasion: string;
  targetProfile: string;
  totalBudgetMin: number;
  totalBudgetMax: number;
  items: OutfitItem[];
  outfitImage?: string | null;
};

type JobData = {
  jobId: string;
  status: string;
  prompt: string;
  outfits: Outfit[];
  productsReady?: boolean;
  imageReady?: boolean;
  error?: string | null;
};

const LOADING_MSGS = [
  "Understanding your style...",
  "Building your outfit plan...",
  "Scanning selected portals...",
  "Matching items to your budget...",
  "Filtering top-rated products...",
  "Almost there...",
];

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Icon
          key={s}
          name="star"
          size={10}
          color={s <= Math.round(rating) ? "#F59E0B" : Colors.light.border}
          style={{ marginRight: 1 }}
        />
      ))}
      <Text style={starStyles.label}>{rating.toFixed(1)}</Text>
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginLeft: 3,
  },
});

function formatINR(value: number | undefined | null): string {
  const n = Number(value);
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-IN");
}

function PortalCard({ product }: { product: PortalProduct }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") {
      window.open(product.productUrl, "_blank");
    } else {
      Linking.openURL(product.productUrl);
    }
  };

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 100,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
    }).start();
  };

  const initials = (product.portal ?? "??").substring(0, 2).toUpperCase();
  const price = Number(product.price) || 0;
  const originalPrice = Number(product.originalPrice) || 0;
  const savings = originalPrice - price;

  return (
    <Pressable onPress={handlePress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[
          portalStyles.card,
          product.isBestBuy && portalStyles.bestBuyCard,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {product.isBestBuy && (
          <View style={portalStyles.bestBuyBadge}>
            <Icon name="award" size={10} color="#fff" />
            <Text style={portalStyles.bestBuyBadgeText}>Best Buy</Text>
          </View>
        )}
        <View style={portalStyles.header}>
          <View style={[portalStyles.portalBadge, { backgroundColor: product.portalColor }]}>
            <Text style={portalStyles.portalBadgeText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={portalStyles.portalName}>{product.portal}</Text>
            <Text style={portalStyles.brand}>{product.brand}</Text>
          </View>
        </View>
        <Text style={portalStyles.productName} numberOfLines={2}>
          {product.productName}
        </Text>
        <View style={portalStyles.priceRow}>
          <Text style={[portalStyles.price, product.isBestBuy && { color: Colors.light.success }]}>
            ₹{formatINR(price)}
          </Text>
          {savings > 0 && (
            <>
              <Text style={portalStyles.originalPrice}>
                ₹{formatINR(originalPrice)}
              </Text>
              <Text style={portalStyles.discount}>{product.discountPercent ?? 0}% off</Text>
            </>
          )}
        </View>
        <View style={portalStyles.metaRow}>
          <StarRating rating={Number(product.rating) || 0} />
          <Text style={portalStyles.reviews}>
            {formatINR(product.reviewCount)} reviews
          </Text>
        </View>
        {product.isBestBuy && product.bestBuyReason ? (
          <Text style={portalStyles.bestBuyReason}>{product.bestBuyReason}</Text>
        ) : null}
        <View style={portalStyles.shopBtn}>
          <Text style={portalStyles.shopBtnText}>Find on Portal</Text>
          <Icon name="external-link" size={12} color={Colors.light.tint} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const portalStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bestBuyCard: {
    borderColor: Colors.light.tint,
    borderWidth: 2,
    shadowOpacity: 0.1,
    shadowColor: Colors.light.tint,
  },
  bestBuyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.tint,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    marginBottom: 10,
  },
  bestBuyBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#fff",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  portalBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  portalBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: "#fff",
  },
  portalName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.light.text,
  },
  brand: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  productName: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 8,
  },
  price: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.light.text,
  },
  originalPrice: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textTertiary,
    textDecorationLine: "line-through",
  },
  discount: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.success,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reviews: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  bestBuyReason: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.tint,
    backgroundColor: Colors.light.tintLight,
    borderRadius: 8,
    padding: 10,
    lineHeight: 18,
    marginBottom: 10,
  },
  shopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 10,
  },
  shopBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.light.tint,
  },
});

function OutfitItemCard({ item }: { item: OutfitItem }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <View style={itemStyles.container}>
      <Pressable
        style={itemStyles.header}
        onPress={() => {
          setExpanded(!expanded);
          Haptics.selectionAsync();
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={itemStyles.category}>{item.category}</Text>
          <Text style={itemStyles.description} numberOfLines={expanded ? undefined : 1}>
            {item.description}
          </Text>
          <Text style={itemStyles.color}>{item.color}</Text>
        </View>
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Colors.light.textTertiary}
        />
      </Pressable>
      {expanded && (
        <View style={itemStyles.body}>
          <Text style={itemStyles.whyLabel}>Why this works</Text>
          <Text style={itemStyles.why}>{item.whyRecommended}</Text>
          <View style={itemStyles.products}>
            {item.portalProducts.length > 0 ? (
              item.portalProducts.map((p, i) => (
                <PortalCard key={i} product={p} />
              ))
            ) : (
              <View style={itemStyles.productsLoading}>
                <ActivityIndicator size="small" color={Colors.light.tint} />
                <Text style={itemStyles.productsLoadingText}>Finding best prices…</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const itemStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 18,
    gap: 12,
  },
  category: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.tint,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  description: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 2,
  },
  color: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  whyLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  why: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  products: {},
  productsLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  productsLoadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
});

function LoadingScreen({ prompt, elapsed }: { prompt: string; elapsed: number }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      setMsgIndex((i) => (i + 1) % LOADING_MSGS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={loadingStyles.container}>
      <ActivityIndicator size="large" color={Colors.light.tint} />
      <Animated.Text style={[loadingStyles.msg, { opacity: fadeAnim }]}>
        {LOADING_MSGS[msgIndex]}
      </Animated.Text>
      <Text style={loadingStyles.prompt} numberOfLines={2}>
        &ldquo;{prompt}&rdquo;
      </Text>
      <Text style={loadingStyles.timer}>{elapsed}s</Text>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  msg: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.light.text,
    textAlign: "center",
  },
  prompt: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  timer: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.light.textTertiary,
    letterSpacing: 0.5,
  },
});

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ jobId: string; prompt: string }>();
  const { jobId, prompt } = params;
  const [job, setJob] = useState<JobData | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [outfitImages, setOutfitImages] = useState<Record<number, string>>({});
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const productsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imagePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  const isWeb = Platform.OS === "web";

  // Elapsed timer — ticks every second while loading
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Main status poll (every 3s until done/error)
  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/outfit/poll/${jobId}`));
        if (!res.ok) return;
        const data = (await res.json()) as JobData;
        setJob(data);
        if (data.status === "done" || data.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          const secs = Math.round((Date.now() - startTimeRef.current) / 100) / 10;
          setTotalTime(secs);
          if (data.status === "done") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      } catch (e) {
        console.error("Poll error:", e);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  // Products poll (every 2s) — stops when productsReady=true
  useEffect(() => {
    if (!jobId || !job || job.status !== "done") return;
    if (job.productsReady) return;

    const pollProducts = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/outfit/poll/${jobId}`));
        if (!res.ok) return;
        const data = (await res.json()) as JobData;
        setJob(data);
        if (data.productsReady && productsPollRef.current) {
          clearInterval(productsPollRef.current);
          productsPollRef.current = null;
        }
      } catch {}
    };

    productsPollRef.current = setInterval(pollProducts, 2000);
    return () => {
      if (productsPollRef.current) clearInterval(productsPollRef.current);
    };
  }, [jobId, job?.status, job?.productsReady]);

  // Auto-image poll (every 4s) — starts after job is done, stops when imageReady=true
  useEffect(() => {
    if (!jobId || !job || job.status !== "done") return;
    if (job.imageReady) return;

    // Mark all outfits as loading
    const outfitCount = job.outfits.length;
    setImageLoading((prev) => {
      const next = { ...prev };
      for (let i = 0; i < outfitCount; i++) { if (!next[i]) next[i] = true; }
      return next;
    });

    const pollImage = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/outfit/poll/${jobId}`));
        if (!res.ok) return;
        const data = (await res.json()) as JobData;
        if (data.imageReady) {
          setJob(data);
          if (imagePollRef.current) { clearInterval(imagePollRef.current); imagePollRef.current = null; }
          // Fetch each image
          data.outfits.forEach((_, i) => {
            if (outfitImages[i]) return;
            fetch(getApiUrl(`/api/outfit/${jobId}/image/${i}`))
              .then((r) => r.ok ? r.json() : null)
              .then((d: { outfitImage?: string } | null) => {
                if (d?.outfitImage) {
                  setOutfitImages((prev) => ({ ...prev, [i]: d.outfitImage! }));
                  setImageLoading((prev) => ({ ...prev, [i]: false }));
                }
              })
              .catch(() => { setImageLoading((prev) => ({ ...prev, [i]: false })); });
          });
        }
      } catch {}
    };

    imagePollRef.current = setInterval(pollImage, 4000);
    return () => {
      if (imagePollRef.current) clearInterval(imagePollRef.current);
    };
  }, [jobId, job?.status, job?.imageReady]);

  // When image becomes ready, stop loading state
  useEffect(() => {
    if (!job?.imageReady) return;
    if (imagePollRef.current) { clearInterval(imagePollRef.current); imagePollRef.current = null; }
  }, [job?.imageReady]);

  const handleImageTap = (imageUri: string) => {
    setFullScreenImage(imageUri);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const outfits = job?.outfits ?? [];
  const currentOutfit = outfits[activeTab] ?? outfits[0];
  const currentImage = outfitImages[activeTab] ?? null;
  const isImageLoading = imageLoading[activeTab] ?? (job?.status === "done" && !job?.imageReady);

  return (
    <View
      style={[
        resultStyles.container,
        { paddingTop: isWeb ? 67 : insets.top },
      ]}
    >
      {/* Header */}
      <View style={resultStyles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [resultStyles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Icon name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          {job?.status === "done" && currentOutfit ? (
            <>
              {outfits.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0 }}
                >
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {outfits.map((o, i) => (
                      <Pressable
                        key={i}
                        onPress={() => {
                          setActiveTab(i);
                          Haptics.selectionAsync();
                        }}
                        style={[
                          resultStyles.tabPill,
                          activeTab === i && resultStyles.tabPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            resultStyles.tabPillText,
                            activeTab === i && resultStyles.tabPillTextActive,
                          ]}
                        >
                          Look {i + 1}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <Text style={resultStyles.title} numberOfLines={1}>
                  {currentOutfit.outfitTitle}
                </Text>
              )}
              {totalTime !== null && (
                <View style={resultStyles.timeBadge}>
                  <Icon name="zap" size={9} color={Colors.light.success} />
                  <Text style={resultStyles.timeBadgeText}>Found in {totalTime}s</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={resultStyles.titleMuted}>Generating outfit...</Text>
          )}
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [resultStyles.newSearchBtn, pressed && { opacity: 0.6 }]}
        >
          <Icon name="plus" size={18} color={Colors.light.tint} />
        </Pressable>
      </View>

      {/* Content */}
      {!job || job.status === "analyzing" ? (
        <LoadingScreen prompt={prompt ?? ""} elapsed={elapsed} />
      ) : job.status === "error" ? (
        <View style={resultStyles.errorContainer}>
          <Icon name="alert-circle" size={40} color={Colors.light.error} />
          <Text style={resultStyles.errorText}>Something went wrong</Text>
          <Text style={resultStyles.errorSub}>{job.error ?? "Please try again."}</Text>
          <Pressable style={resultStyles.retryBtn} onPress={() => router.back()}>
            <Text style={resultStyles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      ) : currentOutfit ? (
        <ScrollView
          style={resultStyles.scroll}
          contentContainerStyle={[
            resultStyles.scrollContent,
            { paddingBottom: isWeb ? 34 : insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* AI Outfit Image — auto-generated in background */}
          {currentImage ? (
            <Pressable
              onPress={() => handleImageTap(currentImage)}
              style={({ pressed }) => [resultStyles.outfitImageContainer, pressed && { opacity: 0.92 }]}
            >
              <Image
                source={{ uri: currentImage }}
                style={resultStyles.outfitImage}
                contentFit="cover"
              />
              <View style={resultStyles.outfitImageBadge}>
                <Icon name="zap" size={10} color="#fff" />
                <Text style={resultStyles.outfitImageBadgeText}>AI Generated Look</Text>
              </View>
              <View style={resultStyles.imageTapHint}>
                <Icon name="maximize" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={resultStyles.imageTapHintText}>Tap to expand</Text>
              </View>
            </Pressable>
          ) : isImageLoading ? (
            <View style={resultStyles.imageSkeleton}>
              <ActivityIndicator size="small" color={Colors.light.tint} style={{ marginBottom: 8 }} />
              <Text style={resultStyles.imageSkeletonText}>Generating your AI look...</Text>
              <Text style={resultStyles.imageSkeletonSub}>~30 seconds</Text>
            </View>
          ) : null}

          {/* Full-screen image modal */}
          <Modal
            visible={!!fullScreenImage}
            transparent
            animationType="fade"
            onRequestClose={() => setFullScreenImage(null)}
            statusBarTranslucent
          >
            <StatusBar hidden />
            <View style={resultStyles.modalOverlay}>
              <Pressable
                style={resultStyles.modalClose}
                onPress={() => { setFullScreenImage(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Icon name="x" size={22} color="#fff" />
              </Pressable>
              {fullScreenImage && (
                <Image
                  source={{ uri: fullScreenImage }}
                  style={resultStyles.modalImage}
                  contentFit="contain"
                />
              )}
            </View>
          </Modal>

          {/* Outfit overview */}
          <View style={resultStyles.overview}>
            <Text style={resultStyles.outfitTitle}>{currentOutfit.outfitTitle}</Text>
            <Text style={resultStyles.styleDesc}>{currentOutfit.styleDescription}</Text>
            <View style={resultStyles.metaRow}>
              <View style={resultStyles.metaBadge}>
                <Icon name="map-pin" size={11} color={Colors.light.textSecondary} />
                <Text style={resultStyles.metaBadgeText}>{currentOutfit.occasion}</Text>
              </View>
              <View style={resultStyles.metaBadge}>
                <Icon name="user" size={11} color={Colors.light.textSecondary} />
                <Text style={resultStyles.metaBadgeText}>{currentOutfit.targetProfile}</Text>
              </View>
              <View style={resultStyles.metaBadge}>
                <Icon name="tag" size={11} color={Colors.light.textSecondary} />
                <Text style={resultStyles.metaBadgeText}>
                  ₹{formatINR(currentOutfit.totalBudgetMin)} – ₹{formatINR(currentOutfit.totalBudgetMax)}
                </Text>
              </View>
            </View>
          </View>

          {/* Items */}
          <Text style={resultStyles.sectionLabel}>Your Closet</Text>
          {(currentOutfit.items ?? []).length === 0 ? (
            <View style={resultStyles.emptyItems}>
              <ActivityIndicator size="small" color={Colors.light.tint} />
              <Text style={resultStyles.emptyItemsText}>Loading outfit details...</Text>
            </View>
          ) : (
            (currentOutfit.items ?? []).map((item, i) => (
              <OutfitItemCard key={i} item={item} />
            ))
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const resultStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
    backgroundColor: Colors.light.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  titleMuted: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  tabPillActive: { backgroundColor: Colors.light.tint },
  tabPillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  tabPillTextActive: { color: "#fff" },
  newSearchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  overview: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  outfitTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.light.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  styleDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaBadgeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  sectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.light.text,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  errorText: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.light.text,
  },
  errorSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  outfitImageContainer: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
    aspectRatio: 1,
  },
  outfitImage: {
    width: "100%",
    height: "100%",
  },
  outfitImageBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  outfitImageBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#fff",
  },
  imageSkeleton: {
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  imageSkeletonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  imageSkeletonSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  imageTapHint: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  imageTapHintText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalClose: {
    position: "absolute",
    top: 52,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalImage: {
    width: "100%",
    height: "80%",
  },
  emptyItems: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 40,
  },
  emptyItemsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  retryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  timeBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.light.success,
  },
});
