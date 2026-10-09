import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { useProfileStore } from "../../store/profileStore";
import { useAuthStore } from "../../store/authStore";
import { colors, cardShadow } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "../../lib/countryCodes";
import PhoneNumberField from "../../components/PhoneNumberField";
import FieldInput from "../../components/FieldInput";
import type { ProfileStackParamList } from "../../navigation/ProfileStackNavigator";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { signOutWithPushCleanup } from "../../lib/pushNotifications";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "AccountSettings">;

const PAKISTAN_DIAL = "+92";

function maxDigitsFor(dial: string): number {
  return dial === PAKISTAN_DIAL ? 10 : 14;
}

function isPhoneDigitsValid(dial: string, digits: string): boolean {
  return dial === PAKISTAN_DIAL ? digits.length === 10 : digits.length >= 9 && digits.length <= 14;
}

// A stored phone is just "<dial><digits>" with no separator — recover the
// two parts by matching against the known dial codes, longest prefix first
// so e.g. "+971..." isn't mistaken for a shorter code that happens to be a
// prefix of it.
function splitPhone(phone: string | null): { dial: string; number: string } {
  if (!phone) return { dial: DEFAULT_COUNTRY_CODE.dial, number: "" };
  const match = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length).find((c) => phone.startsWith(c.dial));
  if (!match) return { dial: DEFAULT_COUNTRY_CODE.dial, number: phone.replace(/[^0-9]/g, "") };
  return { dial: match.dial, number: phone.slice(match.dial.length) };
}

