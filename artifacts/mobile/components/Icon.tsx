import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
} from "react-native-svg";

type FeatherName =
  | "alert-circle"
  | "arrow-left"
  | "arrow-right"
  | "award"
  | "check"
  | "check-circle"
  | "chevron-down"
  | "chevron-right"
  | "chevron-up"
  | "clock"
  | "external-link"
  | "layers"
  | "lock"
  | "map-pin"
  | "maximize"
  | "plus"
  | "shopping-bag"
  | "star"
  | "tag"
  | "user"
  | "wifi-off"
  | "x"
  | "zap";

interface IconProps {
  name: FeatherName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const STROKE_PROPS = {
  fill: "none" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function Icon({ name, size = 24, color = "#000", style }: IconProps) {
  const stroke = color;
  const sw = size <= 14 ? 2.5 : 2;

  const inner = (() => {
    switch (name) {
      case "zap":
        return <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />;

      case "arrow-right":
        return (
          <>
            <Line x1="5" y1="12" x2="19" y2="12" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            <Polyline points="12 5 19 12 12 19" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "arrow-left":
        return (
          <>
            <Line x1="19" y1="12" x2="5" y2="12" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            <Polyline points="12 19 5 12 12 5" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "check":
        return <Polyline points="20 6 9 17 4 12" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />;

      case "check-circle":
        return (
          <>
            <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Polyline points="22 4 12 14.01 9 11.01" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "alert-circle":
        return (
          <>
            <Circle cx="12" cy="12" r="10" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Line x1="12" y1="8" x2="12" y2="12" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            <Line x1="12" y1="16" x2="12.01" y2="16" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          </>
        );

      case "x":
        return (
          <>
            <Line x1="18" y1="6" x2="6" y2="18" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            <Line x1="6" y1="6" x2="18" y2="18" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          </>
        );

      case "plus":
        return (
          <>
            <Line x1="12" y1="5" x2="12" y2="19" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            <Line x1="5" y1="12" x2="19" y2="12" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          </>
        );

      case "clock":
        return (
          <>
            <Circle cx="12" cy="12" r="10" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Polyline points="12 6 12 12 16 14" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "chevron-right":
        return <Polyline points="9 18 15 12 9 6" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />;

      case "chevron-up":
        return <Polyline points="18 15 12 9 6 15" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />;

      case "chevron-down":
        return <Polyline points="6 9 12 15 18 9" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />;

      case "star":
        return <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />;

      case "tag":
        return (
          <>
            <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Line x1="7" y1="7" x2="7.01" y2="7" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          </>
        );

      case "layers":
        return (
          <>
            <Polygon points="12 2 2 7 12 12 22 7 12 2" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Polyline points="2 17 12 22 22 17" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Polyline points="2 12 12 17 22 12" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "lock":
        return (
          <>
            <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "shopping-bag":
        return (
          <>
            <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Line x1="3" y1="6" x2="21" y2="6" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            <Path d="M16 10a4 4 0 0 1-8 0" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "map-pin":
        return (
          <>
            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Circle cx="12" cy="10" r="3" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "user":
        return (
          <>
            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Circle cx="12" cy="7" r="4" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "award":
        return (
          <>
            <Circle cx="12" cy="8" r="6" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          </>
        );

      case "external-link":
        return (
          <>
            <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Polyline points="15 3 21 3 21 9" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Line x1="10" y1="14" x2="21" y2="3" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          </>
        );

      case "maximize":
        return (
          <>
            <Polyline points="15 3 21 3 21 9" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Polyline points="9 21 3 21 3 15" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Line x1="21" y1="3" x2="14" y2="10" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            <Line x1="3" y1="21" x2="10" y2="14" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          </>
        );

      case "wifi-off":
        return (
          <>
            <Line x1="1" y1="1" x2="23" y2="23" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            <Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Path d="M10.71 5.05A16 16 0 0 1 22.56 9" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
            <Line x1="12" y1="20" x2="12.01" y2="20" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          </>
        );

      default:
        return null;
    }
  })();

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style as any}
    >
      {inner}
    </Svg>
  );
}
