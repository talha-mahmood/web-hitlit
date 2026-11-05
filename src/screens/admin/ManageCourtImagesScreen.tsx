import { useState } from "react";
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  useAdminVenueDetail,
  useAddCourtImage,
  useDeleteCourtImage,
  useReorderCourtImage,
} from "../../hooks/useVenuesAdmin";
import { pickImages, uploadImage } from "../../lib/upload";
import { downloadAndShareImage } from "../../lib/shareImage";
import { colors } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import GradientFill from "../../components/GradientFill";

type Route = RouteProp<VenueEditingParamList, "ManageCourtImages">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "ManageCourtImages">;

export default function ManageCourtImagesScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading } = useAdminVenueDetail(params.venueId);
  const addImage = useAddCourtImage(params.venueId);
  const deleteImage = useDeleteCourtImage(params.venueId);
  const reorderImage = useReorderCourtImage(params.venueId);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const court = venue?.court.find((c) => c.id === params.courtId);
  const images = [...(court?.court_images ?? [])].sort((a, b) => a.display_order - b.display_order);

  const handleAddPhotos = async () => {
    const assets = await pickImages({ allowsMultipleSelection: true });
    if (assets.length === 0) return;

    setUploading(true);
    try {
      let nextOrder = images.length;
      for (const asset of assets) {
        const { publicUrl } = await uploadImage(asset, { bucket: "court-images", pathPrefix: params.courtId });
        await addImage.mutateAsync({ courtId: params.courtId, imageUrl: publicUrl, displayOrder: nextOrder });
        nextOrder += 1;
      }
    } catch (err) {
      Alert.alert("Upload failed", getFriendlyErrorMessage(err, "Could not upload photo."));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (imageId: string) => {
    Alert.alert("Delete Photo", "Remove this photo from the court?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteImage.mutate(imageId, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete photo.")),
          }),
      },
    ]);
  };

  const handleDownload = async (imageId: string, imageUrl: string) => {
    setDownloadingId(imageId);
    try {
      await downloadAndShareImage(imageUrl);
    } catch (err) {
      Alert.alert("Download failed", getFriendlyErrorMessage(err, "Could not download photo."));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = images[index + direction];
    const current = images[index];
    if (!target) return;
    reorderImage.mutate({ imageId: current.id, displayOrder: target.display_order });
    reorderImage.mutate({ imageId: target.id, displayOrder: current.display_order });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
          {params.courtName} · Photos
        </Text>
        <Pressable onPress={handleAddPhotos} disabled={uploading}>
          <GradientFill className="flex-row items-center rounded-lg px-3 py-1.5" style={{ gap: 4 }}>
            {uploading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="add" size={14} color="white" />
                <Text className="text-jazba-white text-xs font-semibold">Add</Text>
              </>
            )}
          </GradientFill>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {images.length === 0 ? (
          <View className="border border-dashed border-border rounded-2xl p-8 items-center">
            <Ionicons name="images-outline" size={32} color={colors.border} />
            <Text className="text-muted text-sm text-center mt-2">
              No photos yet. Add some to show players exactly what this court looks like.
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {images.map((img, index) => (
              <View key={img.id} style={{ width: "47%" }}>
                <Image source={{ uri: img.image_url }} className="w-full rounded-xl bg-gray-100" style={{ height: 120 }} />
                <View className="flex-row items-center justify-between mt-1.5">
                  <View className="flex-row" style={{ gap: 6 }}>
                    <Pressable onPress={() => handleMove(index, -1)} disabled={index === 0} hitSlop={6}>
                      <Ionicons name="chevron-back-circle-outline" size={20} color={index === 0 ? colors.border : colors.muted} />
                    </Pressable>
                    <Pressable onPress={() => handleMove(index, 1)} disabled={index === images.length - 1} hitSlop={6}>
                      <Ionicons
                        name="chevron-forward-circle-outline"
                        size={20}
                        color={index === images.length - 1 ? colors.border : colors.muted}
                      />
                    </Pressable>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 10 }}>
                    <Pressable onPress={() => handleDownload(img.id, img.image_url)} disabled={downloadingId === img.id} hitSlop={6}>
                      {downloadingId === img.id ? (
                        <ActivityIndicator size="small" color={colors.muted} />
                      ) : (
                        <Ionicons name="download-outline" size={18} color={colors.muted} />
                      )}
                    </Pressable>
                    <Pressable onPress={() => handleDelete(img.id)} hitSlop={6}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
