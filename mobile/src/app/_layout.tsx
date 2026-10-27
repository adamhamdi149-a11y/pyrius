import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastHost } from "~/components/Toast";
import { StoreProvider } from "~/lib/store";
import { colors } from "~/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, GeistMono_500Medium, InstrumentSerif_400Regular_Italic });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "fade" }}>
            <Stack.Screen name="index" options={{ animation: "none" }} />
            <Stack.Screen name="chat" options={{ animation: "fade", gestureEnabled: false }} />
            <Stack.Screen name="voice" options={{ presentation: "fullScreenModal", animation: "fade" }} />
            <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="saved" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="tracking" options={{ animation: "slide_from_right" }} />
          </Stack>
          <ToastHost />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
