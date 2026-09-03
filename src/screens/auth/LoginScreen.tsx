import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Keyboard, Platform } from "react-native";
import { signInWithGoogle } from "../../lib/googleAuth";
import { useProfileStore } from "../../store/profileStore";
import { colors } from "../../constants/theme";
import { DEFAULT_COUNTRY_CODE } from "../../lib/countryCodes";
import PhoneNumberField from "../../components/PhoneNumberField";
import FieldInput from "../../components/FieldInput";
import GoogleIcon from "../../components/GoogleIcon";
import type { Database } from "../../types/database.types";

type Gender = Database["public"]["Enums"]["gender_type"];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
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

export default function LoginScreen() {
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const scrollRef = useRef<ScrollView>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [phoneDial, setPhoneDial] = useState(DEFAULT_COUNTRY_CODE.dial);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState("");

  const isValid = isPhoneDigitsValid(phoneDial, phoneNumber) && !!gender;

  // Changing the country mid-entry can tighten the allowed length (e.g.
  // switching to Pakistan's fixed 10 digits) — trim any digits that no
  // longer fit instead of leaving an invalid, uneditable-looking number.
  const handleChangeDial = (dial: string) => {
    setPhoneDial(dial);
    setPhoneNumber((prev) => prev.slice(0, maxDigitsFor(dial)));
  };

  // Same fix as the description field on the create-game/create-squad
  // screens: a focused field near the bottom of the form can end up hidden
  // behind the keyboard, along with the submit button below it. Scrolling
  // on focus fires too early (the keyboard hasn't finished animating in yet
  // on Android, so its height isn't accounted for): listening for
  // keyboardDidShow instead scrolls only once the keyboard's final size is
  // known, so the button reliably ends up above it.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  const handleGoogleSignIn = async () => {
    if (!isValid) return;
    setIsSigningIn(true);
    try {
      const session = await signInWithGoogle();
      if (!session) {
        // User dismissed the native account picker — nothing to do.
        return;
      }

      let dateOfBirth: string | null = null;
      if (age.trim()) {
        const ageNum = parseInt(age, 10);
        if (ageNum > 0 && ageNum < 120) {
          dateOfBirth = `${new Date().getFullYear() - ageNum}-01-01`;
        }
      }

      // The auth.users -> profiles row is created by a DB trigger that runs
      // synchronously as part of the sign-in, so the row is guaranteed to
      // exist by the time signInWithGoogle() resolves.
      await updateProfile(session.user.id, {
        phone: `${phoneDial}${phoneNumber}`,
        gender: gender as Gender,
        date_of_birth: dateOfBirth,
      });
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
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ backgroundColor: colors.primary }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
      >
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

          <View className="w-full mt-8">
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

          <View className="w-full mt-5">
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

          <View className="w-full mt-5">
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
            onPress={handleGoogleSignIn}
            disabled={isSigningIn || !isValid}
            className="w-full flex-row items-center justify-center gap-3 rounded-2xl py-4 mt-8 active:opacity-90"
            style={{ backgroundColor: colors.primary, opacity: isValid ? 1 : 0.4 }}
          >
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
          </Pressable>
          {!isValid && (
            <Text className="text-muted text-xs text-center mt-3">
              Enter your phone number and gender to continue.
            </Text>
          )}
        </View>

        <Text className="text-white text-xs text-center mt-6 px-4" style={{ opacity: 0.85 }}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
