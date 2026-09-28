import "./global.css";
import "./src/lib/alertPolyfill";
import "./src/lib/activityIndicatorPolyfill";
import { POPPINS_FONTS } from "./src/lib/fontPolyfill";
import { View } from "react-native";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RootNavigator from "./src/navigation/RootNavigator";
import CustomAlertHost from "./src/components/CustomAlertHost";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts(POPPINS_FONTS);

  // Hold the first render until Poppins is ready so text never flashes in
  // the system font first. If loading somehow fails, fall through rather
  // than leave the app on a blank screen (text then uses the system font).
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
          <CustomAlertHost />
          <StatusBar style="dark" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

