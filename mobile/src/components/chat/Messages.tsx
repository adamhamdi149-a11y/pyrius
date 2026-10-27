import * as WebBrowser from "expo-web-browser";
import { AudioLines, RotateCcw } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { messageAttachments, type ChatMessage, type Chip as ChipT } from "@/lib/types";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { Chip, T } from "../ui";
import { AttachmentView } from "./Results";

export function UserMessage({ m }: { m: ChatMessage }) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(22)} style={s.userWrap}>
      <View style={s.user}>
        {m.via === "voice" ? <AudioLines color={colors.text3} size={13} style={{ marginBottom: 4 }} /> : null}
        <T style={s.userText} selectable>{m.text}</T>
      </View>
    </Animated.View>
  );
}

export function AssistantMessage({ m, conversationId, showChips, onChip }: { m: ChatMessage; conversationId: string; showChips: boolean; onChip: (c: ChipT) => void }) {
  const { L } = useStore();
  const attachments = messageAttachments(m);
  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ gap: 14 }}>
      <T style={s.aiText} selectable>{m.text}</T>
      {attachments.map((a, i) => (
        <AttachmentView key={`${a.type}-${i}`} a={a} conversationId={conversationId} />
      ))}
      {m.sources?.length ? (
        <View style={{ gap: 6 }}>
          <T style={{ fontSize: 12, color: colors.text3 }}>{L("Sources", "Sources")}</T>
          {m.sources.map((src) => (
            <Pressable key={src.url} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(src.url)}>
              <T style={{ fontSize: 13, color: colors.text2, textDecorationLine: "underline" }} numberOfLines={1}>{src.title}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      {showChips && m.chips?.length ? (
        <Animated.View entering={FadeInDown.delay(250)} style={s.chips}>
          {m.chips.map((c) => (
            <Chip key={c.label} label={c.label} onPress={() => onChip(c)} />
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function Dot({ i }: { i: number }) {
  const o = useSharedValue(0.25);
  useEffect(() => {
    o.value = withDelay(i * 160, withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0.25, { duration: 420 })), -1));
  }, [o, i]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[s.dot, st]} />;
}

export function Thinking({ label }: { label: string }) {
  return (
    <Animated.View entering={FadeIn} style={s.thinking} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <Dot i={0} />
      <Dot i={1} />
      <Dot i={2} />
      <T style={{ fontSize: 14, color: colors.text3, marginLeft: 6 }}>{label}</T>
    </Animated.View>
  );
}

export function ErrorRow({ text, hint, onRetry, retryLabel }: { text: string; hint?: string; onRetry: () => void; retryLabel: string }) {
  return (
    <Animated.View entering={FadeIn} style={s.error} accessibilityRole="alert">
      <View style={{ flex: 1 }}>
        <T weight="medium" style={{ fontSize: 14 }}>{text}</T>
        {hint ? <T style={{ fontSize: 13, color: colors.text2, marginTop: 2 }}>{hint}</T> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}>
        <RotateCcw color={colors.text} size={15} />
        <T weight="medium" style={{ fontSize: 14 }}>{retryLabel}</T>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  userWrap: { alignItems: "flex-end" },
  user: { maxWidth: "84%", backgroundColor: colors.surface2, borderRadius: radii.xl + 2, borderBottomRightRadius: 8, paddingHorizontal: 16, paddingVertical: 11 },
  userText: { fontSize: 16, lineHeight: 23 },
  aiText: { fontSize: 16, lineHeight: 25, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 5, height: 28 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text2 },
  error: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.errorSoft, borderWidth: 1, borderColor: "rgba(241,108,114,0.25)" },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.surface },
});
