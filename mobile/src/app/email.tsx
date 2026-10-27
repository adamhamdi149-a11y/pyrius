import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AppleMark, GoogleMark } from "~/components/BrandMarks";
import { OnboardingScreen } from "~/components/Onboarding";
import { toast } from "~/components/Toast";
import { Headline, OutlineButton, PrimaryButton, Rise, T, useAccent } from "~/components/ui";
import { isEmail, sendEmailCode, signInWithProvider } from "~/lib/auth";
import { API_URL } from "~/lib/config";
import { useStore } from "~/lib/store";
import { enabledProviders } from "~/lib/supabase";
import { colors, fonts, radii } from "~/lib/theme";

export default function Email() {
  const { L, onboarded } = useStore();
  const accent = useAccent();
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState({ google: false, apple: false });

  useEffect(() => {
    enabledProviders().then(setProviders);
  }, []);

  const valid = isEmail(email);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy("email");
    setError(null);
    try {
      await sendEmailCode(email);
      router.push({ pathname: "/code", params: { email: email.trim().toLowerCase() } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const oauth = async (p: "google" | "apple") => {
    setBusy(p);
    try {
      if (await signInWithProvider(p)) router.replace(onboarded ? "/chat" : "/alerts");
    } catch (e) {
      toast({ tone: "error", title: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const social = providers.google || providers.apple;

  return (
    <OnboardingScreen
      step={1}
      back
      footer={
        <Rise i={2} style={{ gap: 12 }}>
          <PrimaryButton label={L("Continue", "Continuer")} onPress={submit} busy={busy === "email"} disabled={!valid} />
          {social ? (
            <>
              <View style={s.or}>
                <View style={s.rule} />
                <T style={{ color: colors.text3, fontSize: 13 }}>{L("or", "ou")}</T>
                <View style={s.rule} />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {providers.apple ? <OutlineButton style={{ flex: 1 }} label="Apple" icon={<AppleMark />} onPress={() => oauth("apple")} busy={busy === "apple"} disabled={Boolean(busy)} /> : null}
                {providers.google ? <OutlineButton style={{ flex: 1 }} label="Google" icon={<GoogleMark />} onPress={() => oauth("google")} busy={busy === "google"} disabled={Boolean(busy)} /> : null}
              </View>
            </>
          ) : null}
          <T style={s.legal}>
            {L("By continuing you accept the ", "En continuant, vous acceptez les ")}
            <T style={s.link} onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/legal/terms`)} accessibilityRole="link">
              {L("Terms", "Conditions")}
            </T>
            {L(" and ", " et la ")}
            <T style={s.link} onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/legal/privacy`)} accessibilityRole="link">
              {L("Privacy", "Confidentialité")}
            </T>
            .
          </T>
        </Rise>
      }
    >
      <Rise style={{ marginTop: 56, marginBottom: 36 }}>
        <Headline before={L("Your", "Votre")} serif={L("email", "courriel")} />
      </Rise>
      <Rise i={1} style={{ gap: 10 }}>
        <T weight="medium" nativeID="emailLabel" style={{ fontSize: 13, color: colors.text2 }}>
          {L("Email address", "Adresse courriel")}
        </T>
        <TextInput
          accessibilityLabelledBy="emailLabel"
          accessibilityLabel={L("Email address", "Adresse courriel")}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={submit}
          placeholder="name@example.com"
          placeholderTextColor={colors.text3}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="go"
          autoFocus
          style={[s.field, focused && { borderColor: accent.line, boxShadow: `0 0 0 4px ${accent.soft}` }]}
        />
        {error ? <T style={{ color: colors.error, fontSize: 13 }} accessibilityLiveRegion="polite">{error}</T> : null}
      </Rise>
    </OnboardingScreen>
  );
}

const s = StyleSheet.create({
  field: { height: 58, paddingHorizontal: 20, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg2, color: colors.text, fontFamily: fonts.regular, fontSize: 17 },
  or: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 8 },
  rule: { flex: 1, height: 1, backgroundColor: colors.borderSoft },
  legal: { textAlign: "center", fontSize: 12, lineHeight: 18, color: colors.text3, marginTop: 8 },
  link: { fontSize: 12, color: colors.text2, textDecorationLine: "underline" },
});
