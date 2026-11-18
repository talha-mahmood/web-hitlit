import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { colors } from "@app/constants/theme";
import {
  useAdminVenueDetail,
  useUpdateVenue,
  useAddVenueImage,
  useDeleteVenueImage,
  useReorderVenueImage,
  useAddCourtImage,
  useDeleteCourtImage,
  useReorderCourtImage,
  useDeleteCourt,
  useAddCourt,
  useUpdateCourt,
  useCourtPriceRules,
  useAddCourtPriceRule,
  useDeleteCourtPriceRule,
} from "@app/hooks/useVenuesAdmin";
import { useCourtBookingsForDate, useBlockSlot, useUnblockSlot } from "@app/hooks/useAdminSlots";
import { useSports } from "@app/hooks/useSports";
import { useAuthStore } from "@app/store/authStore";
import type { CourtPriceRule } from "@app/lib/api/venuesAdmin";
import { extractCoordsFromGoogleMapsLink } from "@app/lib/googleMapsLink";
import { isValidName, NAME_REQUIREMENT_HINT } from "@app/lib/nameValidation";
import { pickImages, uploadImage } from "@app/lib/upload";
import { downloadAndShareImage } from "@app/lib/shareImage";
import { AMENITY_OPTIONS } from "@app/lib/amenities";
import { getSportImage } from "@app/lib/sportImages";
import { getSportIcon } from "@app/lib/sportIcons";
import { toLocalDateStr, getNext14Days, generateFullDaySlots, isSlotPast, slotBoundaryDateTime, resolveSlotPrice, type Slot } from "@app/lib/slots";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { imageUrl } from "@/lib/cn";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import FieldInput from "@/components/ui/FieldInput";
import Spinner from "@/components/ui/Spinner";
import { SkeletonBlock, SkeletonCardRows } from "@/components/ui/Skeleton";
import { AdminPageHeader, EmptyBox, FieldLabel, GradientAction, Loading, PageBody, PhotoGrid, SportIconBadge, SwitchRow, TextArea, useAdminPaths } from "@/components/admin/AdminParts";
import { useAppNavigate, useGoBack } from "@/routes/navigation";

function looksLikeLink(value: string): boolean {
  return /https?:\/\/|www\.|\.(com|net|org|gl|co|io|ly|me|app|pk)\b/i.test(value);
}