function SectionCard({
  icon,
  iconBg = colors.primaryLight,
  iconFg = colors.primaryDark,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconFg?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
      <View className="flex-row items-start mb-4" style={{ gap: 12 }}>
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 44, height: 44, backgroundColor: iconBg }}
        >
          <Ionicons name={icon} size={20} color={iconFg} />
        </View>
        <View className="flex-1">
          <Text className="text-ink font-bold text-base">{title}</Text>
          <Text className="text-muted text-sm mt-0.5">{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

export default function AccountSettingsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const userId = useAuthStore((s) => s.session?.user.id);

  const initialPhone = splitPhone(profile?.phone ?? null);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [phoneDial, setPhoneDial] = useState(initialPhone.dial);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.number);
  const [savingPhone, setSavingPhone] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const visibility = profile?.visibility ?? "public";

  const nameChanged = name.trim() !== (profile?.full_name ?? "").trim();
  const nameValid = isValidName(name);

  const phoneChanged = `${phoneDial}${phoneNumber}` !== (profile?.phone ?? "");
  const phoneValid = isPhoneDigitsValid(phoneDial, phoneNumber);

  const handleChangeDial = (dial: string) => {
    setPhoneDial(dial);
    setPhoneNumber((prev) => prev.slice(0, maxDigitsFor(dial)));
  };

  const handleSaveName = async () => {
    if (!userId || !nameValid) return;
    setSavingName(true);
    try {
      await updateProfile(userId, { full_name: name.trim() });
      Alert.alert("Saved", "Your display name has been updated.");
    } catch (err) {
      Alert.alert("Could not save", getFriendlyErrorMessage(err, "Something went wrong."));
    } finally {
      setSavingName(false);
    }
  };

  const handleSavePhone = async () => {
    if (!userId || !phoneValid) return;
    setSavingPhone(true);
    try {
      await updateProfile(userId, { phone: `${phoneDial}${phoneNumber}` });
      Alert.alert("Saved", "Your phone number has been updated.");
    } catch (err) {
      Alert.alert("Could not save", getFriendlyErrorMessage(err, "Something went wrong."));
    } finally {
      setSavingPhone(false);
    }
  };

  const handleChangeVisibility = async (next: "public" | "private") => {
    if (!userId || next === visibility) return;
    setSavingVisibility(true);
    try {
      await updateProfile(userId, { visibility: next });
    } catch (err) {
      Alert.alert("Could not save", getFriendlyErrorMessage(err, "Something went wrong."));
    } finally {
      setSavingVisibility(false);
    }
  };

  // Permanently deletes the account and everything tied to it (games hosted,
  // squads created, bookings, messages, etc. all cascade in the database) —
  // required by App Store guideline 5.1.1(v) for any app that offers account
  // creation. RootNavigator's onAuthStateChange listener takes over once the
  // session is invalidated by the deleted auth.users row.
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw error;
      await signOutGoogle();
      await signOutWithPushCleanup();
    } catch (err) {
      Alert.alert(
        "Couldn't delete account",
        getFriendlyErrorMessage(err, "Something went wrong. Please try again.")
      );
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
      setDeleteConfirmText("");
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View
        style={{ paddingTop: insets.top + 16, paddingHorizontal: 14, paddingBottom: 22 }}
      >
        <View className="flex-row items-center">
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-ink">Account Settings</Text>
            <Text className="text-muted text-sm mt-0.5">Manage your account details</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View className="bg-white rounded-2xl p-4 mb-4 flex-row items-center" style={{ ...cardShadow, gap: 12 }}>
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: colors.primaryLight }}
          >
            <Ionicons name="mail-outline" size={20} color={colors.primaryDark} />
          </View>
          <View className="flex-1">
            <Text className="text-muted text-xs">Email</Text>
            <Text className="text-ink font-bold text-sm mt-0.5" numberOfLines={1}>
              {profile?.email ?? "—"}
            </Text>
          </View>
        </View>

        {/* My Bookings / Blocked Users — moved here from the Profile screen. */}
        <Pressable
          onPress={() => navigation.navigate("MyBookings")}
          className="bg-white rounded-2xl flex-row items-center p-4 mb-4"
          style={{ ...cardShadow, gap: 12 }}
        >
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 44, height: 44, backgroundColor: colors.primaryLight }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.primaryDark} />
            </View>
            <View className="flex-1">
              <Text className="text-ink font-bold text-base">My Bookings</Text>
              <Text className="text-muted text-sm mt-0.5">View your court bookings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("BlockedUsers")}
          className="bg-white rounded-2xl flex-row items-center p-4 mb-4"
          style={{ ...cardShadow, gap: 12 }}
        >
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 44, height: 44, backgroundColor: colors.primaryLight }}
            >
              <Ionicons name="hand-left-outline" size={20} color={colors.primaryDark} />
            </View>
            <View className="flex-1">
              <Text className="text-ink font-bold text-base">Blocked Users</Text>
              <Text className="text-muted text-sm mt-0.5">Manage who you've blocked</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <SectionCard icon="person-outline" title="Display Name" subtitle="This name will be visible to other players.">
          <FieldInput value={name} onChangeText={setName} placeholder="Your name" maxLength={60} />
          {!nameValid && name.length > 0 && (
            <Text className="text-red-500 text-xs mt-2">Name must be {NAME_REQUIREMENT_HINT}.</Text>
          )}
          <Pressable onPress={handleSaveName} disabled={!nameChanged || !nameValid || savingName}>
            {nameChanged && nameValid ? (
              <GradientFill className="relative rounded-2xl py-3.5 flex-row items-center justify-center mt-3">
                {savingName ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">Save Name</Text>
                )}
              </GradientFill>
            ) : (
              <View className="relative rounded-2xl py-3.5 flex-row items-center justify-center mt-3 bg-gray-200">
                <Text className="font-bold text-muted">Save Name</Text>
              </View>
            )}
          </Pressable>
        </SectionCard>

        <SectionCard
          icon="call-outline"
          title="Phone Number"
          subtitle="Change your phone number"
        >
          <PhoneNumberField
            dial={phoneDial}
            onChangeDial={handleChangeDial}
            number={phoneNumber}
            onChangeNumber={setPhoneNumber}
            maxDigits={maxDigitsFor(phoneDial)}
          />
          <Pressable onPress={handleSavePhone} disabled={!phoneChanged || !phoneValid || savingPhone}>
            {phoneChanged && phoneValid ? (
              <GradientFill className="relative rounded-2xl py-3.5 flex-row items-center justify-center mt-3">
                {savingPhone ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">Save Phone Number</Text>
                )}
              </GradientFill>
            ) : (
              <View className="relative rounded-2xl py-3.5 flex-row items-center justify-center mt-3 bg-gray-200">
                <Text className="font-bold text-muted">Save Phone Number</Text>
              </View>
            )}
          </Pressable>
        </SectionCard>

        <SectionCard
          icon="eye-outline"
          title="Profile Visibility"
          subtitle="Public players can be found and invited to teams/squads. Private players are hidden from Invite Players search."
        >
          <View className="flex-row bg-gray-100 rounded-2xl p-1" style={{ gap: 4 }}>
            {(["public", "private"] as const).map((option) => {
              const selected = visibility === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleChangeVisibility(option)}
                  disabled={savingVisibility}
                  className="flex-1"
                >
                  {selected ? (
                    <GradientFill
                      className="flex-row items-center justify-center rounded-xl py-2.5"
                      style={{ gap: 6 }}
                    >
                      {savingVisibility ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Ionicons
                            name={option === "public" ? "eye-outline" : "eye-off-outline"}
                            size={15}
                            color="white"
                          />
                          <Text className="text-sm font-bold text-white">
                            {option === "public" ? "Public" : "Private"}
                          </Text>
                        </>
                      )}
                    </GradientFill>
                  ) : (
                    <View
                      className="flex-row items-center justify-center rounded-xl py-2.5"
                      style={{ gap: 6 }}
                    >
                      <Ionicons
                        name={option === "public" ? "eye-outline" : "eye-off-outline"}
                        size={15}
                        color={colors.muted}
                      />
                      <Text className="text-sm font-bold text-muted">
                        {option === "public" ? "Public" : "Private"}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard
          icon="warning-outline"
          iconBg="#FEF2F2"
          iconFg={colors.danger}
          title="Danger Zone"
          subtitle="Permanently delete your account and everything tied to it. This can't be undone."
        >
          <Pressable
            onPress={() => setDeleteModalOpen(true)}
            className="flex-row items-center justify-center rounded-xl py-3"
            style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", gap: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text className="font-semibold" style={{ color: colors.danger }}>
              Delete Account
            </Text>
          </Pressable>
        </SectionCard>
      </ScrollView>

      <Modal
        visible={deleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmText("");
        }}
      >
        <Pressable
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => {
            setDeleteModalOpen(false);
            setDeleteConfirmText("");
          }}
        >
          <Pressable className="bg-white rounded-2xl p-5 w-full items-center" onPress={(e) => e.stopPropagation()}>
            <View
              className="items-center justify-center rounded-full mb-3"
              style={{ width: 52, height: 52, backgroundColor: "#FEF2F2" }}
            >
              <Ionicons name="warning-outline" size={26} color={colors.danger} />
            </View>
            <Text className="text-ink font-bold text-lg mb-1">Delete Account</Text>
            <Text className="text-muted text-sm mb-4 text-center">
              This permanently deletes your account and everything tied to it — games you've hosted, squads you've
              created, bookings, and messages. This can't be undone.
            </Text>
            <Text className="text-muted text-sm mb-2 self-start">Type DELETE to confirm.</Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
              className="border border-border rounded-xl px-4 py-3 mb-4 text-ink w-full"
            />
            <Pressable
              disabled={deleteConfirmText !== "DELETE" || isDeleting}
              onPress={handleDeleteAccount}
              className="rounded-xl py-3 items-center w-full"
              style={{ backgroundColor: colors.danger, opacity: deleteConfirmText === "DELETE" && !isDeleting ? 1 : 0.4 }}
            >
              {isDeleting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold">Delete My Account</Text>
              )}
            </Pressable>
            <Pressable
              disabled={isDeleting}
              onPress={() => {
                setDeleteModalOpen(false);
                setDeleteConfirmText("");
              }}
              className="items-center py-3 mt-1 w-full"
            >
              <Text className="text-muted font-medium">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
