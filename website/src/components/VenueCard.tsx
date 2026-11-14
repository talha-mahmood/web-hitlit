import { colors } from "@app/constants/theme";
import type { VenueListItem } from "@app/lib/api/venues";
import { getSportImage } from "@app/lib/sportImages";
import { getVenuePhoto } from "@app/lib/venuePhotos";
import { imageUrl } from "@/lib/cn";
import { Ionicon } from "./icons/Icon";

const SPORT_CHIP_COLORS = ["#0EA5E9", "#F59E0B", "#8B5CF6", "#EC4899", "#16A34A"];

// Port of the app's VenueCard: cover photo (uploaded → curated demo photo →
// sport photo → tint), rating, name, city, sport chips, optional favorite
// heart and distance pill. `minimal` is the Home "Venues near you" variant.
export default function VenueCard({
  venue,
  isFavorite,
  onPress,
  onToggleFavorite,
  showFavorite = true,
  distanceLabel,
  maxSportChips,
  minimal = false,
  imageHeight,
}: {
  venue: VenueListItem;
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
  showFavorite?: boolean;
  distanceLabel?: string;
  maxSportChips?: number;
  minimal?: boolean;
  imageHeight?: number;
}) {
  const coverImage = [...venue.venue_images].sort((a, b) => a.display_order - b.display_order).at(0)?.image_url;
  const allSportNames = Array.from(new Set(venue.court.map((c) => c.sports?.name).filter(Boolean))) as string[];
  const sportNames = maxSportChips !== undefined ? allSportNames.slice(0, maxSportChips) : allSportNames;
  const fallback = imageUrl(getVenuePhoto(venue.id) ?? getSportImage(allSportNames[0] ?? ""));
  const photo = coverImage ?? fallback;
  const rating = venue.rating > 0 ? venue.rating.toFixed(1) : "New";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPress())}
      className="card press block w-full cursor-pointer overflow-hidden text-left"
    >
      <div className="relative w-full bg-primary-light" style={{ height: imageHeight ?? (minimal ? 96 : 140) }}>
        {photo && <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />}
        {showFavorite && (
          <button
            type="button"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={!!isFavorite}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
            className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 transition active:scale-75"
          >
            <Ionicon name={isFavorite ? "heart" : "heart-outline"} size={16} color={isFavorite ? colors.danger : colors.ink} />
          </button>
        )}
        {minimal && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-[3px] rounded-full bg-black/60 px-[7px] py-[3px] text-xs font-bold text-white">
            <Ionicon name="star" size={11} color={colors.warning} />
            {rating}
          </span>
        )}
        {distanceLabel ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-[3px] text-xs font-semibold text-white">{distanceLabel}</span>
        ) : null}
      </div>
      <div className="p-2.5">
        <div className="flex items-center justify-between">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{venue.name}</p>
          {!minimal && (
            <span className="ml-2 flex items-center gap-1 text-sm text-ink">
              <Ionicon name="star" size={14} color={colors.warning} />
              {rating}
            </span>
          )}
        </div>
        {!minimal && <p className="mt-0.5 truncate text-sm text-muted">{venue.city}</p>}
        {!minimal && (maxSportChips !== undefined || sportNames.length > 0) ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5" style={{ minHeight: maxSportChips !== undefined ? 20 : undefined }}>
            {sportNames.map((name, i) => {
              const color = SPORT_CHIP_COLORS[i % SPORT_CHIP_COLORS.length];
              return (
                <span
                  key={name}
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: `${color}1A`, color }}
                >
                  {name}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
