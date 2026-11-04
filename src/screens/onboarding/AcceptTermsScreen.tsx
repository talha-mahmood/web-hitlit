import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import TermsContent from "../../components/TermsContent";
import { signOutGoogle } from "../../lib/googleAuth";
import { signOutWithPushCleanup } from "../../lib/pushNotifications";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

// Shown once, right after sign-in, to anyone whose profile has no recorded
// terms_accepted_at — a brand-new account, or an existing account/session
// that predates this requirement. Rendered directly by RootNavigator (same
// pattern as CompleteDetailsScreen), not pushed onto a stack — there is no
// way to use the app without accepting. See profileStore's termsAccepted().
export default function AcceptTermsScreen() {
  const session = useAuthStore((s) => s.session);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [isSaving, setIsSaving] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Same reasoning as CompleteDetailsScreen.handleBack — there's no
  // previous screen to pop to, so declining means signing back out.
  const handleBack = async () => {
    setIsGoingBack(true);
    try {
      await signOutGoogle();
      await signOutWithPushCleanup();
    } catch (err) {
      Alert.alert("Couldn't go back", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
      setIsGoingBack(false);
    }
  };

  const handleAgree = async () => {
    const userId = session?.user.id;
    if (!userId || !agreed) return;

    setIsSaving(true);
    try {
      await updateProfile(userId, { terms_accepted_at: new Date().toISOString() });
      // RootNavigator re-evaluates termsAccepted() once the store's profile
      // updates and takes it from here.
    } catch (err) {
      Alert.alert("Could not save", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <GradientFill className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="w-full rounded-3xl px-6 py-8"
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
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
          >
            {isGoingBack ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <Ionicons name="arrow-back" size={20} color={colors.ink} />
            )}
          </Pressable>

          <Text className="text-xl font-extrabold text-ink text-center">Terms of Service</Text>
          <Text className="text-muted text-center mt-1.5 text-sm px-2">
            Please read and accept our terms to continue.
          </Text>

          <View className="w-full mt-6">
            <TermsContent />
          </View>

          <Pressable
            onPress={() => setAgreed((v) => !v)}
            className="flex-row items-center mt-6"
            style={{ gap: 10 }}
          >
            <View
              className="items-center justify-center"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: agreed ? colors.primary : colors.border,
                backgroundColor: agreed ? colors.primary : "white",
              }}
            >
              {agreed && <Ionicons name="checkmark" size={15} color="white" />}
            </View>
            <Text className="flex-1 text-ink text-sm">
              I have read and agree to the Terms of Service and Privacy Policy, including the
              zero-tolerance policy for objectionable content and abusive users.
            </Text>
          </Pressable>

          <Pressable
            onPress={handleAgree}
            disabled={isSaving || !agreed}
            className="w-full active:opacity-90"
            style={{ opacity: agreed ? 1 : 0.4 }}
          >
            <GradientFill className="flex-row items-center justify-center gap-3 rounded-2xl py-3.5 mt-6">
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">Agree &amp; Continue</Text>
              )}
            </GradientFill>
          </Pressable>
        </View>
      </ScrollView>
    </GradientFill>
  );
}
