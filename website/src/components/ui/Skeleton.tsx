import type { CSSProperties } from "react";

// Same shapes as the app's Skeleton.tsx — a pulsing gray block, a generic
// card, stacked card rows, and a detail-screen header.
export function SkeletonBlock({
  width,
  height,
  radius = 8,
  className,
  style,
}: {
  width?: number | string;
  height: number;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`animate-skeleton bg-border ${className ?? ""}`}
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="flex gap-3 rounded-2xl bg-surface p-3 shadow-card">
      <SkeletonBlock width={72} height={72} radius={12} />
      <div className="flex flex-1 flex-col justify-center gap-2">
        <SkeletonBlock width="70%" height={14} />
        <SkeletonBlock width="45%" height={12} />
        <SkeletonBlock width="55%" height={12} />
      </div>
    </div>
  );
}

export function SkeletonCardRows({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonDetailHeader() {
  return (
    <div className="flex flex-col gap-3.5">
      <SkeletonBlock width="100%" height={180} radius={20} />
      <SkeletonBlock width="60%" height={20} />
      <SkeletonBlock width="40%" height={14} />
      <div className="flex gap-2">
        <SkeletonBlock width={90} height={28} radius={14} />
        <SkeletonBlock width={90} height={28} radius={14} />
      </div>
    </div>
  );
}
