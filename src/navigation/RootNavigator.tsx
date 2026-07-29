import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import SplashScreen from "../screens/SplashScreen";
import AuthNavigator from "./AuthNavigator";
import MainTabNavigator from "./MainTabNavigator";

export default function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  if (isInitializing) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {session ? <MainTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
