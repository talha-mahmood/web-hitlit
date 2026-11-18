import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useVenueDetail } from "@app/hooks/useVenueDetail";
import { useMarkGameVenueContacted } from "@app/hooks/useGames";
import { getAmenityIcon } from "@app/lib/amenities";
import { getSportImage } from "@app/lib/sportImages";
import { getSportIcon } from "@app/lib/sportIcons";
import { getVenuePhoto } from "@app/lib/venuePhotos";
import { imageUrl } from "@/lib/cn";
import { ONLINE_BOOKING_ENABLED } from "@/lib/features";
import { getSportImageLarge } from "@/lib/sportImageLarge";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import ImageGallery from "@/components/ImageGallery";
import { SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { GradientButton } from "@/components/ui/Button";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

// Local mobile numbers are stored as 03XXXXXXXXX — wa.me needs 92XXXXXXXXXX.
function toWhatsAppUrl(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const international = digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

function ContactRow({ icon, label, href, onClick }: { icon: string; label: string; href: string; onClick?: () => void }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      onClick={onClick}
      className="press flex items-center gap-2.5 rounded-2xl bg-primary-light px-4 py-3 transition hover:brightness-[0.97]"
    >
      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-surface">
        <Ionicon name={icon} size={20} color={colors.primaryDark} />
      </span>
      <span className="flex-1 text-[15.5px] font-bold text-primary-dark">{label}</span>
      <Ionicon name="chevron-forward" size={18} color={colors.primaryDark} />
    </a>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-base font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

// Port of VenueDetailScreen: photos, name + rating, maps link, hours,
// "Book Venue Here" (WhatsApp / call), description, facilities, amenities
// (union across courts) and the courts list. Courts are info-only, like the
// app, unless online booking is switched on.
export default function VenueDetailPage() {
  const { venueId = "" } = useParams();
  const [search] = useSearchParams();
  const forGameId = search.get("forGame") ?? undefined;
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.venues());

  const { data: venue, isLoading } = useVenueDetail(venueId);
  const markVenueContacted = useMarkGameVenueContacted();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-4 lg:px-8 lg:pt-6">
        <SkeletonDetailHeader />
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-24 text-center">
        <span className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gray-100">
          <Ionicon name="location-outline" size={34} color={colors.muted} />
        </span>
        <h1 className="text-xl font-extrabold text-ink">Venue not found</h1>
        <p className="mt-2 text-muted">This venue may have been removed or is no longer active.</p>
        <GradientButton className="mt-6 w-full" onClick={() => navigate(paths.venues(), { state: { tab: "venues" } })}>
          Browse venues
        </GradientButton>
      </div>
    );
  }

  const images = [...venue.venue_images].sort((a, b) => a.display_order - b.display_order).map((i) => ({ id: i.id, url: i.image_url }));
  const fallback = imageUrl(getVenuePhoto(venue.id)) ?? getSportImageLarge(venue.court[0]?.sports?.name ?? "");
  const amenities = Array.from(new Set(venue.court.flatMap((c) => c.amenities ?? [])));
  const locationText = venue.address ? `${venue.address}, ${venue.city}` : venue.city;
  const activeCourts = venue.court.filter((c) => c.isactive);

  // Messaging the venue from a game's "Book Venue" button is what flips that
  // button to "Venue Booked" (no payment integration yet).
  const onWhatsApp = () => {
    if (forGameId) markVenueContacted.mutate(forGameId);
  };

  const bookCard =
    venue.whatsapp_number || venue.contact_phone ? (
      <div>
        <h2 className="mb-2 text-base font-bold text-ink">Book Venue Here</h2>
        <div className="flex flex-col gap-2.5">
          {venue.whatsapp_number && (
            <ContactRow icon="logo-whatsapp" label={venue.whatsapp_number} href={toWhatsAppUrl(venue.whatsapp_number)} onClick={onWhatsApp} />
          )}
          {venue.contact_phone && <ContactRow icon="call-outline" label={venue.contact_phone} href={`tel:${venue.contact_phone.replace(/\D/g, "")}`} />}
        </div>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-7xl lg:px-8 lg:pt-6">
      <div className="relative">
        {images.length > 0 ? (
          <ImageGallery images={images} className="h-[260px] sm:h-[340px] lg:h-[420px] lg:rounded-[28px]" />
        ) : fallback ? (
          <img src={fallback} alt="" className="h-[260px] w-full object-cover sm:h-[340px] lg:h-[420px] lg:rounded-[28px]" />
        ) : (
          <div className="h-[260px] bg-primary-light sm:h-[340px] lg:h-[420px] lg:rounded-[28px]" />
        )}
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="absolute left-4 top-[calc(env(safe-area-inset-top)+16px)] flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-card transition hover:bg-surface lg:top-4"
        >
          <Ionicon name="arrow-back" size={20} color={colors.ink} />
        </button>
      </div>

      <div className="relative -mt-5 rounded-t-[26px] bg-surface px-3.5 pb-8 pt-5 sm:px-6 lg:mt-0 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-0 lg:pt-7">
        <div className="min-w-0">
          <div className="flex items-start justify-between">
            <h1 className="mr-3 flex-1 text-xl font-extrabold text-ink lg:text-[28px] lg:leading-tight">{venue.name}</h1>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning-light px-2.5 py-1 text-sm font-bold text-ink">
              <Ionicon name="star" size={14} color={colors.warning} />
              {venue.rating > 0 ? venue.rating.toFixed(1) : "New"}
            </span>
          </div>

          {venue.maps_link ? (
            <a
              href={venue.maps_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <Ionicon name="location-outline" size={15} color={colors.primary} />
              <span className="truncate">{locationText}</span>
              <Ionicon name="open-outline" size={15} color={colors.primary} />
            </a>
          ) : (
            <p className="mt-2.5 flex items-center gap-1.5 text-muted">
              <Ionicon name="location-outline" size={15} color={colors.muted} />
              <span className="truncate">{locationText}</span>
            </p>
          )}

          {(venue.start_time || venue.end_time) && (
            <p className="mt-1.5 flex items-center gap-1.5 text-muted">
              <Ionicon name="time-outline" size={15} color={colors.muted} />
              {venue.start_time} - {venue.end_time}
            </p>
          )}

          {bookCard && <div className="mt-4 lg:hidden">{bookCard}</div>}

          {venue.description && <p className="mt-4 whitespace-pre-line leading-5 text-ink">{venue.description}</p>}

          {venue.venue_facilities.length > 0 && (
            <Section title="Facilities">
              <div className="flex flex-wrap gap-2">
                {venue.venue_facilities.map((f) => (
                  <span key={f.id} className="flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1.5 text-sm font-semibold text-primary-dark">
                    <MCIcon name={getAmenityIcon(f.name)} size={15} color={colors.primaryDark} />
                    {f.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {amenities.length > 0 && (
            <Section title="Amenities">
              <div className="flex flex-wrap gap-x-2.5 gap-y-3">
                {amenities.map((label) => (
                  <div key={label} className="flex min-w-[47%] items-center gap-2.5 rounded-2xl border border-border px-3.5 py-3 sm:min-w-[31%]">
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary-light">
                      <MCIcon name={getAmenityIcon(label)} size={17} color={colors.primaryDark} />
                    </span>
                    <span className="text-sm font-medium text-ink">{label}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Courts">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {activeCourts.map((court) => {
                const sportName = court.sports?.name ?? "";
                const courtPhoto = [...(court.court_images ?? [])].sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
                const photo = courtPhoto ?? imageUrl(getSportImage(sportName));
                const { icon, bg, fg } = getSportIcon(sportName);
                const content = (
                  <>
                    {photo ? (
                      <img src={photo} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-[14px] object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: bg }}>
                        <MCIcon name={icon} size={24} color={fg} />
                      </span>
                    )}
                    <span className="ml-3 mr-2 min-w-0 flex-1">
                      <span className="block truncate font-bold text-ink">{court.name}</span>
                      <span className="mt-0.5 block truncate text-sm text-muted">
                        {sportName}
                        {court.surface_type ? ` · ${court.surface_type}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-extrabold text-primary-dark">Rs {court.price_per_hour}/hr</span>
                  </>
                );
                return ONLINE_BOOKING_ENABLED ? (
                  <button
                    key={court.id}
                    type="button"
                    onClick={() => navigate(paths.slotPicker(venue.id, court.id, { forGameId }))}
                    className="press flex items-center rounded-2xl border border-border bg-surface px-3 py-3 text-left transition hover:border-primary/40 hover:shadow-card"
                  >
                    {content}
                  </button>
                ) : (
                  <div key={court.id} className="flex items-center rounded-2xl border border-border bg-surface px-3 py-3">
                    {content}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {bookCard && (
          <aside className="hidden lg:block">
            <div className="card sticky top-[calc(var(--header-h)+24px)] p-5">{bookCard}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
