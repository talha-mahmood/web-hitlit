import { useEffect, useRef, useState } from "react";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";

export type PromoSlide = {
  key: string;
  title: string;
  image: string;
  onPress?: () => void;
};

const AUTO_ADVANCE_MS = 4500;

function SlideImage({ slide }: { slide: PromoSlide }) {
  const img = <img src={slide.image} alt={slide.title} className="aspect-[1821/864] w-full object-cover" draggable={false} />;
  // Like the app, a slide is only interactive when it has an onPress.
  return slide.onPress ? (
    <button type="button" onClick={slide.onPress} aria-label={slide.title} className="press block w-full overflow-hidden rounded-3xl">
      {img}
    </button>
  ) : (
    <div className="overflow-hidden rounded-3xl">{img}</div>
  );
}

// Port of the app's PromoCarousel (image slides): swipeable, auto-advances
// every 4.5s (a manual swipe or hover pauses it), gradient pill for the
// active dot. On desktop two slides show side by side and the carousel
// pages through them in pairs, instead of one banner the height of the screen.
// `single`: one slide at a time on every screen (e.g. inside a hero column).
// `onDark`: dot colours for a dark-green background.
export default function PromoCarousel({ slides, single, onDark }: { slides: PromoSlide[]; single?: boolean; onDark?: boolean }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const perPage = isDesktop && !single ? 2 : 1;
  const pages = Math.max(1, Math.ceil(slides.length / perPage));

  const goTo = (page: number) => {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: page * track.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (pages <= 1 || paused) return;
    const t = setTimeout(() => goTo((active + 1) % pages), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [active, paused, pages]);

  // Snap back to a valid page when the layout switches between 1 and 2 up.
  useEffect(() => {
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [perPage]);

  if (!slides.length) return null;

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== active) setActive(Math.max(0, Math.min(i, pages - 1)));
  };

  return (
    <section className={single ? "" : "mb-4"} aria-roledescription="carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div ref={trackRef} onScroll={onScroll} tabIndex={0} role="region" aria-roledescription="carousel" aria-label="Highlights" className={`no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-3xl lg:gap-0 ${onDark ? "shadow-login ring-1 ring-white/10" : ""}`}>
        {slides.map((s, i) => (
          <div key={s.key} className={`shrink-0 snap-start ${perPage === 2 ? "w-1/2 px-2 first:pl-0 [&:nth-child(2n)]:pr-0 [&:nth-child(2n+1)]:pl-0" : "w-full"}`} aria-hidden={Math.floor(i / perPage) !== active}>
            <SlideImage slide={s} />
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className={`flex justify-center gap-[5px] ${onDark ? "mt-3" : "mt-2"}`}>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === active ? (onDark ? "w-[18px] bg-white" : "w-[18px] bg-brand") : onDark ? "w-1.5 bg-white/35" : "w-1.5 bg-border"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