function isShortMapsLink(url: string): boolean {
  try {
    return ["goo.gl", "maps.app.goo.gl", "app.goo.gl"].includes(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}

const field = (props: { value: string; onChange: (v: string) => void; placeholder: string; maxLength?: number; inputMode?: "numeric" | "decimal" | "tel" | "url"; label: string }) => (
  <div className="mb-4">
    <FieldInput value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder} maxLength={props.maxLength} inputMode={props.inputMode} aria-label={props.label} containerClassName="!bg-surface" />
  </div>
);

// Port of EditVenueDetailsScreen.
export function EditVenueDetailsPage() {
  const { venueId = "" } = useParams();
  const p = useAdminPaths();
  const goBack = useGoBack(p.venue(venueId));
  const { data: venue, isLoading } = useAdminVenueDetail(venueId);
  const updateVenue = useUpdateVenue(venueId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [rating, setRating] = useState("");
  const [rules, setRules] = useState("");
  const [isactive, setIsactive] = useState(true);
  const [mapsLink, setMapsLink] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (venue && !initialized) {
      setName(venue.name ?? "");
      setDescription(venue.description ?? "");
      setAddress(venue.address ?? "");
      setCity(venue.city ?? "");
      setStartTime(venue.start_time?.slice(0, 5) ?? "");
      setEndTime(venue.end_time?.slice(0, 5) ?? "");
      setContactPhone(venue.contact_phone ?? "");
      setWhatsappNumber(venue.whatsapp_number ?? "");
      setRating(venue.rating > 0 ? String(venue.rating) : "");
      setRules(venue.rules_and_policies ?? "");
      setIsactive(venue.isactive);
      setMapsLink(venue.maps_link ?? "");
      setInitialized(true);
    }
  }, [venue, initialized]);

  const handleSave = async () => {
    if (!isValidName(name)) return Alert.alert("Invalid Name", `Venue name must be ${NAME_REQUIREMENT_HINT}.`);
    if (looksLikeLink(address)) return Alert.alert("Invalid Address", "Address can't contain a link. Paste the Google Maps link in the field below instead.");
    if (looksLikeLink(city)) return Alert.alert("Invalid City", "City can't contain a link. Paste the Google Maps link in the field below instead.");
    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) return Alert.alert("Invalid Time", "Start time must be in HH:MM format, e.g. 06:00.");
    if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) return Alert.alert("Invalid Time", "End time must be in HH:MM format, e.g. 23:00.");
    const trimmedRating = rating.trim();
    const ratingValue = trimmedRating ? Number(trimmedRating) : 0;
    if (trimmedRating && (Number.isNaN(ratingValue) || ratingValue < 0 || ratingValue > 5)) return Alert.alert("Invalid Rating", "Rating must be a number between 0 and 5, e.g. 4.5.");
    const trimmedLink = mapsLink.trim();
    let coords: { lat: number; lng: number } | null = null;
    if (trimmedLink) {
      setSavingLocation(true);
      coords = await extractCoordsFromGoogleMapsLink(trimmedLink);
      setSavingLocation(false);
      if (!coords) {
        // A browser can't follow a maps.app.goo.gl short link (cross-origin),
        // so on the web the full link from the address bar is needed.
        return Alert.alert(
          "Couldn't Read That Link",
          isShortMapsLink(trimmedLink)
            ? "Short maps.app.goo.gl links can't be read in a web browser. Open the link, then copy the full Google Maps address from your browser's address bar and paste it here."
            : "No location could be found in this Google Maps link. Open the pin in Google Maps, use Share, and paste that link here."
        );
      }
    }
    updateVenue.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        start_time: startTime || null,
        end_time: endTime || null,
        contact_phone: contactPhone.trim() || null,
        whatsapp_number: whatsappNumber.trim() || null,
        rating: ratingValue,
        rules_and_policies: rules.trim() || null,
        isactive,
        maps_link: trimmedLink || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      },
      { onSuccess: goBack, onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not save venue.")) }
    );
  };

  if (isLoading || !initialized) return <Loading />;

  return (
    <>
      <AdminPageHeader title="Edit Venue" backTo={p.venue(venueId)} right={<GradientAction onPress={handleSave} pending={updateVenue.isPending || savingLocation} label="Save" />} />
      <PageBody narrow>
        <form onSubmit={(e) => (e.preventDefault(), handleSave())}>
          <FieldLabel>Venue Name</FieldLabel>
          {field({ value: name, onChange: setName, placeholder: "e.g. Elite Sports Arena", maxLength: 80, label: "Venue name" })}
          <FieldLabel>Description</FieldLabel>
          <TextArea value={description} onChange={setDescription} placeholder="Describe your venue..." maxLength={500} label="Description" />
          <FieldLabel>Address</FieldLabel>
          {field({ value: address, onChange: setAddress, placeholder: "Street address", maxLength: 200, label: "Address" })}
          <FieldLabel>City</FieldLabel>
          {field({ value: city, onChange: setCity, placeholder: "e.g. Karachi", maxLength: 60, label: "City" })}
          <FieldLabel hint={`Open this venue's pin in Google Maps, tap Share, and paste the link here. Shown to customers so they can open it directly, and also sets where this venue shows up in "Venues near you" distance sorting.`}>Google Maps Link</FieldLabel>
          {field({ value: mapsLink, onChange: setMapsLink, placeholder: "https://maps.google.com/...", inputMode: "url", label: "Google Maps link" })}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Opens (HH:MM)</FieldLabel>
              {field({ value: startTime, onChange: setStartTime, placeholder: "06:00", maxLength: 5, label: "Opens" })}
            </div>
            <div>
              <FieldLabel>Closes (HH:MM)</FieldLabel>
              {field({ value: endTime, onChange: setEndTime, placeholder: "23:00", maxLength: 5, label: "Closes" })}
            </div>
          </div>
          <FieldLabel>Contact Phone</FieldLabel>
          {field({ value: contactPhone, onChange: setContactPhone, placeholder: "e.g. 03001234567", maxLength: 20, inputMode: "tel", label: "Contact phone" })}
          <FieldLabel>WhatsApp Number</FieldLabel>
          {field({ value: whatsappNumber, onChange: setWhatsappNumber, placeholder: "e.g. 03001234567", maxLength: 20, inputMode: "tel", label: "WhatsApp number" })}
          <FieldLabel hint="A number from 0 to 5, e.g. 4.5. Shown to customers on this venue's page.">Rating (optional)</FieldLabel>
          {field({ value: rating, onChange: (v) => setRating(v.replace(/[^\d.]/g, "")), placeholder: "e.g. 4.5", maxLength: 3, inputMode: "decimal", label: "Rating" })}
          <FieldLabel>Rules &amp; Policies</FieldLabel>
          <TextArea value={rules} onChange={setRules} placeholder="e.g. Cancellations must be made 2 hours in advance. Proper sports shoes required." maxLength={1000} rows={4} label="Rules and policies" />
          <SwitchRow title="Open for bookings" subtitle="Turn off to temporarily hide this venue from customers." value={isactive} onChange={setIsactive} />
        </form>
      </PageBody>
    </>
  );
}

