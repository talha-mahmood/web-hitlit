import { useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
//
// This is the one and only place terms acceptance is actually recorded —
// LoginScreen only links to the terms for reading, it doesn't gate sign-in
// on them, since the app has no way to know (pre-auth) whether the person
// signing in has already accepted before. This screen is the only point
// that actually knows that, via the signed-in profile.
export default function AcceptTermsScreen() {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [isSaving, setIsSaving] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // The checkbox stays hidden until the terms have actually been scrolled
  // through to the end — once unlocked it stays unlocked.
  const [canAgree, setCanAgree] = useState(false);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);

  const unlockAgreeIfAtEnd = () => {
    if (canAgree) return;
    if (contentHeightRef.current > 0 && contentHeightRef.current <= viewportHeightRef.current + 4) {
      // Content is short enough to need no scrolling at all.
      setCanAgree(true);
    }
  };

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
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        <View
          className="flex-1 rounded-3xl px-6 py-6"
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

          <ScrollView
            style={{ flex: 1, marginTop: 16 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            onLayout={(e) => {
              viewportHeightRef.current = e.nativeEvent.layout.height;
              unlockAgreeIfAtEnd();
            }}
            onContentSizeChange={(_w, h) => {
              contentHeightRef.current = h;
              unlockAgreeIfAtEnd();
            }}
            onScroll={(e) => {
              if (canAgree) return;
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
                setCanAgree(true);
              }
            }}
            scrollEventThrottle={32}
          >
            <TermsContent />
          </ScrollView>

          {canAgree ? (
            <Pressable
              onPress={() => setAgreed((v) => !v)}
              className="flex-row items-center w-full mt-4"
              style={{
                gap: 12,
                padding: 14,
                borderRadius: 16,
                backgroundColor: agreed ? colors.primaryLight : "#F9FAFB",
                borderWidth: 1.5,
                borderColor: agreed ? colors.primary : colors.border,
              }}
            >
              <View
                className="items-center justify-center"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  borderWidth: 1.5,
                  borderColor: agreed ? colors.primary : colors.border,
                  backgroundColor: agreed ? colors.primary : "white",
                }}
              >
                {agreed && <Ionicons name="checkmark" size={15} color="white" />}
              </View>
              <Text className="flex-1 text-ink" style={{ fontSize: 13.5, lineHeight: 19 }}>
                I've read and agree to the <Text style={{ fontWeight: "700" }}>Terms of Service</Text> and{" "}
                <Text style={{ fontWeight: "700" }}>Privacy Policy</Text> above, including the zero-tolerance
                policy for objectionable content and abusive users.
              </Text>
            </Pressable>
          ) : (
            <View className="flex-row items-center justify-center mt-4" style={{ gap: 6 }}>
              <Ionicons name="arrow-down-circle-outline" size={15} color={colors.muted} />
              <Text className="text-muted text-xs">Scroll to the end to continue</Text>
            </View>
          )}

          <Pressable
            onPress={handleAgree}
            disabled={isSaving || !agreed}
            className="w-full active:opacity-90"
            style={{ opacity: agreed ? 1 : 0.4 }}
          >
            <GradientFill className="flex-row items-center justify-center gap-3 rounded-2xl py-3.5 mt-4">
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">Agree &amp; Continue</Text>
              )}
            </GradientFill>
          </Pressable>
        </View>
      </View>
    </GradientFill>
  );
}
