import { useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useSports } from "@app/hooks/useSports";
import { useCreateSquad } from "@app/hooks/useSquads";
import type { SquadGroupType } from "@app/lib/api/squads";
import type { AddTeamReturnTo } from "@app/navigation/addTeamTypes";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import type { Database } from "@app/types/database.types";
import { isValidName, NAME_REQUIREMENT_HINT } from "@app/lib/nameValidation";
import { pickImages, uploadImage } from "@app/lib/upload";
import { supabase } from "@app/lib/supabase";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { reverseGeocodeViaNominatim } from "@app/lib/locationPicker";
import { saveGeneratedVisualAsset } from "@app/services/assets/assetGenerator";
import { Alert } from "@/lib/alert";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import FieldInput from "@/components/ui/FieldInput";
import LocationMapPicker from "@/components/maps/LocationMapPicker";
import GeneratedEntityVisual from "@/components/GeneratedEntityVisual";
import { HomeSportTile } from "@/components/home/HomeCards";
import { FormCard, ChipRow } from "@/components/forms/FormCards";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

type SkillLevel = Database["public"]["Enums"]["skill_level_type"];
type Gender = Database["public"]["Enums"]["game_gender_type"];
type IconAsset = Awaited<ReturnType<typeof pickImages>>[number];

const GROUP_TYPE_LABELS: Record<SquadGroupType, string> = { group: "Group", club: "Club", training_camp: "Training Camp", team: "Team" };
// Shown under the Squad Type picker so the pick isn't blind.
const GROUP_TYPE_DESCRIPTIONS: Partial<Record<SquadGroupType, string>> = {
  team: "Unlocks captain/host roles, match-linked stats (Overview, Players, Matches, Tournaments), and eligibility to send or receive Challenge a Team requests.",
  club: "A simple roster for regulars — join requests, group chat, and member management, without match stats, roles, or challenge features.",
};
const GROUP_TYPES = new Set<SquadGroupType>(["group", "club", "training_camp", "team"]);

const SKILLS: { label: string; value: SkillLevel }[] = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Expert", value: "expert" },
];

