import { Platform } from "react-native";

export function getApiUrl(path: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (!domain || Platform.OS === "web") {
    return path;
  }
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  return `${base}${path}`;
}
