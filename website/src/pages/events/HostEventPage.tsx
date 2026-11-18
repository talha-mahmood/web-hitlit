import { useState } from "react";
import { colors } from "@app/constants/theme";
import { useCreateEvent } from "@app/hooks/useEvents";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import type { Database } from "@app/types/database.types";
import { isValidName, NAME_REQUIREMENT_HINT } from "@app/lib/nameValidation";
import { pickImages, uploadImage } from "@app/lib/upload";
import { supabase } from "@app/lib/supabase";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { reverseGeocodeViaNominatim } from "@app/lib/locationPicker";
import { DAYS, TIME_SLOTS, TOURNAMENT_DURATIONS_DAYS, addMinutesWithOverflow, addDays, isTimeSlotPast } from "@app/lib/gameFormHelpers";
import { saveGeneratedVisualAsset } from "@app/services/assets/assetGenerator";
import { Alert } from "@/lib/alert";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import FieldInput from "@/components/ui/FieldInput";
import LocationMapPicker from "@/components/maps/LocationMapPicker";
import GeneratedEntityVisual from "@/components/GeneratedEntityVisual";
import { FormCard, Chip, ChipRow, ChipStrip } from "@/components/forms/FormCards";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

type Gender = Database["public"]["Enums"]["game_gender_type"];
type IconAsset = Awaited<ReturnType<typeof pickImages>>[number];
const HOURS_PER_DAY_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