// Port of CreateSquadScreen. Query params mirror the app's route params:
// ?type=team|club|training_camp, &lockType=1, &sport=<id>, &lockSport=1.
// A tournament "Add Team" round trip carries `returnTo` in history state and
// lands back on Add Team with the new squad. Team is the default type;
// a training-camp-locked create drops the type and sport fields and reads
// "Training Camp" throughout. Creating opens the new squad right away; the
// icon (custom, or a generated badge) finishes in the background.
export default function CreateSquadPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.squads);
  const [params] = useSearchParams();
  const returnTo = (useLocation().state as { returnTo?: AddTeamReturnTo } | null)?.returnTo;
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const createSquad = useCreateSquad();
  const { data: sports } = useSports();

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

  const presetType = params.get("type") as SquadGroupType | null;
  const lockType = params.get("lockType") === "1";
  const lockSport = params.get("lockSport") === "1";
  const [name, setName] = useState("");
  const [iconAsset, setIconAsset] = useState<IconAsset | null>(null);
  const [groupType, setGroupType] = useState<SquadGroupType>(presetType && GROUP_TYPES.has(presetType) ? presetType : "team");
  const isTrainingCampLocked = lockType && groupType === "training_camp";
  const noun = isTrainingCampLocked ? "Training Camp" : "Squad";
  const [sportId, setSportId] = useState<string | null>(params.get("sport"));
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState<Gender>("mixed");
  const [confirmingLocation, setConfirmingLocation] = useState(false);
  const [addressFieldVisible, setAddressFieldVisible] = useState(false);
  const selectedSportName = sports?.find((s) => s.id === sportId)?.name ?? null;

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
    if (!userId || createSquad.isPending) return;
    if (!isValidName(name)) return Alert.alert("Invalid Name", `${noun} name must be ${NAME_REQUIREMENT_HINT}.`);
    if (!isTrainingCampLocked && !sportId) return Alert.alert("Missing Info", "Please select a sport.");
    if (!skillLevel) return Alert.alert("Missing Info", "Please select a skill level.");
    if (!location.trim()) return Alert.alert("Missing Info", "Please enter a location.");
    let navigatedAway = false;
    try {
      const squad = await createSquad.mutateAsync({
        ownerId: userId,
        name: name.trim(),
        sportId: sportId as string,
        skillLevel,
        location: location.trim(),
        description: description.trim(),
        gender,
        groupType,
      });
      if (returnTo) navigate(paths.addTeam(returnTo.gameId), { replace: true, state: { addTeam: { ...returnTo, squadId: squad.id } } });
      else navigate(paths.squad(squad.id), { replace: true });
      navigatedAway = true;
      // The icon bucket's RLS needs the squad row to exist first.
      if (iconAsset) {
        const { publicUrl } = await uploadImage(iconAsset, { bucket: "squad-icons", pathPrefix: squad.id });
        await supabase.from("squads").update({ icon_url: publicUrl }).eq("id", squad.id);
      } else {
        try {
          const publicUrl = await saveGeneratedVisualAsset(
            { id: squad.id, name: squad.name, sport: selectedSportName, kind: groupType === "team" ? "team" : "squad" },
            { bucket: "squad-icons", folder: squad.id }
          );
          const { error: iconUpdateError } = await supabase.from("squads").update({ icon_url: publicUrl }).eq("id", squad.id);
          if (iconUpdateError) throw iconUpdateError;
        } catch {
          // The deterministic local badge still renders; generation never blocks creation.
        }
      }
    } catch (err) {
      Alert.alert(
        "Error",
        navigatedAway
          ? getFriendlyErrorMessage(err, `The ${noun.toLowerCase()} was created, but uploading its icon failed. You can set it from its page.`)
          : getFriendlyErrorMessage(err, `Could not create ${noun.toLowerCase()}. Please try again.`)
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl lg:px-8">
      <div className="sticky top-0 z-30 border-b border-border bg-app/95 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur lg:pt-6">
        <div className="flex items-center px-4 pb-3 lg:px-0">
          <button type="button" onClick={goBack} aria-label="Back" className="mr-3 rounded-full p-1 transition hover:bg-gray-100 active:scale-90">
            <Ionicon name="arrow-back" size={22} color={colors.ink} />
          </button>
          <div className="flex-1">
            <h1 className="text-[19px] font-extrabold text-ink">Create {noun}</h1>
            <p className="mt-px text-[13px] text-muted">{isTrainingCampLocked ? "Set up your training camp" : "Build a team, find players"}</p>
          </div>
          <button type="button" onClick={handleCreate} disabled={createSquad.isPending} className="press flex min-w-[66px] items-center justify-center rounded-[14px] bg-brand px-[22px] py-[9px] text-[14.5px] font-bold text-white shadow-cta">
            {createSquad.isPending ? <Spinner size={16} color="white" /> : "Create"}
          </button>
        </div>
      </div>

      <form className="flex flex-col gap-3 px-4 pb-16 pt-1.5 lg:px-0 lg:pt-4" onSubmit={(e) => (e.preventDefault(), handleCreate())}>
        <div className="flex items-center overflow-hidden rounded-2xl bg-brand px-3.5 py-[11px] shadow-card">
          <div className="flex-1 pr-2">
            <p className="text-lg font-extrabold text-white">Play Together</p>
            <p className="mt-[3px] text-xs leading-4 text-white/80">Create a {noun.toLowerCase()} and bring people together!</p>
          </div>
          <div className="relative flex h-12 w-14 items-center justify-center">
            <MCIcon name="account-group" size={46} color="#8FD9AE" />
            {[
              { left: 2, top: 2, rotate: -40 },
              { left: 24, top: -4, rotate: 0 },
              { left: 46, top: 2, rotate: 40 },
            ].map((p, i) => (
              <span key={i} className="absolute h-[2px] w-[8px] rounded-sm bg-[#8FD9AE]" style={{ left: p.left, top: p.top, transform: `rotate(${p.rotate}deg)` }} />
            ))}
          </div>
          <div className="w-16" style={{ transform: "rotate(-9deg)" }}>
            <p className="whitespace-pre-line text-[11px] font-bold italic leading-[14px] text-white">{"More\nPlayers\nMore Fun!"}</p>
            <span className="mt-px block h-[2px] w-12 rounded-sm bg-[#8FD9AE]" />
          </div>
        </div>

        <FormCard icon="pricetag" title={`${noun} Icon`} optional subtitle={`Add a custom icon to make your ${noun.toLowerCase()} stand out`}>
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
                {iconAsset ? (
                  <img src={iconAsset.uri} alt="" className="h-[52px] w-[52px] object-cover" />
                ) : (
                  <GeneratedEntityVisual
                    id={name.trim() || `${groupType}-${selectedSportName ?? "sport"}`}
                    name={name.trim() || `Your ${noun}`}
                    sport={selectedSportName}
                    kind={groupType === "team" ? "team" : "squad"}
                    size={52}
                  />
                )}
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-brand">
                <Ionicon name="add" size={11} color="white" />
              </span>
            </span>
            <span className="rounded-2xl bg-primary-light px-4 py-2.5 text-[13px] font-bold text-primary-dark hover:brightness-95">{iconAsset ? "Change icon" : "Upload custom icon"}</span>
          </button>
        </FormCard>

        <FormCard icon="people" title={`${noun} Name`} required>
          <div className="flex items-center gap-2.5">
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-surface-overlay">
              <Ionicon name="people" size={20} color="#4B5563" />
            </span>
            <div className="min-w-0 flex-1">
              <FieldInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Warriors" maxLength={80} aria-label={`${noun} name`} />
            </div>
          </div>
        </FormCard>

        {!isTrainingCampLocked && (
          <FormCard icon="albums" title="Squad Type" hint={lockType ? undefined : "What kind of squad is this?"}>
            {lockType ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full border-[1.5px] border-primary bg-primary-light px-[11px] py-[6.5px] text-xs font-bold text-primary-dark">{GROUP_TYPE_LABELS[groupType]}</span>
                <span className="text-xs text-muted">Locked</span>
              </div>
            ) : (
              <ChipRow<SquadGroupType>
                options={[
                  { label: "Team", value: "team" },
                  { label: "Club", value: "club" },
                ]}
                value={groupType}
                onChange={setGroupType}
              />
            )}
            {GROUP_TYPE_DESCRIPTIONS[groupType] && <p className="mt-2.5 text-[11.5px] leading-[15px] text-muted">{GROUP_TYPE_DESCRIPTIONS[groupType]}</p>}
          </FormCard>
        )}

        {!isTrainingCampLocked && (
          <FormCard icon="trophy" title="Sport" required hint="Select your sport">
            {lockSport ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-raised px-4 py-3">
                <Ionicon name="football" size={20} color={colors.primary} />
                <span className="font-semibold text-ink">{selectedSportName ?? "Football"}</span>
                <span className="ml-auto text-xs text-muted">Fixed for this challenge</span>
              </div>
            ) : (
              <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:flex-wrap">
                {(sports ?? []).map((s) => (
                  <HomeSportTile key={s.id} name={s.name} selected={sportId === s.id} onPress={() => setSportId(s.id)} />
                ))}
              </div>
            )}
          </FormCard>
        )}

        <FormCard icon="stats-chart" title="Skill Level" required hint={`Choose your ${noun.toLowerCase()}'s level`}>
          <ChipRow options={SKILLS} value={skillLevel} onChange={setSkillLevel} />
        </FormCard>

        <FormCard icon="people" title="Open To">
          <ChipRow options={genderOptions} value={gender} onChange={setGender} />
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
            placeholder={`Notes about your ${noun.toLowerCase()} (how often you play, vibe, etc.)`}
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
