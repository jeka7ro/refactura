import React from "react";
import { cn } from "@/lib/utils";

interface FacturaSpvLogoProps {
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
  theme?: "auto" | "light" | "dark";
  className?: string;
}

const SQUIRCLE_OUTER_PATH =
  "M 340,0 L 684,0 C 803,0 863,0 911,20.4 C 957,40 984,67 1003.6,113 C 1024,161 1024,221 1024,340 L 1024,684 C 1024,803 1024,863 1003.6,911 C 984,957 957,984 911,1003.6 C 863,1024 803,1024 684,1024 L 340,1024 C 221,1024 161,1024 113,1003.6 C 67,984 40,957 20.4,911 C 0,863 0,803 0,684 L 0,340 C 0,221 0,161 20.4,113 C 40,67 67,40 113,20.4 C 161,0 221,0 340,0 Z";

// Inset by 34 units for a crisp ~1.2px luminous Apple Intelligence perimeter halo at 36px
const SQUIRCLE_INNER_PATH =
  "M 352,34 L 672,34 C 783,34 839,34 884,53 C 927,71 953,97 971,140 C 990,185 990,241 990,352 L 990,672 C 990,783 990,839 971,884 C 953,927 927,953 884,971 C 839,990 783,990 672,990 L 352,990 C 241,990 185,990 140,971 C 97,953 71,927 53,884 C 34,839 34,783 34,672 L 34,352 C 34,241 34,185 53,140 C 71,97 97,71 140,53 C 185,34 241,34 352,34 Z";

/**
 * Apple macOS Tahoe / Apple Intelligence Brand Mark & Lockup for Factura/SPV.
 * Features a continuous-curvature squircle with a smooth 360° luminous emerald-cyan
 * perimeter halo and an Apple SF Symbols staggered wave across `s · p · v`.
 */
export function FacturaSpvLogo({
  iconOnly = false,
  size = "md",
  theme = "auto",
  className,
}: FacturaSpvLogoProps) {
  const uid = React.useId().replace(/:/g, "");

  const dimensions = {
    sm: {
      iconBox: "w-8 h-8",
      wordmark: "text-[17px]",
      slashH: "h-[17px]",
      gap: "gap-2",
    },
    md: {
      iconBox: "w-9 h-9",
      wordmark: "text-[19px]",
      slashH: "h-[19px]",
      gap: "gap-2.5",
    },
    lg: {
      iconBox: "w-12 h-12",
      wordmark: "text-[25px]",
      slashH: "h-[24px]",
      gap: "gap-3",
    },
  }[size];

  const textColorCls =
    theme === "dark"
      ? "text-[#f5f5f7]"
      : theme === "light"
        ? "text-[#1d1d1f]"
        : "text-[#1d1d1f] dark:text-[#f5f5f7]";

  return (
    <div
      className={cn(
        "spv-logo-group inline-flex items-center select-none shrink-0",
        dimensions.gap,
        className
      )}
    >
      {/* Apple Squircle with Rotating Luminous Rim + Staggered SF Symbols Wave */}
      <div
        className={cn(
          "spv-icon-squircle relative flex items-center justify-center shrink-0",
          dimensions.iconBox,
          "drop-shadow-[0_4px_10px_rgba(9,13,22,0.28)]"
        )}
      >
        <svg
          viewBox="0 0 1024 1024"
          className="w-full h-full block"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={`sq-${uid}`}>
              <path d={SQUIRCLE_OUTER_PATH} />
            </clipPath>

            <clipPath id={`sq-in-${uid}`}>
              <path d={SQUIRCLE_INNER_PATH} />
            </clipPath>

            {/* Deep Obsidian Glass Core */}
            <linearGradient id={`bg-${uid}`} x1="18%" y1="0%" x2="82%" y2="100%">
              <stop offset="0%" stopColor="#243247" />
              <stop offset="48%" stopColor="#101725" />
              <stop offset="100%" stopColor="#070b12" />
            </linearGradient>

            {/* Static Subtle Rim Base */}
            <linearGradient id={`rim-base-${uid}`} x1="15%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
              <stop offset="50%" stopColor="#64748b" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.28" />
            </linearGradient>

            {/* Rotating Luminous Apple Intelligence Beam */}
            <linearGradient id={`beam-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
              <stop offset="28%" stopColor="#38bdf8" stopOpacity="0.95" />
              <stop offset="52%" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="78%" stopColor="#070b12" stopOpacity="0" />
              <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.9" />
            </linearGradient>

            <radialGradient id={`glow-${uid}`} cx="50%" cy="84%" r="58%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
              <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#070b12" stopOpacity="0" />
            </radialGradient>

            <linearGradient id={`sheen-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.24" />
              <stop offset="36%" stopColor="#ffffff" stopOpacity="0.04" />
              <stop offset="42%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            <linearGradient id={`white-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>

            <linearGradient id={`emerald-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="48%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            <filter id={`sh-${uid}`} x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#020617" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Outer Squircle: Rotating Luminous Perimeter Beam */}
          <g clipPath={`url(#sq-${uid})`}>
            <rect width="1024" height="1024" fill={`url(#bg-${uid})`} />
            <rect width="1024" height="1024" fill={`url(#rim-base-${uid})`} />
            <g className="spv-rim-rotor">
              <rect
                x="-320"
                y="-320"
                width="1664"
                height="1664"
                fill={`url(#beam-${uid})`}
              />
            </g>

            {/* Inner Squircle Glass Core */}
            <g clipPath={`url(#sq-in-${uid})`}>
              <rect width="1024" height="1024" fill={`url(#bg-${uid})`} />
              <circle
                cx="512"
                cy="840"
                r="560"
                fill={`url(#glow-${uid})`}
                className="spv-ambient-pulse"
              />
              <ellipse cx="512" cy="70" rx="560" ry="300" fill={`url(#sheen-${uid})`} />

              {/* Staggered SF Symbols Wave: s · p · v */}
              <g
                filter={`url(#sh-${uid})`}
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Display", "Helvetica Neue", "Inter", sans-serif',
                  fontWeight: 800,
                  fontSize: "418px",
                }}
              >
                <g className="spv-glyph-s">
                  <text x="276" y="592" textAnchor="middle" fill={`url(#white-${uid})`}>
                    s
                  </text>
                </g>
                <g className="spv-glyph-p" style={{ transformOrigin: "508px 520px" }}>
                  <text x="508" y="592" textAnchor="middle" fill={`url(#emerald-${uid})`}>
                    p
                  </text>
                </g>
                <g className="spv-glyph-v">
                  <text x="744" y="592" textAnchor="middle" fill={`url(#white-${uid})`}>
                    v
                  </text>
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* Apple SF Pro Wordmark Lockup */}
      {!iconOnly && (
        <div
          className={cn(
            "inline-flex items-center tracking-[-0.03em] leading-none",
            dimensions.wordmark,
            textColorCls
          )}
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", "Inter", sans-serif',
          }}
        >
          <span className="font-semibold">Factura</span>
          <svg
            viewBox="0 0 14 28"
            className={cn("spv-logo-slash w-auto mx-[2.5px] shrink-0", dimensions.slashH)}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`slash-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <line
              x1="10.5"
              y1="3"
              x2="3.5"
              y2="25"
              stroke={`url(#slash-${uid})`}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-bold">SPV</span>
        </div>
      )}
    </div>
  );
}

export default FacturaSpvLogo;