// Port of HostEventScreen: icon (custom or generated), name, free-text event
// type, date / duration / daily start time / hours (same end-date logic as a
// tournament), Open To, map-pin location (+ editable address), description.
export default function HostEventPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.events());
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const createEvent = useCreateEvent();

  // Never offer a gender restriction that would exclude the host.
  const genderOptions: { label: string; value: Gender }[] =
    myGender === "male"
      ? [
          { label: "Everyone", value: "mixed" },
          { label: "Male Only", value: "male" },
        ]
      : myGender === "female"
        ? [
            { label: "Everyone", value: "mixed" },
            { label: "Female Only", value: "female" },
          ]
        : [{ label: "Everyone", value: "mixed" }];

  const [name, setName] = useState("");
  const [iconAsset, setIconAsset] = useState<IconAsset | null>(null);
  const [eventType, setEventType] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState<Gender>("mixed");
  const [selectedDate, setSelectedDate] = useState(DAYS[0].iso);
  const [durationDays, setDurationDays] = useState<number>(1);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [hoursPerDay, setHoursPerDay] = useState<number>(1);
  const [confirmingLocation, setConfirmingLocation] = useState(false);
  const [addressFieldVisible, setAddressFieldVisible] = useState(false);

  const confirmMapLocation = async (lat: number, lng: number) => {
    setConfirmingLocation(true);
    try {
      setLocation(await reverseGeocodeViaNominatim(lat, lng));
      setAddressFieldVisible(true);
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not look up an address for this location."));
    } finally {
      setConfirmingLocation(false);
    }
  };

  const handleCreate = async () => {
    if (!userId || createEvent.isPending) return;
    if (!isValidName(name)) return Alert.alert("Invalid Name", `Event name must be ${NAME_REQUIREMENT_HINT}.`);
    if (!eventType.trim()) return Alert.alert("Missing Info", "Please enter the event type.");
    if (!location.trim()) return Alert.alert("Missing Info", "Please enter a location.");
    if (!startTime) return Alert.alert("Missing Info", "Please select a start time.");
    if (selectedDate === DAYS[0].iso && isTimeSlotPast(selectedDate, startTime)) return Alert.alert("Invalid Start Time", "That time has already passed. Please pick a later start time.");

    // Single-day: start + hours decide the end; multi-day: last day ends 23:59:59.
    const singleDayEnd = durationDays === 1 ? addMinutesWithOverflow(startTime, hoursPerDay * 60) : null;
    const endDateValue = durationDays === 1 ? (singleDayEnd!.daysOverflow > 0 ? addDays(selectedDate, singleDayEnd!.daysOverflow) : null) : addDays(selectedDate, durationDays - 1);
    const endTimeValue = durationDays === 1 ? `${singleDayEnd!.time}:00` : "23:59:59";

    try {
      const event = await createEvent.mutateAsync({
        ownerId: userId,
        name: name.trim(),
        eventType: eventType.trim(),
        location: location.trim(),
        description: description.trim(),
        gender,
        eventDate: selectedDate,
        startTime: `${startTime}:00`,
        endDate: endDateValue,
        endTime: endTimeValue,
        dailyHours: hoursPerDay,
      });
      // The icon bucket's RLS needs the event row to exist first.
      if (iconAsset) {
        const { publicUrl } = await uploadImage(iconAsset, { bucket: "event-icons", pathPrefix: event.id });
        await supabase.from("events").update({ icon_url: publicUrl }).eq("id", event.id);
      } else {
        try {
          const iconUrl = await saveGeneratedVisualAsset({ id: event.id, name: name.trim(), sport: eventType.trim(), kind: "event" }, { bucket: "event-icons", folder: event.id });
          const { error: iconUpdateError } = await supabase.from("events").update({ icon_url: iconUrl }).eq("id", event.id);
          if (iconUpdateError) throw iconUpdateError;
        } catch (iconError) {
          console.warn("Could not save generated event icon", iconError);
        }
      }
      navigate(paths.event(event.id), { replace: true });
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not create event. Please try again."));
    }
  };

  const availableDays = DAYS.filter((d) => TIME_SLOTS.some((t) => !isTimeSlotPast(d.iso, t.value)));
  const availableTimes = TIME_SLOTS.filter((t) => !(selectedDate === DAYS[0].iso && isTimeSlotPast(selectedDate, t.value)));
  const sub = (label: string) => <p className="mb-2 mt-4 text-[13px] font-semibold text-ink">{label}</p>;

  return (
    <div className="mx-auto max-w-3xl lg:px-8">
      <div className="sticky top-0 z-30 border-b border-border bg-app/95 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur lg:pt-6">
        <div className="flex items-center px-4 pb-3 lg:px-0">
          <button type="button" onClick={goBack} aria-label="Back" className="mr-3 rounded-full p-1 transition hover:bg-gray-100 active:scale-90">
            <Ionicon name="arrow-back" size={22} color={colors.ink} />
          </button>
          <div className="flex-1">
            <h1 className="text-[19px] font-extrabold text-ink">Host Event</h1>
            <p className="mt-px text-[13px] text-muted">Organize a sports event</p>
          </div>
          <button type="button" onClick={handleCreate} disabled={createEvent.isPending} className="press flex min-w-[66px] items-center justify-center rounded-[14px] bg-brand px-[22px] py-[9px] text-[14.5px] font-bold text-white shadow-cta">
            {createEvent.isPending ? <Spinner size={16} color="white" /> : "Post"}
          </button>
        </div>
      </div>

      <form className="flex flex-col gap-3 px-4 pb-16 pt-1.5 lg:px-0 lg:pt-4" onSubmit={(e) => (e.preventDefault(), handleCreate())}>
        <div className="flex items-center overflow-hidden rounded-2xl bg-brand px-3.5 py-[11px] shadow-card">
          <div className="flex-1 pr-2">
            <p className="text-lg font-extrabold text-white">Host an Event</p>
            <p className="mt-[3px] text-xs leading-4 text-white/80">Create an event and bring people together!</p>
          </div>
          <span className="flex h-12 w-14 items-center justify-center">
            <MCIcon name="calendar-star" size={44} color="#8FD9AE" />
          </span>
        </div>

        <FormCard icon="pricetag" title="Event Icon" optional subtitle="Add a custom icon to make your event stand out">
          <button
            type="button"
            onClick={async () => {
              const assets = await pickImages({});
              if (assets[0]) setIconAsset(assets[0]);
            }}
            className="flex items-center gap-3 text-left"
          >
            <span className="relative">
              <span className="flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-[13px] border-[1.5px] border-dashed border-[#8FD9AE] bg-primary-light">
                {iconAsset ? <img src={iconAsset.uri} alt="" className="h-[52px] w-[52px] object-cover" /> : <GeneratedEntityVisual id="event-preview" name={name || "Sports Event"} sport={eventType || "Event"} kind="event" size={52} />}
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-brand">
                <Ionicon name="add" size={11} color="white" />
              </span>
            </span>
            <span className="rounded-2xl bg-primary-light px-4 py-2.5 text-[13px] font-bold text-primary-dark hover:brightness-95">{iconAsset ? "Change icon" : "Upload custom icon"}</span>
          </button>
        </FormCard>

        <FormCard icon="calendar" title="Event Name" required>
          <div className="flex items-center gap-2.5">
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-surface-overlay">
              <Ionicon name="calendar" size={20} color="#4B5563" />
            </span>
            <div className="min-w-0 flex-1">
              <FieldInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday Sports Fest" maxLength={80} aria-label="Event name" />
            </div>
          </div>
        </FormCard>

        <FormCard icon="albums" title="Event Type" required hint="What kind of event is this?">
          <FieldInput value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="e.g. Cricket Tournament, Fitness Camp" maxLength={60} aria-label="Event type" />
        </FormCard>

        <FormCard icon="calendar-outline" title="Date & Time" required>
          <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
            <Ionicon name="calendar-outline" size={17} color={colors.primary} />
            Date <span className="text-danger">*</span>
          </p>
          <ChipStrip>
            {availableDays.map((d) => {
              const selected = selectedDate === d.iso;
              return (
                <button
                  key={d.iso}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedDate(d.iso);
                    if (startTime && d.iso === DAYS[0].iso && isTimeSlotPast(d.iso, startTime)) setStartTime(null);
                  }}
                  className={`flex shrink-0 flex-col items-center rounded-2xl border-[1.5px] px-3 py-2.5 ${selected ? "border-primary bg-primary-light" : "border-border bg-surface hover:border-primary/40"}`}
                >
                  <span className={`text-xs ${selected ? "text-primary-dark" : "text-muted"}`}>{d.day}</span>
                  <span className={`mt-0.5 text-base font-bold ${selected ? "text-primary-dark" : "text-ink"}`}>{d.label}</span>
                </button>
              );
            })}
          </ChipStrip>
          {sub("Duration")}
          <ChipStrip>
            {TOURNAMENT_DURATIONS_DAYS.map((d) => (
              <Chip key={d} label={`${d} day${d > 1 ? "s" : ""}`} selected={durationDays === d} onPress={() => setDurationDays(d)} />
            ))}
          </ChipStrip>
          {sub("Start Time (Each Day)")}
          <ChipStrip>
            {availableTimes.map((t) => (
              <Chip key={t.value} label={t.label} selected={startTime === t.value} onPress={() => setStartTime(t.value)} />
            ))}
          </ChipStrip>
          {sub("Hours (Each Day)")}
          <ChipStrip>
            {HOURS_PER_DAY_OPTIONS.map((h) => (
              <Chip key={h} label={h === 1 ? "1 hr" : `${h} hrs`} selected={hoursPerDay === h} onPress={() => setHoursPerDay(h)} />
            ))}
          </ChipStrip>
        </FormCard>

        <FormCard icon="people" title="Open To">
          <ChipRow<Gender> options={genderOptions} value={gender} onChange={setGender} />
        </FormCard>

        <FormCard icon="location" title="Location" required>
          <LocationMapPicker onConfirm={confirmMapLocation} confirming={confirmingLocation} selectedLabel={location} />
          {addressFieldVisible && (
            <div className="mt-3">
              <p className="mb-1.5 text-sm font-semibold text-ink">
                Address <span className="font-normal text-muted">(optional — edit if this isn't exact)</span>
              </p>
              <textarea
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter the exact address"
                rows={2}
                aria-label="Address"
                className="w-full resize-none rounded-2xl border-[1.5px] border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-primary focus:bg-primary-light"
              />
            </div>
          )}
        </FormCard>

        <FormCard icon="document-text" title="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes about your event (schedule, vibe, etc.)"
            maxLength={300}
            rows={3}
            aria-label="Description"
            className="h-[76px] w-full resize-none rounded-2xl border-[1.5px] border-border bg-surface px-4 py-2.5 text-ink outline-none placeholder:text-muted focus:border-primary focus:bg-primary-light"
          />
        </FormCard>
      </form>
    </div>
  );
}
