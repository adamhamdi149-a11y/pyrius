import { useLocalSearchParams } from "expo-router";
import { Mail } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Linking, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { OnboardingScreen } from "~/components/Onboarding";
import { toast } from "~/components/Toast";
import { Headline, PrimaryButton, Rise, T, TextButton, useAccent } from "~/components/ui";
import { sendEmailCode, verifyEmailCode } from "~/lib/auth";
import { useStore } from "~/lib/store";
import { colors, fonts, radii } from "~/lib/theme";

const LENGTH = 6;
const RESEND_AFTER = 60;

function Caret({ color }: { color: string }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 550 }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 550 }), withTiming(1, { duration: 0 })), -1);
  }, [o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 2, height: 24, borderRadius: 2, backgroundColor: color }, st]} />;
}

export default function Code() {
  const { email = "" } = useLocalSearchParams<{ email: string }>();
  const { L, updateSettings, setPendingCode } = useStore();
  const accent = useAccent();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER);
  const [focused, setFocused] = useState(true);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const verify = async (value = code) => {
    if (value.length !== LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(String(email), value);
      updateSettings({ email: String(email) });
      // Signed in: the layout's guards close the sign-in screens and open setup (or the chat).
    } catch (e) {
      setError((e as Error).message);
      setCode("");
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await sendEmailCode(String(email));
      setPendingCode(String(email));
      setWait(RESEND_AFTER);
      toast({ tone: "ok", title: L("New code sent", "Nouveau code envoyé") });
    } catch (e) {
      toast({ tone: "error", title: (e as Error).message });
    }
  };

  const digits = Array.from({ length: LENGTH }, (_, i) => code[i] ?? "");
  const active = Math.min(code.length, LENGTH - 1);

  return (
    <OnboardingScreen
      step={2}
      back
      backTo="/email"
      onBack={() => setPendingCode(null)}
      footer={
        <Rise i={3} style={{ gap: 10 }}>
          <PrimaryButton label={L("Verify", "Vérifier")} onPress={() => verify()} busy={busy} disabled={code.length !== LENGTH} />
          {Platform.OS === "ios" ? (
            <TextButton label={L("Open Mail", "Ouvrir Mail")} icon={<Mail color={colors.text2} size={17} strokeWidth={1.7} />} onPress={() => Linking.openURL("message://").catch(() => {})} />
          ) : null}
        </Rise>
      }
    >
      <Rise style={{ marginTop: 56, marginBottom: 12 }}>
        <Headline before={L("Check your", "Vérifiez vos")} serif={L("inbox", "courriels")} />
      </Rise>
      <Rise i={1}>
        <T style={{ fontSize: 16, color: colors.text2, marginBottom: 40 }}>{L(`Sent to ${email}`, `Envoyé à ${email}`)}</T>
      </Rise>
      <Rise i={2}>
        <Pressable onPress={() => input.current?.focus()} accessibilityLabel={L("6-digit code", "Code à 6 chiffres")} style={s.row}>
          {digits.map((d, i) => {
            const on = focused && i === active && code.length < LENGTH;
            return (
              <View key={i} style={[s.box, on && { borderColor: accent.line, boxShadow: `0 0 0 4px ${accent.soft}` }]}>
                {d ? <T weight="mono" style={s.digit}>{d}</T> : on ? <Caret color={accent.accent} /> : null}
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(v) => {
            const clean = v.replace(/\D/g, "").slice(0, LENGTH);
            setCode(clean);
            setError(null);
            if (clean.length === LENGTH) verify(clean);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={LENGTH}
          caretHidden
          accessibilityLabel={L("6-digit code", "Code à 6 chiffres")}
          style={s.hidden}
        />
        {error ? <T style={{ color: colors.error, fontSize: 13, marginTop: 16 }} accessibilityLiveRegion="polite">{error}</T> : null}
        <View style={{ marginTop: 24, flexDirection: "row" }}>
          {wait > 0 ? (
            <T style={{ fontSize: 14, color: colors.text3 }}>
              {L("Resend in ", "Renvoyer dans ")}
              <T weight="mono" style={{ fontSize: 14, color: colors.text2 }}>{`0:${String(wait).padStart(2, "0")}`}</T>
            </T>
          ) : (
            <Pressable onPress={resend} accessibilityRole="button" hitSlop={10}>
              <T weight="medium" style={{ fontSize: 14, color: accent.hi }}>{L("Send a new code", "Envoyer un nouveau code")}</T>
            </Pressable>
          )}
        </View>
      </Rise>
    </OnboardingScreen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  box: { flex: 1, height: 60, borderRadius: radii.md + 2, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg2, alignItems: "center", justifyContent: "center" },
  digit: { fontSize: 24, fontFamily: fonts.mono },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
