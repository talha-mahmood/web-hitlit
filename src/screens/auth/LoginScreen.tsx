import { useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import type { Session } from "@supabase/supabase-js";
import { signInWithGoogle } from "../../lib/googleAuth";
import { signInWithApple } from "../../lib/appleAuth";
import GoogleIcon from "../../components/GoogleIcon";
import GradientFill from "../../components/GradientFill";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

export default function LoginScreen() {
  const [isSigningIn, setIsSigningIn] = useState(false);

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
            disabled={isSigningIn}
            className="w-full active:opacity-90"
            style={{ opacity: isSigningIn ? 0.7 : 1 }}
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
            <View pointerEvents={isSigningIn ? "none" : "auto"} style={{ width: "100%", opacity: isSigningIn ? 0.7 : 1 }}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={16}
                style={{ width: "100%", height: 50, marginTop: 12 }}
                onPress={() => handleSignIn(signInWithApple)}
              />
            </View>
          )}
        </View>

        <Text className="text-muted text-xs text-center mt-6 px-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}
