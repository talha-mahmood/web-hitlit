import { useRef, useState } from "react";
import { Ionicon } from "./icons/Icon";

// Swipeable photo strip with the app's pill page dots; arrow buttons on
// hover-capable screens.
export default function ImageGallery({ images, className }: { images: { id: string; url: string }[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, images.length - 1));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={`group relative overflow-hidden ${className ?? ""}`}>
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth) setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
      >
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.url}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            className="h-full w-full shrink-0 snap-start object-cover"
            draggable={false}
          />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <div className="absolute bottom-6 flex w-full justify-center gap-1.5 lg:bottom-4">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-surface" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
          {active > 0 && (
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(active - 1)}
              className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-card group-hover:flex"
            >
              <Ionicon name="chevron-back" size={18} />
            </button>
          )}
          {active < images.length - 1 && (
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(active + 1)}
              className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-card group-hover:flex"
            >
              <Ionicon name="chevron-forward" size={18} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
