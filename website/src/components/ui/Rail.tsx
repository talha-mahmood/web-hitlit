import { useEffect, useRef, useState, type ReactNode } from "react";
import { Ionicon } from "../icons/Icon";

// A horizontal scroll row (the app's horizontal FlatList). Touch/trackpad
// scroll as usual; on desktop, arrow buttons appear when there's more to see.
export default function Rail({ children, gap = 10 }: { children: ReactNode; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const scrollBy = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="group/rail relative">
      <div ref={ref} onScroll={update} className="no-scrollbar -mx-1 flex overflow-x-auto scroll-smooth px-1 pb-2 pt-0.5" style={{ gap }}>
        {children}
      </div>
      {canLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="absolute -left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface shadow-card transition hover:bg-gray-50 lg:flex"
        >
          <Ionicon name="chevron-back" size={18} />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="absolute -right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface shadow-card transition hover:bg-gray-50 lg:flex"
        >
          <Ionicon name="chevron-forward" size={18} />
        </button>
      )}
    </div>
  );
}
