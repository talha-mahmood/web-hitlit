import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import { useProfileStore, isProfileComplete } from "../store/profileStore";
import SplashScreen from "../screens/SplashScreen";
import AuthNavigator from "./AuthNavigator";
import MainTabNavigator from "./MainTabNavigator";
import AdminNavigator from "./AdminNavigator";
import SuperAdminNavigator from "./SuperAdminNavigator";
import ProfileSetupScreen from "../screens/onboarding/ProfileSetupScreen";

export default function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const init = useAuthStore((s) => s.init);

  const profile = useProfileStore((s) => s.profile);
  const isProfileLoading = useProfileStore((s) => s.isLoading);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const clearProfile = useProfileStore((s) => s.clear);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  useEffect(() => {
    if (session?.user.id) {
      fetchProfile(session.user.id);
    } else {
      clearProfile();
    }
  }, [session?.user.id, fetchProfile, clearProfile]);

  if (isInitializing) {
    return <SplashScreen />;
  }

  let content;
  if (!session) {
    content = <AuthNavigator />;
  } else if (isProfileLoading) {
    content = <SplashScreen />;
  } else if (!isProfileComplete(profile)) {
    // Identity setup (name/avatar) is role-agnostic — owners and
    // superadmins go through the same onboarding as everyone else before
    // landing in their respective dashboard below.
    content = <ProfileSetupScreen />;
  } else if (profile?.type === "superadmin") {
    content = <SuperAdminNavigator />;
  } else if (profile?.type === "owner") {
    content = <AdminNavigator />;
  } else {
    content = <MainTabNavigator />;
  }

  return <NavigationContainer>{content}</NavigationContainer>;
}
