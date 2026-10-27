import { router } from "expo-router";
import { View } from "react-native";
import { Glow } from "~/components/Glow";
import { OnboardingScreen } from "~/components/Onboarding";
import { Orb } from "~/components/Orb";
import { Headline, PrimaryButton, Rise, T, TextButton } from "~/components/ui";
import { useStore } from "~/lib/store";
import { colors } from "~/lib/theme";

export default function Welcome() {
  const { L, settings, auth } = useStore();
  // Without accounts configured (local development), setup continues straight to the permissions.
  const next = (mode: "signup" | "signin") => (auth.mode === "local" ? router.push("/alerts") : router.push({ pathname: "/email", params: { mode } }));
  return (
    <OnboardingScreen
      background={<Glow cy={0.36} />}
      footer={
        <Rise i={2} style={{ gap: 10 }}>
          <PrimaryButton label={L("Get started", "Commencer")} onPress={() => next("signup")} />
          <TextButton label={L("I have an account", "J'ai déjà un compte")} onPress={() => next("signin")} />
        </Rise>
      }
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 30 }}>
        <Orb mood="idle" sphere={184} theme={settings.orbTheme} />
      </View>
      <View style={{ gap: 14, marginBottom: 40 }}>
        <Rise>
          <Headline before={L("Just say", "Dites-nous")} serif={L("where.", "où.")} size={44} />
        </Rise>
        <Rise i={1}>
          <T style={{ fontSize: 17, lineHeight: 25, color: colors.text2 }}>{L("Pyrius finds the flight.", "Pyrius trouve le vol.")}</T>
        </Rise>
      </View>
    </OnboardingScreen>
  );
}
