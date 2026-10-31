import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, FadeIn, FadeOut, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { SKIP, type Answers } from "@/lib/explore/engine";
import { QUESTIONS, type ExploreOption } from "@/lib/explore/questions";
import { pick, useLang } from "~/components/explore/parts";
import { PlacePhoto } from "~/components/PlacePhoto";
import { IconButton, T } from "~/components/ui";
import { useExplore } from "~/lib/explore";
import { placePhoto } from "~/lib/photos";
import { useStore } from "~/lib/store";
import { colors, fonts } from "~/lib/theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** Warms the photo cache for the next questions, so each one appears instantly. */
function prefetch(from: number) {
  for (const q of QUESTIONS.slice(from, from + 2)) {
    for (const o of q.options) {
      void placePhoto(o.photo).then((url) => (url ? Image.prefetch(url) : false));
    }
  }
}

function Progress({ index, total }: { index: number; total: number }) {
  const { L } = useStore();
  return (
    <View style={s.progress} accessibilityRole="progressbar" accessibilityLabel={L(`Question ${index + 1} of ${total}`, `Question ${index + 1} sur ${total}`)} accessibilityValue={{ min: 0, max: total, now: index + 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={s.track}>
          <Animated.View style={[s.fill, { width: i < index ? "100%" : i === index ? "50%" : "0%" }]} />
        </View>
      ))}
    </View>
  );
}

/** One choice: the photo, what it stands for, and where it is. Animates when chosen or passed over. */
function Choice({ option, state, onChoose }: { option: ExploreOption; state: "idle" | "chosen" | "other" | "previous"; onChoose: () => void }) {
  const lang = useLang();
  const press = useSharedValue(1);
  useEffect(() => {
    press.set(withSpring(state === "chosen" ? 1.03 : state === "other" ? 0.95 : 1, { damping: 16, stiffness: 220 }));
  }, [state, press]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const dim = useAnimatedStyle(() => ({ opacity: withTiming(state === "other" ? 0.35 : 1, { duration: 220 }) }));
  return (
    <Animated.View style={[{ flex: 1 }, st, dim]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${pick(option.title, lang)}. ${pick(option.caption, lang)}`}
        accessibilityState={{ selected: state === "chosen" || state === "previous" }}
        onPressIn={() => state === "idle" && press.set(withTiming(0.98, { duration: 90 }))}
        onPressOut={() => state === "idle" && press.set(withSpring(1))}
        onPress={onChoose}
        disabled={state === "chosen" || state === "other"}
        style={{ flex: 1 }}
      >
        <PlacePhoto title={option.photo} style={[s.card, (state === "chosen" || state === "previous") && s.cardOn]} fade={0.92}>
          <View style={s.cardText}>
            <T style={s.place}>{pick(option.place, lang)}</T>
            <T style={s.optTitle}>{pick(option.title, lang)}</T>
            <T style={s.caption}>{pick(option.caption, lang)}</T>
          </View>
        </PlacePhoto>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The discovery game: a question, two places, tap the one that pulls you in. Swipe right to go back,
 * left to skip. Answers save as you go; the last one opens your results.
 */
export default function Play() {
  const insets = useSafeAreaInsets();
  const { L } = useStore();
  const lang = useLang();
  const ex = useExplore();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  // Answers for this run live here until the end, then save once with the results.
  const [answers, setAnswers] = useState<Answers>(() => (edit ? ex.answers : {}));
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [chosen, setChosen] = useState<string | null>(null);
  const q = QUESTIONS[index];

  useEffect(() => prefetch(index), [index]);

  const go = (next: number, d: 1 | -1, all: Answers) => {
    setChosen(null);
    setDir(d);
    if (next >= QUESTIONS.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      ex.finish(all);
      router.replace({ pathname: "/explore/results", params: { fresh: "1" } });
      return;
    }
    setIndex(Math.max(0, next));
  };

  const choose = (o: ExploreOption) => {
    if (chosen) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setChosen(o.id);
    const all = { ...answers, [q.id]: o.id };
    setAnswers(all);
    // Long enough to see the choice land, short enough to keep the rhythm.
    setTimeout(() => go(index + 1, 1, all), 420);
  };

  const skip = () => {
    if (chosen) return;
    Haptics.selectionAsync().catch(() => {});
    const all = { ...answers, [q.id]: SKIP };
    setAnswers(all);
    go(index + 1, 1, all);
  };

  const back = () => {
    if (chosen) return;
    if (index === 0) return router.back();
    Haptics.selectionAsync().catch(() => {});
    go(index - 1, -1, answers);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX < -70 || e.velocityX < -700) scheduleOnRN(skip);
      else if (e.translationX > 70 || e.velocityX > 700) scheduleOnRN(back);
    });

  const prev = answers[q.id];
  const stateOf = (o: ExploreOption) => (chosen ? (chosen === o.id ? "chosen" : "other") : prev === o.id ? "previous" : "idle");

  return (
    <View style={[s.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 14 }]}>
      <View style={s.top}>
        <IconButton label={index === 0 ? L("Close", "Fermer") : L("Previous question", "Question précédente")} onPress={back} style={{ marginLeft: -8 }}>
          {index === 0 ? <X color={colors.text} size={22} /> : <ChevronLeft color={colors.text} size={26} strokeWidth={1.8} />}
        </IconButton>
        <Progress index={index} total={QUESTIONS.length} />
        <Pressable accessibilityRole="button" onPress={skip} hitSlop={10} style={{ paddingHorizontal: 6 }}>
          <T weight="medium" style={{ fontSize: 15, color: colors.text2 }}>{L("Skip", "Passer")}</T>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          key={q.id}
          entering={(dir === 1 ? SlideInRight : SlideInLeft).duration(380).easing(EASE)}
          exiting={(dir === 1 ? SlideOutLeft : SlideOutRight).duration(300).easing(EASE)}
          style={s.stage}
        >
          <Animated.View entering={FadeIn.delay(120).duration(300)} exiting={FadeOut.duration(120)} style={s.prompt}>
            <T weight="mono" style={{ fontSize: 12, color: colors.text3 }}>{`${index + 1} / ${QUESTIONS.length}`}</T>
            <T style={s.question} accessibilityRole="header">{pick(q.prompt, lang)}</T>
          </Animated.View>
          <View style={s.choices}>
            {q.options.map((o) => (
              <Choice key={o.id} option={o} state={stateOf(o)} onChoose={() => choose(o)} />
            ))}
          </View>
        </Animated.View>
      </GestureDetector>
      <T style={s.hint}>{L("Tap the one that pulls you in · swipe to go back or skip", "Touchez celui qui vous attire · balayez pour revenir ou passer")}</T>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { height: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  progress: { flex: 1, flexDirection: "row", gap: 4 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2, backgroundColor: colors.text },
  stage: { flex: 1, paddingHorizontal: 16 },
  prompt: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 14, gap: 6 },
  question: { fontFamily: fonts.medium, fontSize: 27, lineHeight: 31, letterSpacing: -0.7 },
  choices: { flex: 1, gap: 12 },
  card: { flex: 1, borderRadius: 28, borderWidth: 2, borderColor: "transparent", justifyContent: "flex-end" },
  cardOn: { borderColor: colors.white },
  cardText: { padding: 18, gap: 3 },
  place: { fontSize: 11, letterSpacing: 0.8, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" },
  optTitle: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 36, color: colors.white },
  caption: { fontSize: 15, lineHeight: 21, color: "rgba(255,255,255,0.85)" },
  hint: { fontSize: 12, color: colors.text3, textAlign: "center", marginTop: 12, paddingHorizontal: 20 },
});
