import { useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, Alert } from "react-native";
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
        // User dismissed the native account picker — nothing to do.
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
    <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.primary }}>
      <View
        className="w-full items-center rounded-3xl px-6 py-10"
        style={{
          backgroundColor: "white",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <Image
          source={require("../../../assets/icon.png")}
          style={{ width: 84, height: 84, borderRadius: 42 }}
        />
        <Text className="text-2xl font-extrabold text-ink mt-5 text-center">
          Welcome to PlayOye
        </Text>
        <Text className="text-muted text-center mt-2 text-sm px-2">
          Find players, book courts, and get in the game.
        </Text>

        <Pressable
          onPress={handleGoogleSignIn}
          disabled={isSigningIn}
          className="w-full flex-row items-center justify-center gap-3 rounded-2xl py-4 mt-8 active:opacity-90"
          style={{ backgroundColor: colors.primary }}
        >
          {isSigningIn ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <AntDesign name="google" size={20} color="white" />
              <Text className="text-white font-semibold text-base">Continue with Google</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text className="text-white text-xs text-center mt-6 px-4" style={{ opacity: 0.85 }}>
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}
