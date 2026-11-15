import { supabase } from "../supabase";

// Whether the viewer already follows this player, plus how many followers
// they have in total — both shown on PlayerProfileScreen's Follow button.
export async function fetchFollowState(
  viewerId: string | undefined,
  profileUserId: string
): Promise<{ isFollowing: boolean; followerCount: number }> {
  const [followRes, countRes] = await Promise.all([
    viewerId
      ? supabase
          .from("player_follows")
          .select("follower_id")
          .eq("follower_id", viewerId)
          .eq("followed_id", profileUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("player_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followed_id", profileUserId),
  ]);
  if (followRes.error) throw new Error(followRes.error.message);
  if (countRes.error) throw new Error(countRes.error.message);
  return { isFollowing: !!followRes.data, followerCount: countRes.count ?? 0 };
}

export async function followPlayer(followerId: string, followedId: string): Promise<void> {
  const { error } = await supabase.from("player_follows").insert({ follower_id: followerId, followed_id: followedId });
  if (error) throw new Error(error.message);
}

export async function unfollowPlayer(followerId: string, followedId: string): Promise<void> {
  const { error } = await supabase
    .from("player_follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followed_id", followedId);
  if (error) throw new Error(error.message);
}
