import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { supabase } from "../../lib/supabase";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";

export default function ProfileSetupScreen() {
  const session = useAuthStore((s) => s.session);
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar ?? null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const userId = session?.user.id;

  const pickAndUploadPhoto = async () => {
    if (!userId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to set a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setIsUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const extension = asset.uri.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${extension}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, arrayBuffer, {
          contentType: asset.mimeType ?? "image/jpeg",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      Alert.alert(
        "Upload failed",
        err instanceof Error ? err.message : "Could not upload photo."
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!isValidName(fullName)) {
      Alert.alert("Invalid Name", `Your name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile(userId, {
        full_name: fullName.trim(),
        avatar: avatarUrl,
      });
    } catch (err) {
      Alert.alert(
        "Could not save profile",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-6 pt-16">
        <Text className="text-2xl font-bold text-ink">Complete your profile</Text>
        <Text className="text-muted mt-1 mb-8">
          What would you like your mates to call you?
        </Text>

        <View className="items-center mb-8">
          <Pressable onPress={pickAndUploadPhoto} className="relative">
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} className="w-24 h-24 rounded-full bg-primary-light" />
            ) : (
              <View className="w-24 h-24 rounded-full bg-primary-light items-center justify-center">
                <Text className="text-3xl font-bold text-primary">
                  {fullName.trim().charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}
            {isUploadingPhoto && (
              <View className="absolute inset-0 items-center justify-center bg-black/30 rounded-full">
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </Pressable>
          <Pressable onPress={pickAndUploadPhoto} disabled={isUploadingPhoto}>
            <Text className="text-primary font-semibold mt-3">
              {avatarUrl ? "Change photo" : "Upload a photo"}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center mb-2">
          <Text className="text-muted">Full name</Text>
          <Text className="text-red-500 ml-1">*</Text>
        </View>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
          className="border border-border rounded-xl px-4 py-3 text-ink text-base mb-8"
        />

        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className="bg-primary rounded-xl py-4 items-center"
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Next</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
