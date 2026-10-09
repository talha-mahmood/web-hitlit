import { useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail } from "../../hooks/useVenuesAdmin";
import { useVenueReviews, useRespondToVenueReview } from "../../hooks/useVenueReviews";
import type { VenueReview } from "../../lib/api/venueReviews";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import GradientFill from "../../components/GradientFill";

type Route = RouteProp<VenueEditingParamList, "AdminReviews">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "AdminReviews">;

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= rating ? "star" : "star-outline"} size={size} color="#F59E0B" />
      ))}
    </View>
  );
}

function ReviewCard({ review, onRespond }: { review: VenueReview; onRespond: () => void }) {
  const date = new Date(review.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <View className="bg-white rounded-2xl p-4 mb-3" style={{ borderWidth: 1, borderColor: "rgba(17, 24, 39, 0.06)" }}>
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-ink font-semibold text-sm" numberOfLines={1}>
          {review.profiles?.full_name ?? "Customer"}
        </Text>
        <Text className="text-muted text-xs">{date}</Text>
      </View>
      <Stars rating={review.rating} />
      {review.review && <Text className="text-ink text-sm mt-2">{review.review}</Text>}

      {review.owner_response ? (
        <View className="bg-gray-50 rounded-xl p-3 mt-3">
          <Text className="text-muted text-xs font-semibold mb-1">Your response</Text>
          <Text className="text-ink text-sm">{review.owner_response}</Text>
        </View>
      ) : (
        <Pressable onPress={onRespond} className="border border-primary rounded-lg py-2 items-center mt-3">
          <Text className="text-primary text-xs font-semibold">Respond</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function AdminReviewsScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue } = useAdminVenueDetail(params.venueId);
  const { data: reviews, isLoading } = useVenueReviews(params.venueId);
  const respond = useRespondToVenueReview(params.venueId);

  const [respondingTo, setRespondingTo] = useState<VenueReview | null>(null);
  const [responseText, setResponseText] = useState("");

  const avgRating = reviews && reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const handleSubmitResponse = () => {
    if (!respondingTo || !responseText.trim()) return;
    respond.mutate(
      { reviewId: respondingTo.id, response: responseText.trim() },
      {
        onSuccess: () => {
          setRespondingTo(null);
          setResponseText("");
        },
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send response.")),
      }
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
          Reviews · {venue?.name ?? ""}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={reviews ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListHeaderComponent={
            (reviews ?? []).length > 0 ? (
              <View className="bg-white rounded-2xl p-5 mb-4 items-center" style={{ borderWidth: 1, borderColor: "rgba(17, 24, 39, 0.06)" }}>
                <Text className="text-ink font-extrabold text-3xl">{avgRating.toFixed(1)}</Text>
                <Stars rating={Math.round(avgRating)} size={18} />
                <Text className="text-muted text-xs mt-1">
                  {reviews!.length} review{reviews!.length === 1 ? "" : "s"}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="border border-dashed border-border rounded-2xl p-8 items-center">
              <Ionicons name="star-outline" size={32} color={colors.border} />
              <Text className="text-muted text-sm text-center mt-2">No reviews yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              onRespond={() => {
                setRespondingTo(item);
                setResponseText("");
              }}
            />
          )}
        />
      )}

      <Modal visible={!!respondingTo} animationType="slide" transparent onRequestClose={() => setRespondingTo(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-black/40 justify-end"
        >
          <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: insets.bottom + 24 }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-ink">Respond to Review</Text>
              <Pressable onPress={() => setRespondingTo(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            {respondingTo && (
              <View className="mb-3">
                <Stars rating={respondingTo.rating} />
                {respondingTo.review && <Text className="text-muted text-sm mt-1">{respondingTo.review}</Text>}
              </View>
            )}
            <TextInput
              value={responseText}
              onChangeText={setResponseText}
              placeholder="Write a public response..."
              multiline
              numberOfLines={4}
              maxLength={500}
              style={{ height: 100, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }}
            />
            <Pressable
              onPress={handleSubmitResponse}
              disabled={respond.isPending || !responseText.trim()}
              style={responseText.trim() ? primaryButtonShadow : undefined}
            >
              {responseText.trim() ? (
                <GradientFill className="rounded-xl py-4 items-center mt-4">
                  {respond.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="font-semibold text-base text-white">Post Response</Text>
                  )}
                </GradientFill>
              ) : (
                <View className="rounded-xl py-4 items-center mt-4 bg-gray-200">
                  {respond.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="font-semibold text-base text-muted">Post Response</Text>
                  )}
                </View>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
