import { useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, Alert, Platform, Modal, ScrollView } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import type { Session } from "@supabase/supabase-js";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInWithGoogle } from "../../lib/googleAuth";
import { signInWithApple } from "../../lib/appleAuth";
import GoogleIcon from "../../components/GoogleIcon";
import GradientFill from "../../components/GradientFill";
import TermsContent from "../../components/TermsContent";
import { colors, heroShadow } from "../../constants/theme";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [isSigningIn, setIsSigningIn] = useState(false);
  // Required under App Store guideline 1.2 — terms (including the
  // zero-tolerance UGC policy) must be presented and agreed to before a
  // user can register/log in, not just after. The post-sign-in
  // AcceptTermsScreen is the durable, DB-backed record of this; this
  // checkbox is the literal "before logging in" gate.
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const handleSignIn = async (signIn: () => Promise<Session | null>) => {
    setIsSigningIn(true);
    try {
      await signIn();
      // On success, RootNavigator's session listener takes it from here —
      // a brand-new account lands on CompleteDetailsScreen (no phone/gender
      // yet), a returning account goes straight into the app.
    } catch (err) {
      Alert.alert(
        "Sign-in failed",
        getFriendlyErrorMessage(err, "Something went wrong. Please try again.")
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#FFFFFF" }}>
      <View className="flex-1 items-center justify-center px-6">
        <View
          className="w-full items-center rounded-3xl px-6 py-8"
          style={{
            backgroundColor: "white",
            // A denser border + a deeper, tighter shadow than the app's usual
            // cardShadow — gives the sign-in card a raised, 3D look against
            // the now-white page instead of just floating on green.
            borderWidth: 1.5,
            borderColor: "rgba(15, 23, 42, 0.12)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: 0.28,
            shadowRadius: 22,
            elevation: 14,
          }}
        >
          <Image
            source={require("../../../assets/icon.png")}
            style={{ width: 68, height: 68, borderRadius: 34 }}
          />
          <Text className="text-xl font-extrabold text-ink mt-4 text-center">
            Welcome to HitLit
          </Text>
          <Text className="text-muted text-center mt-1.5 text-sm px-2">
            Find players, book courts, and get in the game.
          </Text>

          <Pressable
            onPress={() => handleSignIn(signInWithGoogle)}
            disabled={isSigningIn || !agreed}
            className="w-full active:opacity-90"
            style={{ opacity: isSigningIn || !agreed ? 0.5 : 1 }}
          >
            <GradientFill className="flex-row items-center justify-center gap-3 rounded-2xl py-3.5 mt-8">
              {isSigningIn ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <View className="bg-white rounded-full items-center justify-center" style={{ width: 26, height: 26 }}>
                    <GoogleIcon size={16} />
                  </View>
                  <Text className="text-white font-semibold text-base">Sign In with Google</Text>
                </>
              )}
            </GradientFill>
          </Pressable>

          {Platform.OS === "ios" && (
            <View
              pointerEvents={isSigningIn || !agreed ? "none" : "auto"}
              style={{ width: "100%", opacity: isSigningIn || !agreed ? 0.5 : 1 }}
            >
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={16}
                style={{ width: "100%", height: 50, marginTop: 12 }}
                onPress={() => handleSignIn(signInWithApple)}
              />
            </View>
          )}

          <Pressable
            onPress={() => setAgreed((v) => !v)}
            className="flex-row items-start w-full mt-6"
            style={{ gap: 10 }}
          >
            <View
              className="items-center justify-center"
              style={{
                width: 20,
                height: 20,
                marginTop: 1,
                borderRadius: 5,
                borderWidth: 1.5,
                borderColor: agreed ? colors.primary : colors.border,
                backgroundColor: agreed ? colors.primary : "white",
              }}
            >
              {agreed && <Ionicons name="checkmark" size={13} color="white" />}
            </View>
            <Text className="flex-1 text-muted text-xs">
              I have read and agree to the{" "}
              <Text
                style={{ color: colors.primary, fontWeight: "700" }}
                onPress={() => setTermsOpen(true)}
              >
                Terms of Service and Privacy Policy
              </Text>
              .
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={termsOpen} animationType="slide" transparent onRequestClose={() => setTermsOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View
            className="bg-white rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: 24 + insets.bottom, maxHeight: "80%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-ink">Terms of Service</Text>
              <Pressable onPress={() => setTermsOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              <TermsContent />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
