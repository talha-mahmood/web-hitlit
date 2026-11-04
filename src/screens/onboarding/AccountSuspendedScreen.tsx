import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import { signOutGoogle } from "../../lib/googleAuth";
import { signOutWithPushCleanup } from "../../lib/pushNotifications";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

// Rendered directly by RootNavigator (same "no stack entry" pattern as
// CompleteDetailsScreen/AcceptTermsScreen) whenever profile.isactive is
// false — the "eject the offending user" half of App Store guideline 1.2's
// 24-hour moderation requirement. A superadmin flips isactive off from the
// Moderation screen; RootNavigator already subscribes to profile changes in
// realtime, so an already-open session is suspended live. The only action
// available here is signing out — there is no way back into the app.
export default function AccountSuspendedScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOutGoogle();
      await signOutWithPushCleanup();
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
      setIsSigningOut(false);
    }
  };

  return (
    <GradientFill className="flex-1 items-center justify-center" style={{ paddingHorizontal: 24 }}>
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
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 64, height: 64, backgroundColor: "#FEE2E2", marginBottom: 16 }}
        >
          <Ionicons name="ban-outline" size={30} color={colors.danger} />
        </View>
        <Text className="text-xl font-extrabold text-ink text-center">Account Suspended</Text>
        <Text className="text-muted text-center mt-2 text-sm px-2">
          Your account has been suspended for violating our community guidelines. If you believe
          this is a mistake, contact support.
        </Text>

        <Pressable onPress={handleSignOut} disabled={isSigningOut} className="w-full active:opacity-90">
          <View
            className="flex-row items-center justify-center rounded-2xl py-3.5 mt-6"
            style={{ backgroundColor: colors.danger }}
          >
            {isSigningOut ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Sign Out</Text>
            )}
          </View>
        </Pressable>
      </View>
    </GradientFill>
  );
}
