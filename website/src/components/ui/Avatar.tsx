import { useState } from "react";

// Round avatar: the photo if there is one (and it loads), else the first
// letter on primary-light — same fallback the app uses everywhere.
export function Avatar({
  url,
  name,
  size = 40,
  className,
  ring,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-light ${
        ring ? "border-[1.5px] border-white" : ""
      } ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {url && !failed ? (
        <img
          src={url}
          alt={name ?? ""}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-bold text-primary" style={{ fontSize: size * 0.42 }}>
          {letter}
        </span>
      )}
    </div>
  );
}

type Person = { avatar: string | null; name: string | null };

// Overlapping avatars with a "+N" bubble (the app's AvatarStack).
export function AvatarStack({ people, size = 24, max = 3 }: { people: Person[]; size?: number; max?: number }) {
  const visible = people.slice(0, max);
  const extra = people.length - visible.length;
  return (
    <div className="flex items-center">
      {visible.map((p, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.35, zIndex: visible.length - i }}>
          <Avatar url={p.avatar} name={p.name} size={size} ring />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="flex items-center justify-center rounded-full border-[1.5px] border-white bg-gray-100 font-bold text-muted"
          style={{ marginLeft: -size * 0.35, width: size, height: size, fontSize: size * 0.34 }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