// Photo manager shared by ManageVenueImages and ManageCourtImages: add
// (multi-select upload), reorder, download, delete.
function PhotosPage({ kind }: { kind: "venue" | "court" }) {
  const { venueId = "", courtId = "" } = useParams();
  const p = useAdminPaths();
  const { data: venue, isLoading } = useAdminVenueDetail(venueId);
  const addVenueImage = useAddVenueImage(venueId);
  const deleteVenueImage = useDeleteVenueImage(venueId);
  const reorderVenueImage = useReorderVenueImage(venueId);
  const addCourtImage = useAddCourtImage(venueId);
  const deleteCourtImage = useDeleteCourtImage(venueId);
  const reorderCourtImage = useReorderCourtImage(venueId);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const court = venue?.court.find((c) => c.id === courtId);
  const raw = kind === "venue" ? (venue?.venue_images ?? []) : (court?.court_images ?? []);
  const images = [...raw].sort((a, b) => a.display_order - b.display_order);
  const deleteImage = kind === "venue" ? deleteVenueImage : deleteCourtImage;
  const reorderImage = kind === "venue" ? reorderVenueImage : reorderCourtImage;

  const handleAdd = async () => {
    const assets = await pickImages({ allowsMultipleSelection: true });
    if (assets.length === 0) return;
    setUploading(true);
    try {
      let nextOrder = images.length;
      for (const asset of assets) {
        if (kind === "venue") {
          const { publicUrl } = await uploadImage(asset, { bucket: "venue-images", pathPrefix: venueId });
          await addVenueImage.mutateAsync({ imageUrl: publicUrl, displayOrder: nextOrder });
        } else {
          const { publicUrl } = await uploadImage(asset, { bucket: "court-images", pathPrefix: courtId });
          await addCourtImage.mutateAsync({ courtId, imageUrl: publicUrl, displayOrder: nextOrder });
        }
        nextOrder += 1;
      }
    } catch (err) {
      Alert.alert("Upload failed", getFriendlyErrorMessage(err, "Could not upload photo."));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (imageId: string) =>
    Alert.alert("Delete Photo", `Remove this photo from the ${kind}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteImage.mutate(imageId, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete photo.")) }) },
    ]);

  const handleDownload = async (imageId: string, url: string) => {
    setDownloadingId(imageId);
    try {
      await downloadAndShareImage(url);
    } catch (err) {
      Alert.alert("Download failed", getFriendlyErrorMessage(err, "Could not download photo."));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = images[index + direction];
    const current = images[index];
    if (!target) return;
    reorderImage.mutate({ imageId: current.id, displayOrder: target.display_order });
    reorderImage.mutate({ imageId: target.id, displayOrder: current.display_order });
  };

  const title = kind === "venue" ? "Venue Photos" : `${court?.name ?? "Court"} · Photos`;
  return (
    <>
      <AdminPageHeader title={title} backTo={kind === "venue" ? p.venue(venueId) : p.courts(venueId)} right={<GradientAction onPress={handleAdd} pending={uploading} icon="add" label="Add" small />} />
      <PageBody>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonBlock key={i} height={120} radius={12} />
            ))}
          </div>
        ) : images.length === 0 ? (
          <EmptyBox icon="images-outline" text={kind === "venue" ? "No photos yet. Add some to help players find your venue." : "No photos yet. Add some to show players exactly what this court looks like."} />
        ) : (
          <PhotoGrid images={images} onMove={handleMove} onDownload={handleDownload} onDelete={handleDelete} downloadingId={downloadingId} />
        )}
      </PageBody>
    </>
  );
}

export const VenuePhotosPage = () => <PhotosPage kind="venue" />;
export const CourtPhotosPage = () => <PhotosPage kind="court" />;

// Port of ManageCourtsScreen.
export function ManageCourtsPage() {
  const { venueId = "" } = useParams();
  const p = useAdminPaths();
  const navigate = useAppNavigate();
  const { data: venue, isLoading } = useAdminVenueDetail(venueId);
  const deleteCourt = useDeleteCourt(venueId);
  const courts = venue?.court ?? [];

  const handleDeactivate = (courtId: string, name: string) =>
    Alert.alert("Deactivate Court", `Deactivate "${name}"? It'll be hidden from bookings and slot management.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: () => deleteCourt.mutate(courtId, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not deactivate court.")) }) },
    ]);

  return (
    <>
      <AdminPageHeader title="Courts" backTo={p.venue(venueId)} right={<GradientAction onPress={() => navigate(p.newCourt(venueId))} icon="add" label="Add" small />} />
      <PageBody>
        {isLoading ? (
          <SkeletonCardRows />
        ) : courts.length === 0 ? (
          <EmptyBox icon="grid-outline" text="No courts yet. Add one so players can book a time slot." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {courts.map((court) => (
              <div
                key={court.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(p.court(venueId, court.id))}
                onKeyDown={(e) => e.key === "Enter" && navigate(p.court(venueId, court.id))}
                className="flex cursor-pointer items-center rounded-2xl border border-border bg-surface p-4 transition hover:shadow-card"
              >
                <SportIconBadge sportName={court.sports?.name} size={36} />
                <div className="mx-3 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-ink">{court.name}</span>
                    {!court.isactive && <span className="rounded-full bg-app px-2 py-0.5 text-xs font-medium text-muted">Inactive</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {court.sports?.name ?? "Sport not set"} · Rs {court.price_per_hour.toLocaleString()}/hr
                  </p>
                </div>
                <span className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <button type="button" title="Court photos" aria-label={`${court.name} photos`} onClick={() => navigate(p.courtPhotos(venueId, court.id))}>
                    <Ionicon name="images-outline" size={18} color={colors.primary} />
                  </button>
                  <button type="button" title="Manage slots" aria-label={`${court.name} slots`} onClick={() => navigate(p.courtSlots(venueId, court.id))}>
                    <Ionicon name="calendar-outline" size={18} color={colors.primary} />
                  </button>
                  <button type="button" title="Deactivate court" aria-label={`Deactivate ${court.name}`} onClick={() => handleDeactivate(court.id, court.name)}>
                    <Ionicon name="trash-outline" size={18} color={colors.danger} />
                  </button>
                </span>
                <Ionicon name="chevron-forward" size={16} color={colors.muted} style={{ marginLeft: 6 }} />
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

const SURFACE_TYPE_OPTIONS = ["Artificial Turf", "Natural Grass", "Cement Turf", "Hybrid Turf", "Clay"];
const TIME_RE = /^\d{1,2}:\d{2}$/;
const normalizeTime = (t: string) => {
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m}`;
};
function formatTime12h(timeStr: string): string {
  const h = parseInt(timeStr.split(":")[0], 10);
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

function PriceRulesSection({ courtId }: { courtId: string }) {
  const { data: rules, isLoading } = useCourtPriceRules(courtId);
  const addRule = useAddCourtPriceRule(courtId);
  const deleteRule = useDeleteCourtPriceRule(courtId);
  const [ruleStart, setRuleStart] = useState("");
  const [ruleEnd, setRuleEnd] = useState("");
  const [rulePrice, setRulePrice] = useState("");

  const handleAddRule = () => {
    if (!TIME_RE.test(ruleStart) || !TIME_RE.test(ruleEnd)) return Alert.alert("Invalid Time", "Start and end time must be in HH:MM format, e.g. 6:00 or 06:00.");
    const start = normalizeTime(ruleStart);
    const end = normalizeTime(ruleEnd);
    if (start >= end) return Alert.alert("Invalid Range", "Start time must be before end time.");
    const price = parseFloat(rulePrice);
    if (!price || price <= 0) return Alert.alert("Missing Info", "Please enter a valid price per hour for this window.");
    if ((rules ?? []).some((r) => start < r.end_time.slice(0, 5) && end > r.start_time.slice(0, 5))) return Alert.alert("Overlapping Window", "This time window overlaps with a rate you've already set.");
    addRule.mutate(
      { startTime: start, endTime: end, pricePerHour: price },
      {
        onSuccess: () => (setRuleStart(""), setRuleEnd(""), setRulePrice("")),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not add this rate.")),
      }
    );
  };

  const handleRemoveRule = (rule: CourtPriceRule) =>
    Alert.alert("Remove Rate", `Remove the Rs ${rule.price_per_hour.toLocaleString()}/hr rate for ${formatTime12h(rule.start_time)} – ${formatTime12h(rule.end_time)}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteRule.mutate(rule.id, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove this rate.")) }) },
    ]);

  return (
    <div className="mt-2">
      <FieldLabel>Time-based Pricing (optional)</FieldLabel>
      <p className="mb-3 text-xs text-muted">Override the price above for specific time windows, e.g. 6:00 AM – 4:00 PM at Rs 100, 4:00 PM – 10:00 PM at Rs 200. Any hour without a window below uses the default price.</p>
      {isLoading ? (
        <div className="mb-3 flex justify-center">
          <Spinner />
        </div>
      ) : (
        (rules ?? []).map((rule) => (
          <div key={rule.id} className="mb-2 flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <span className="text-sm font-medium text-ink">
              {formatTime12h(rule.start_time)} – {formatTime12h(rule.end_time)}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-sm font-semibold text-primary">Rs {rule.price_per_hour.toLocaleString()}</span>
              <button type="button" aria-label="Remove rate" onClick={() => handleRemoveRule(rule)}>
                <Ionicon name="trash-outline" size={18} color={colors.danger} />
              </button>
            </span>
          </div>
        ))
      )}
      <div className="grid grid-cols-3 gap-2">
        <FieldInput value={ruleStart} onChange={(e) => setRuleStart(e.target.value)} placeholder="06:00" maxLength={5} aria-label="Rate start time" containerClassName="!bg-surface" />
        <FieldInput value={ruleEnd} onChange={(e) => setRuleEnd(e.target.value)} placeholder="16:00" maxLength={5} aria-label="Rate end time" containerClassName="!bg-surface" />
        <FieldInput value={rulePrice} onChange={(e) => setRulePrice(e.target.value)} placeholder="Rs" inputMode="numeric" aria-label="Rate price per hour" containerClassName="!bg-surface" />
      </div>
      <button type="button" onClick={handleAddRule} disabled={addRule.isPending} className="mt-2 flex w-full items-center justify-center rounded-xl border border-primary py-3 text-sm font-semibold text-primary hover:bg-primary-light">
        {addRule.isPending ? <Spinner size={18} /> : "Add Rate Window"}
      </button>
    </div>
  );
}

function SportTile({ name, selected, onPress, size = 72 }: { name: string; selected?: boolean; onPress?: () => void; size?: number }) {
  const photo = imageUrl(getSportImage(name));
  const { icon, bg, fg } = getSportIcon(name);
  const ring = selected ? { outline: `3px solid ${colors.primary}`, outlineOffset: -3 } : undefined;
  return photo ? <img src={photo} alt="" className="rounded-2xl object-cover" style={{ width: size, height: size, ...ring }} onClick={onPress} /> : (
    <span className="flex items-center justify-center rounded-2xl" style={{ width: size, height: size, backgroundColor: bg, ...ring }} onClick={onPress}>
      <MCIcon name={icon} size={size * 0.45} color={fg} />
    </span>
  );
}

// Port of EditCourtScreen (add when there's no courtId).
export function EditCourtPage() {
  const { venueId = "", courtId } = useParams();
  const p = useAdminPaths();
  const goBack = useGoBack(p.courts(venueId));
  const { data: venue, isLoading } = useAdminVenueDetail(venueId);
  const { data: sports } = useSports();
  const addCourt = useAddCourt(venueId);
  const updateCourt = useUpdateCourt(venueId);
  const isEditing = !!courtId;
  const existing = courtId ? venue?.court.find((c) => c.id === courtId) : undefined;
  const [name, setName] = useState("");
  const [sportsId, setSportsId] = useState<string | null>(null);
  const [pricePerHour, setPricePerHour] = useState("");
  const [capacity, setCapacity] = useState("");
  const [surfaceType, setSurfaceType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [isactive, setIsactive] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && (existing || !isEditing)) {
      if (existing) {
        setName(existing.name);
        setSportsId(existing.sports_id);
        setPricePerHour(String(existing.price_per_hour));
        setCapacity(existing.capacity != null ? String(existing.capacity) : "");
        setSurfaceType(existing.surface_type ?? "");
        setDescription(existing.description ?? "");
        setLocation(existing.location ?? "");
        setAmenities(existing.amenities ?? []);
        setIsactive(existing.isactive);
      }
      setInitialized(true);
    }
  }, [existing, isEditing, initialized]);

  const handleSave = () => {
    if (!isValidName(name)) return Alert.alert("Invalid Name", `Court name must be ${NAME_REQUIREMENT_HINT}.`);
    if (!sportsId) return Alert.alert("Missing Info", "Please select a sport.");
    const price = parseFloat(pricePerHour);
    if (!price || price <= 0) return Alert.alert("Missing Info", "Please enter a valid price per hour.");
    const input = {
      name: name.trim(),
      sportsId,
      pricePerHour: price,
      capacity: capacity ? parseInt(capacity, 10) : null,
      surfaceType: surfaceType.trim(),
      description: description.trim(),
      location: location.trim(),
      amenities,
      isactive,
    };
    (isEditing ? updateCourt.mutateAsync({ courtId: courtId as string, input }) : addCourt.mutateAsync(input)).then(goBack).catch((err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not save court.")));
  };

  if (isLoading || (isEditing && !initialized)) return <Loading />;
  const currentSport = (sports ?? []).find((s) => s.id === sportsId);

  return (
    <>
      <AdminPageHeader title={isEditing ? "Edit Court" : "Add Court"} backTo={p.courts(venueId)} right={<GradientAction onPress={handleSave} pending={addCourt.isPending || updateCourt.isPending} label="Save" />} />
      <PageBody narrow>
        <FieldLabel>Court Name</FieldLabel>
        {field({ value: name, onChange: setName, placeholder: "e.g. Court 1", maxLength: 60, label: "Court name" })}
        <FieldLabel>Sport</FieldLabel>
        {isEditing ? (
          <div className="mb-4 flex items-center gap-3">
            <SportTile name={currentSport?.name ?? ""} size={48} />
            <div>
              <p className="text-sm font-semibold text-ink">{currentSport?.name ?? "—"}</p>
              <p className="mt-0.5 text-xs text-muted">Sport can't be changed after a court is created.</p>
            </div>
          </div>
        ) : (
          <div className="no-scrollbar mb-4 flex gap-5 overflow-x-auto px-0.5 pb-1 sm:flex-wrap">
            {(sports ?? []).map((s) => {
              const selected = sportsId === s.id;
              return (
                <button key={s.id} type="button" aria-pressed={selected} onClick={() => setSportsId(s.id)} className="flex w-[76px] shrink-0 flex-col items-center">
                  <SportTile name={s.name} selected={selected} />
                  <span className={`mt-2 w-full truncate text-center text-xs ${selected ? "font-bold text-primary" : "font-medium text-ink"}`}>{s.name}</span>
                </button>
              );
            })}
          </div>
        )}
        <FieldLabel>Price per Hour (Rs)</FieldLabel>
        {field({ value: pricePerHour, onChange: setPricePerHour, placeholder: "e.g. 2000", inputMode: "numeric", label: "Price per hour" })}
        <FieldLabel>Capacity (optional)</FieldLabel>
        {field({ value: capacity, onChange: setCapacity, placeholder: "Max players", inputMode: "numeric", label: "Capacity" })}
        <FieldLabel>Surface Type (optional)</FieldLabel>
        <select
          value={surfaceType}
          onChange={(e) => setSurfaceType(e.target.value)}
          aria-label="Surface type"
          className={`mb-4 w-full rounded-2xl border-[1.5px] border-border bg-surface px-4 py-3 outline-none focus:border-primary ${surfaceType ? "text-ink" : "text-muted"}`}
        >
          <option value="">Select surface type</option>
          {SURFACE_TYPE_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {surfaceType && !SURFACE_TYPE_OPTIONS.includes(surfaceType) && <option value={surfaceType}>{surfaceType}</option>}
        </select>
        <FieldLabel>Amenities (optional)</FieldLabel>
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          {AMENITY_OPTIONS.map(({ label, icon }) => {
            const selected = amenities.includes(label);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                onClick={() => setAmenities((prev) => (prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]))}
                className={`flex items-center gap-2 rounded-xl border-[1.5px] px-3 py-2.5 text-left text-sm ${selected ? "border-primary bg-primary-light font-bold text-primary" : "border-border bg-surface font-medium text-ink"}`}
              >
                <MCIcon name={icon} size={20} color={selected ? colors.primary : colors.muted} />
                <span className="flex-1 truncate">{label}</span>
                {selected && <Ionicon name="checkmark-circle" size={16} color={colors.primary} />}
              </button>
            );
          })}
        </div>
        <FieldLabel>Description (optional)</FieldLabel>
        <TextArea value={description} onChange={setDescription} placeholder="Describe this court..." maxLength={500} label="Court description" />
        <SwitchRow title="Active" subtitle="Turn off to hide this court from bookings." value={isactive} onChange={setIsactive} />
        {isEditing && courtId && (
          <>
            <div className="my-5 h-px bg-border" />
            <PriceRulesSection courtId={courtId} />
          </>
        )}
      </PageBody>
    </>
  );
}

// Port of AdminSlotsScreen: next 14 days; tap a free slot to block it, a
// blocked one to unblock, a booked one to see who booked.
export function AdminSlotsPage() {
  const { venueId = "", courtId = "" } = useParams();
  const p = useAdminPaths();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: venue } = useAdminVenueDetail(venueId);
  const days = getNext14Days();
  const todayStr = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const { data: bookings = [], isLoading } = useCourtBookingsForDate(courtId, selectedDate);
  const { data: priceRules = [] } = useCourtPriceRules(courtId);
  const blockSlot = useBlockSlot(courtId, selectedDate);
  const unblockSlot = useUnblockSlot(courtId, selectedDate);
  const court = venue?.court.find((c) => c.id === courtId);
  const disabled = blockSlot.isPending || unblockSlot.isPending;

  const findBooking = (slot: Slot) => {
    const s = slotBoundaryDateTime(selectedDate, slot.start, false).getTime();
    const e = slotBoundaryDateTime(selectedDate, slot.end, true).getTime();
    return bookings.find((b) => s < new Date(b.end_time).getTime() && e > new Date(b.start_time).getTime());
  };

  const handleSlotPress = (slot: Slot) => {
    const booking = findBooking(slot);
    if (!booking) {
      return Alert.alert("Block This Slot", `Block ${slot.label} so customers can't book it?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          onPress: () => userId && blockSlot.mutate({ adminUserId: userId, startTime: slot.start, endTime: slot.end }, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not block slot.")) }),
        },
      ]);
    }
    if (booking.status === "BLOCKED") {
      return Alert.alert("Unblock This Slot", `Make ${slot.label} available for booking again?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Unblock", onPress: () => unblockSlot.mutate(booking.id, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not unblock slot.")) }) },
      ]);
    }
    Alert.alert("Booked", `${slot.label} is booked by ${booking.profiles?.full_name ?? "a customer"}.`);
  };

  return (
    <>
      <AdminPageHeader title={`${court?.name ?? "Court"} · Slots`} backTo={p.courts(venueId)} />
      <div className="border-b border-border">
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-3 py-3 lg:px-8">
          {days.map((day) => {
            const isToday = day === todayStr;
            const isSelected = day === selectedDate;
            const d = new Date(day + "T12:00:00");
            const label = isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
            return (
              <button
                key={day}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedDate(day)}
                className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${isSelected ? "bg-brand text-white" : "border border-border bg-surface"}`}
              >
                <span className={`text-xs font-medium ${isSelected ? "text-white" : isToday ? "text-primary" : "text-muted"}`}>{label}</span>
                <span className={`mt-0.5 text-lg font-bold ${isSelected ? "text-white" : "text-ink"}`}>{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mx-auto flex max-w-5xl items-center gap-4 border-b border-border px-4 py-2.5 text-xs text-muted lg:px-8">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-border bg-surface" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-100" />
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-100" />
          Blocked
        </span>
      </div>
      <PageBody>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <SkeletonBlock key={i} height={58} radius={12} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {generateFullDaySlots()
              .filter((slot) => !isSlotPast(slot, selectedDate))
              .map((slot) => {
                const booking = findBooking(slot);
                const isBlocked = booking?.status === "BLOCKED";
                const isBooked = !!booking && !isBlocked;
                const price = court ? resolveSlotPrice(slot, court.price_per_hour, priceRules) : null;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSlotPress(slot)}
                    className={`flex flex-col items-center justify-center rounded-xl border px-3 py-3 transition hover:shadow-card ${isBooked ? "border-blue-100 bg-blue-50" : isBlocked ? "border-red-100 bg-red-50" : "border-border bg-surface"}`}
                  >
                    <span className="text-center text-sm font-medium text-ink">{slot.label}</span>
                    {isBooked && <span className="mt-0.5 text-xs text-blue-600">Booked</span>}
                    {isBlocked && <span className="mt-0.5 text-xs text-red-500">Blocked · Tap to unblock</span>}
                    {!isBooked && !isBlocked && price !== null && <span className="mt-0.5 text-xs text-muted">Rs {price.toLocaleString()}</span>}
                  </button>
                );
              })}
          </div>
        )}
      </PageBody>
    </>
  );
}
