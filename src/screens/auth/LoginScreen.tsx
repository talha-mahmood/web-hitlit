import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { signInWithGoogle } from "../../lib/googleAuth";
import { colors } from "../../constants/theme";

export default function LoginScreen() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const session = await signInWithGoogle();
      if (!session) {
        // User cancelled the browser sheet - nothing to do.
        return;
      }
      // RootNavigator's onAuthStateChange listener takes it from here.
    } catch (err) {
      Alert.alert(
        "Sign-in failed",
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <View className="flex-1 bg-white items-center justify-between px-6 py-16">
      <View className="flex-1 items-center justify-center">
        <Text className="text-4xl font-extrabold text-primary">PlayPals</Text>
        <Text className="text-muted text-center mt-3 text-base">
          Find players, book courts, and get in the game.
        </Text>
      </View>

      <Pressable
        onPress={handleGoogleSignIn}
        disabled={isSigningIn}
        className="w-full flex-row items-center justify-center gap-3 border border-border rounded-xl py-4 bg-white active:bg-primary-light"
      >
        {isSigningIn ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <AntDesign name="google" size={20} color={colors.ink} />
            <Text className="text-ink font-semibold text-base">
              Continue with Google
            </Text>
          </>
        )}
      </Pressable>

      <Text className="text-muted text-xs text-center mt-4">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}
