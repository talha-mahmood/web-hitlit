import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors } from "../../constants/theme";
import { DEFAULT_COUNTRY_CODE } from "../../lib/countryCodes";
import PhoneNumberField from "../../components/PhoneNumberField";
import FieldInput from "../../components/FieldInput";
import type { Database } from "../../types/database.types";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { signOutWithPushCleanup } from "../../lib/pushNotifications";

type Gender = Database["public"]["Enums"]["gender_type"];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

// Pakistan's mobile numbers are always exactly 10 digits after +92; every
// other country code uses the looser 9-14 digit range.
const PAKISTAN_DIAL = "+92";

function maxDigitsFor(dial: string): number {
  return dial === PAKISTAN_DIAL ? 10 : 14;
}

function isPhoneDigitsValid(dial: string, digits: string): boolean {
  return dial === PAKISTAN_DIAL ? digits.length === 10 : digits.length >= 9 && digits.length <= 14;
}

// Shown once, right after a brand-new Google/Apple sign-in — those
// providers hand us a name/email/avatar but never a phone number or gender,
// so RootNavigator routes here until both are filled in. A returning user
// who already has them skips this screen entirely (see isProfileComplete).
export default function CompleteDetailsScreen() {
  const session = useAuthStore((s) => s.session);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [isSaving, setIsSaving] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [phoneDial, setPhoneDial] = useState(DEFAULT_COUNTRY_CODE.dial);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState("");

  const isValid = isPhoneDigitsValid(phoneDial, phoneNumber) && !!gender;

  // There's no previous screen to pop to — this is rendered directly by
  // RootNavigator, not pushed onto a stack — so "back" means abandoning
  // this sign-in and returning to the Login screen, which means signing
  // back out of the session that got us here.
  const handleBack = async () => {
    setIsGoingBack(true);
    try {
      await signOutGoogle();
      await signOutWithPushCleanup();
    } catch (err) {
      Alert.alert(
        "Couldn't go back",
        getFriendlyErrorMessage(err, "Something went wrong. Please try again.")
      );
      setIsGoingBack(false);
    }
  };

  // Changing the country mid-entry can tighten the allowed length (e.g.
  // switching to Pakistan's fixed 10 digits) — trim any digits that no
  // longer fit instead of leaving an invalid, uneditable-looking number.
  const handleChangeDial = (dial: string) => {
    setPhoneDial(dial);
    setPhoneNumber((prev) => prev.slice(0, maxDigitsFor(dial)));
  };

  const handleContinue = async () => {
    const userId = session?.user.id;
    if (!userId || !isValid) return;

    let dateOfBirth: string | null = null;
    if (age.trim()) {
      const ageNum = parseInt(age, 10);
      if (ageNum > 0 && ageNum < 120) {
        dateOfBirth = `${new Date().getFullYear() - ageNum}-01-01`;
      }
    }

    setIsSaving(true);
    try {
      await updateProfile(userId, {
        phone: `${phoneDial}${phoneNumber}`,
        gender: gender as Gender,
        date_of_birth: dateOfBirth,
      });
      // RootNavigator re-evaluates isProfileComplete() once the store's
      // profile updates and takes it from here.
    } catch (err) {
      Alert.alert(
        "Could not save",
        getFriendlyErrorMessage(err, "Something went wrong. Please try again.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ backgroundColor: colors.primary }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <View
            className="w-full items-center rounded-3xl px-6 py-8"
            style={{
              backgroundColor: "white",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <Pressable
              onPress={handleBack}
              disabled={isGoingBack}
              hitSlop={8}
              className="self-start -mt-2 -ml-2 mb-1"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isGoingBack ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <Ionicons name="arrow-back" size={20} color={colors.ink} />
              )}
            </Pressable>

            <Text className="text-xl font-extrabold text-ink text-center">
              Just one more step
            </Text>
            <Text className="text-muted text-center mt-1.5 text-sm px-2">
              Add your phone number and gender to finish setting up your account.
            </Text>

            <View className="w-full mt-6">
              <View className="flex-row items-center mb-2">
                <Text className="text-muted text-sm">Phone number</Text>
                <Text className="text-red-500 ml-1">*</Text>
              </View>
              <PhoneNumberField
                dial={phoneDial}
                onChangeDial={handleChangeDial}
                number={phoneNumber}
                onChangeNumber={setPhoneNumber}
                maxDigits={maxDigitsFor(phoneDial)}
              />
            </View>

            <View className="w-full mt-4">
              <View className="flex-row items-center mb-2">
                <Text className="text-muted text-sm">Gender</Text>
                <Text className="text-red-500 ml-1">*</Text>
              </View>
              <View className="flex-row" style={{ gap: 10 }}>
                {GENDER_OPTIONS.map((opt) => {
                  const selected = gender === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setGender(opt.value)}
                      className="flex-1 items-center rounded-xl py-3"
                      style={{
                        borderWidth: 1.5,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : "white",
                      }}
                    >
                      <Text
                        className="text-sm"
                        style={{ color: selected ? "white" : colors.ink, fontWeight: selected ? "700" : "500" }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="w-full mt-4">
              <Text className="text-muted text-sm mb-2">Age (optional)</Text>
              <FieldInput
                value={age}
                onChangeText={(t) => setAge(t.replace(/[^0-9]/g, "").slice(0, 2))}
                placeholder="e.g. 25"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>

            <Pressable
              onPress={handleContinue}
              disabled={isSaving || !isValid}
              className="w-full flex-row items-center justify-center gap-3 rounded-2xl py-3.5 mt-6 active:opacity-90"
              style={{ backgroundColor: colors.primary, opacity: isValid ? 1 : 0.4 }}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">Continue</Text>
              )}
            </Pressable>
            {!isValid && (
              <Text className="text-muted text-xs text-center mt-3">
                Enter your phone number and gender to continue.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
