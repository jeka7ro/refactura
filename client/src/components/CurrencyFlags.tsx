import React from "react";

export const EuFlag = ({ className = "w-4 h-2.5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 640 480"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="640" height="480" fill="#003399" />
    <g fill="#ffcc00" transform="translate(320,240) scale(20)">
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
        const rad = (deg * Math.PI) / 180;
        const x = Math.sin(rad) * 6.5;
        const y = -Math.cos(rad) * 6.5;
        return (
          <polygon
            key={deg}
            points="0,-1 0.28,-0.25 0.95,-0.25 0.4,0.18 0.62,0.85 0,0.45 -0.62,0.85 -0.4,0.18 -0.95,-0.25 -0.28,-0.25"
            transform={`translate(${x.toFixed(2)},${y.toFixed(2)}) scale(0.65)`}
          />
        );
      })}
    </g>
  </svg>
);

export const UsFlag = ({ className = "w-4 h-2.5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 640 480"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="640" height="480" fill="#bd3d44" />
    <path
      stroke="#fff"
      strokeWidth="37"
      d="M0 55.4h640M0 129.2h640M0 203.1h640M0 277h640M0 350.8h640M0 424.6h640"
    />
    <rect width="256" height="258.5" fill="#192f5d" />
    <g fill="#fff">
      {[
        [25, 28], [65, 28], [105, 28], [145, 28], [185, 28], [225, 28],
        [45, 56], [85, 56], [125, 56], [165, 56], [205, 56],
        [25, 84], [65, 84], [105, 84], [145, 84], [185, 84], [225, 84],
        [45, 112], [85, 112], [125, 112], [165, 112], [205, 112],
        [25, 140], [65, 140], [105, 140], [145, 140], [185, 140], [225, 140],
        [45, 168], [85, 168], [125, 168], [165, 168], [205, 168],
        [25, 196], [65, 196], [105, 196], [145, 196], [185, 196], [225, 196],
        [45, 224], [85, 224], [125, 224], [165, 224], [205, 224],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="6" />
      ))}
    </g>
  </svg>
);

export const RoFlag = ({ className = "w-4 h-2.5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 640 480"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="213.3" height="480" fill="#002b7f" />
    <rect x="213.3" width="213.4" height="480" fill="#fcd116" />
    <rect x="426.7" width="213.3" height="480" fill="#ce1126" />
  </svg>
);

export const GbFlag = ({ className = "w-4 h-2.5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 640 480"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path fill="#012169" d="M0 0v480h640V0z" />
    <path stroke="#fff" strokeWidth="60" d="M0 0l640 480M640 0L0 480" />
    <path stroke="#c8102e" strokeWidth="36" d="M0 0l640 480M640 0L0 480" />
    <path stroke="#fff" strokeWidth="100" d="M320 0v480M0 240h640" />
    <path stroke="#c8102e" strokeWidth="60" d="M320 0v480M0 240h640" />
  </svg>
);

export const ChFlag = ({ className = "w-4 h-2.5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 640 480"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="640" height="480" fill="#d52b1e" />
    <g fill="#fff">
      <rect x="270" y="110" width="100" height="260" rx="4" />
      <rect x="190" y="190" width="260" height="100" rx="4" />
    </g>
  </svg>
);

export const MdFlag = ({ className = "w-4 h-2.5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 640 480"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="213.3" height="480" fill="#003da5" />
    <rect x="213.3" width="213.4" height="480" fill="#ffd100" />
    <rect x="426.7" width="213.3" height="480" fill="#c8102e" />
    <circle cx="320" cy="240" r="42" fill="#8a4b08" opacity="0.85" />
  </svg>
);
