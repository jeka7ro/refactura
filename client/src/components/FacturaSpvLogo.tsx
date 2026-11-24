import React from "react";
import { cn } from "@/lib/utils";

interface FacturaSpvLogoProps {
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
  theme?: "auto" | "light" | "dark";
  className?: string;
}

const SQUIRCLE_CLIP_PATH =
  "M 340,0 L 684,0 C 803,0 863,0 911,20.4 C 957,40 984,67 1003.6,113 C 1024,161 1024,221 1024,340 L 1024,684 C 1024,803 1024,863 1003.6,911 C 984,957 957,984 911,1003.6 C 863,1024 803,1024 684,1024 L 340,1024 C 221,1024 161,1024 113,1003.6 C 67,984 40,957 20.4,911 C 0,863 0,803 0,684 L 0,340 C 0,221 0,161 20.4,113 C 40,67 67,40 113,20.4 C 161,0 221,0 340,0 Z";

const SQUIRCLE_RIM_PATH =
  "M 340,10 L 684,10 C 800,10 859,10 905,29.8 C 950,49 977,76 996.2,121 C 1014,166 1014,224 1014,340 L 1014,684 C 1014,800 1014,858 996.2,903 C 977,948 950,975 905,994.2 C 859,1014 800,1014 684,1014 L 340,1014 C 224,1014 165,1014 119,994.2 C 74,975 47,948 27.8,903 C 10,858 10,800 10,684 L 10,340 C 10,224 10,166 27.8,121 C 47,76 74,49 119,29.8 C 165,10 224,10 340,10 Z";

/**
 * Apple macOS Tahoe / Sequoia Liquid Glass Brand Mark & Lockup for Factura/SPV.
 * Uses continuous-curvature Apple superellipse geometry, smooth ambient Liquid Glass
 * specular & aurora motion, and native SF Pro Display typography.
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
      {/* Apple Continuous-Curvature Liquid Glass Squircle with Smooth Motion */}
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
              <path d={SQUIRCLE_CLIP_PATH} />
            </clipPath>

            <linearGradient id={`bg-${uid}`} x1="18%" y1="0%" x2="82%" y2="100%">
              <stop offset="0%" stopColor="#293850" />
              <stop offset="46%" stopColor="#121a29" />
              <stop offset="100%" stopColor="#070b12" />
            </linearGradient>

            <radialGradient id={`top-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.3" />
              <stop offset="58%" stopColor="#3b82f6" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#070b12" stopOpacity="0" />
            </radialGradient>

            <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.54" />
              <stop offset="52%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#070b12" stopOpacity="0" />
            </radialGradient>

            <linearGradient id={`sheen-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
              <stop offset="38%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="44%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            {/* Diagonal Liquid Glass Specular Sweep */}
            <linearGradient id={`glint-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="42%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.24" />
              <stop offset="58%" stopColor="#a7f3d0" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            <linearGradient id={`rim-${uid}`} x1="18%" y1="0%" x2="82%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="42%" stopColor="#ffffff" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.36" />
            </linearGradient>

            <linearGradient id={`white-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="68%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>

            <linearGradient id={`emerald-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="48%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            <filter id={`sh-${uid}`} x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="18" stdDeviation="20" floodColor="#020617" floodOpacity="0.52" />
            </filter>
          </defs>

          <g clipPath={`url(#sq-${uid})`}>
            <rect width="1024" height="1024" fill={`url(#bg-${uid})`} />

            {/* Smooth Floating Liquid Orbs */}
            <circle
              cx="390"
              cy="120"
              r="580"
              fill={`url(#top-${uid})`}
              className="spv-icon-sapphire"
            />
            <circle
              cx="530"
              cy="880"
              r="600"
              fill={`url(#glow-${uid})`}
              className="spv-icon-aurora"
            />

            <ellipse cx="512" cy="70" rx="580" ry="320" fill={`url(#sheen-${uid})`} />

            {/* Crisp Monogram */}
            <g
              filter={`url(#sh-${uid})`}
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Display", "Helvetica Neue", "Inter", sans-serif',
                fontWeight: 800,
                fontSize: "430px",
                letterSpacing: "-0.04em",
              }}
            >
              <text x="512" y="594" textAnchor="middle">
                <tspan fill={`url(#white-${uid})`}>s</tspan>
                <tspan fill={`url(#emerald-${uid})`} className="spv-icon-p-glow">
                  p
                </tspan>
                <tspan fill={`url(#white-${uid})`}>v</tspan>
              </text>
            </g>

            {/* Smooth Specular Glass Glint */}
            <rect
              x="-240"
              y="-360"
              width="420"
              height="1740"
              fill={`url(#glint-${uid})`}
              className="spv-icon-glint"
            />

            <path
              d={SQUIRCLE_RIM_PATH}
              fill="none"
              stroke={`url(#rim-${uid})`}
              strokeWidth="22"
            />
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
