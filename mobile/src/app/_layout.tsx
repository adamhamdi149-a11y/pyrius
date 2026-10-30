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
import { LaunchOverlay } from "~/components/LaunchOverlay";
import { ToastHost } from "~/components/Toast";
import { StoreProvider, useStore } from "~/lib/store";
import { colors } from "~/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

/**
 * Every screen belongs to one phase of flow.ts. When sign-in or setup state changes, the screens of the
 * old phase close and the router goes back to "index", which opens the right screen for the new phase.
 * No screen has to know where the person goes after it signs in, finishes setup or signs out.
 */
function Screens() {
  const { ready, phase, auth } = useStore();
  const local = auth.mode === "local";

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // The native splash stays up until the first screen is known.
  if (!ready) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen name="auth/callback" options={{ animation: "none" }} />
        <Stack.Protected guard={phase === "signed-out" || (local && phase === "setup")}>
          <Stack.Screen name="welcome" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={phase === "signed-out"}>
          <Stack.Screen name="email" />
          <Stack.Screen name="code" />
        </Stack.Protected>
        <Stack.Protected guard={phase === "setup"}>
          <Stack.Screen name="alerts" options={{ animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="location" />
          <Stack.Screen name="light" />
        </Stack.Protected>
        <Stack.Protected guard={phase === "app"}>
          <Stack.Screen name="chat" options={{ animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="voice" options={{ presentation: "fullScreenModal", animation: "fade" }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="saved" />
          <Stack.Screen name="tracking" />
        </Stack.Protected>
      </Stack>
      <LaunchOverlay />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, GeistMono_500Medium, InstrumentSerif_400Regular_Italic });

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="light" />
          <Screens />
          <ToastHost />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
