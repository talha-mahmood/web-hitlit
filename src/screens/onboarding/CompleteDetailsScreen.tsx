import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import type { Database } from "../../types/database.types";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { signOutWithPushCleanup } from "../../lib/pushNotifications";

type Gender = Database["public"]["Enums"]["gender_type"];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

// Shown once, right after a brand-new Google/Apple sign-in — those
// providers hand us a name/email/avatar but never a gender, so
// RootNavigator routes here until it's filled in. A returning user who
// already has one skips this screen entirely (see isProfileComplete).
export default function CompleteDetailsScreen() {
  const session = useAuthStore((s) => s.session);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [isSaving, setIsSaving] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);

  const isValid = !!gender;

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

  const handleContinue = async () => {
    const userId = session?.user.id;
    if (!userId || !isValid) return;

    setIsSaving(true);
    try {
      await updateProfile(userId, {
        gender: gender as Gender,
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
    >
      <GradientFill className="flex-1">
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
              backgroundColor: colors.surface,
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
              We use your gender to match you into gender-specific games and squads, like Male Only or Female Only squads.
            </Text>

            <View className="w-full mt-6">
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
                      className="flex-1"
                    >
                      {selected ? (
                        <GradientFill
                          className="items-center rounded-xl py-3"
                          style={{ borderWidth: 1.5, borderColor: colors.primary }}
                        >
                          <Text className="text-sm" style={{ color: "white", fontWeight: "700" }}>
                            {opt.label}
                          </Text>
                        </GradientFill>
                      ) : (
                        <View
                          className="items-center rounded-xl py-3"
                          style={{ borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface }}
                        >
                          <Text className="text-sm" style={{ color: colors.ink, fontWeight: "500" }}>
                            {opt.label}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={handleContinue}
              disabled={isSaving || !isValid}
              className="w-full active:opacity-90"
              style={{ opacity: isValid ? 1 : 0.4 }}
            >
              <GradientFill className="flex-row items-center justify-center gap-3 rounded-2xl py-3.5 mt-6">
                {isSaving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-jazba-white font-semibold text-base">Continue</Text>
                )}
              </GradientFill>
            </Pressable>
            {!isValid && (
              <Text className="text-muted text-xs text-center mt-3">
                Select your gender to continue.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
      </GradientFill>
    </KeyboardAvoidingView>
  );
}
