import { router } from "expo-router";
import { View } from "react-native";
import { OnboardingScreen } from "~/components/Onboarding";
import { Orb } from "~/components/Orb";
import { ThemePicker } from "~/components/ThemePicker";
import { Headline, PrimaryButton, Rise } from "~/components/ui";
import { useStore } from "~/lib/store";

export default function Light() {
  const { L, settings, setOnboarded } = useStore();
  return (
    <OnboardingScreen
      step={5}
      footer={
        <Rise i={2}>
          <PrimaryButton
            label={L("Continue", "Continuer")}
            onPress={() => {
              setOnboarded(true);
              if (router.canDismiss()) router.dismissAll();
              router.replace("/chat");
            }}
          />
        </Rise>
      }
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Orb mood="idle" sphere={168} theme={settings.orbTheme} />
      </View>
      <Rise style={{ marginBottom: 36 }}>
        <Headline before={L("Pick your", "Choisissez votre")} serif={L("light.", "lumière.")} center />
      </Rise>
      <Rise i={1} style={{ marginBottom: 28 }}>
        <ThemePicker />
      </Rise>
    </OnboardingScreen>
  );
}
