import { getRecordingPermissionsAsync } from "expo-audio";
import * as WebBrowser from "expo-web-browser";
import { Check, ChevronLeft, ChevronRight, CreditCard, LogOut, Minus, Monitor, Moon, Plus, Sparkles, Sun } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, DevSettings, Linking, Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import { findAirport } from "@/lib/data/world";
import { ORB_THEMES, orbThemeById, stepOrbTheme } from "@/lib/orbThemes";
import { limitText, planById, planPrice, PLANS, usd, YEARLY_SAVING } from "@/lib/plans";
import type { BillingInterval, Currency, Locale, PlanId } from "@/lib/types";
import { AirportPicker } from "~/components/AirportPicker";
import { confirmDialog, showDialog } from "~/components/Dialog";
import { Orb } from "~/components/Orb";
import { Divider, Page, Section } from "~/components/Page";
import { toast } from "~/components/Toast";
import { T, tap, useAccent } from "~/components/ui";
import { VoiceOptions } from "~/components/VoiceOptions";
import { api, ApiError } from "~/lib/api";
import { getNotificationPermission, requestNotificationPermission } from "~/lib/notifications";
import { useStore } from "~/lib/store";
import { colors, fonts, noOutline, radii, saveThemePref, scheme, themePref, type ThemePref } from "~/lib/theme";

/* ---------------- Building blocks ---------------- */

function Row({ label, value, onPress, right, sub, icon }: { label: string; value?: string; onPress?: () => void; right?: ReactNode; sub?: string; icon?: ReactNode }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [s.row, pressed && onPress && { backgroundColor: colors.surface }]}>
      {icon}
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 16 }}>{label}</T>
        {sub ? <T style={{ fontSize: 13, lineHeight: 18, color: colors.text3, marginTop: 2 }}>{sub}</T> : null}
      </View>
      {value ? <T style={{ fontSize: 15, color: colors.text2, maxWidth: "50%", textAlign: "right" }} numberOfLines={1}>{value}</T> : null}
      {right ?? (onPress ? <ChevronRight color={colors.text3} size={18} /> : null)}
    </Pressable>
  );
}

function Segments<V extends string>({ value, options, onChange }: { value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <View style={s.segments} accessibilityRole="radiogroup">
      {options.map(([v, label]) => (
        <Pressable
          key={v}
          accessibilityRole="radio"
          accessibilityState={{ checked: v === value }}
          onPress={() => {
            if (v === value) return;
            tap();
            onChange(v);
          }}
          style={[s.segment, v === value && s.segmentOn]}
        >
          <T weight={v === value ? "semibold" : "regular"} style={{ fontSize: 14, color: v === value ? colors.text : colors.text2 }}>{label}</T>
        </Pressable>
      ))}
    </View>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const accent = useAccent();
  return <Switch value={value} onValueChange={onChange} trackColor={{ true: accent.accent, false: colors.surface3 }} thumbColor={colors.white} ios_backgroundColor={colors.surface3} accessibilityLabel={label} />;
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const { L } = useStore();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${L("Fewer", "Moins de")} ${label}`} disabled={value <= min} onPress={() => (tap(), onChange(value - 1))} style={[s.step, value <= min && { opacity: 0.35 }]}>
        <Minus color={colors.text} size={15} />
      </Pressable>
      <T weight="mono" style={{ width: 24, textAlign: "center", fontSize: 16 }}>{value}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`${L("More", "Plus de")} ${label}`} disabled={value >= max} onPress={() => (tap(), onChange(value + 1))} style={[s.step, value >= max && { opacity: 0.35 }]}>
        <Plus color={colors.text} size={15} />
      </Pressable>
    </View>
  );
}

const initials = (name: string, email?: string) => {
  const src = name.trim() || email?.split("@")[0] || "";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "P") + (parts[1]?.[0] ?? "")).toUpperCase();
};

/** Light or dark is applied when Pyrius starts, so changing it restarts the app. */
function restartApp(L: (en: string, fr: string) => string) {
  if (__DEV__) return DevSettings.reload();
  showDialog({ title: L("Almost done", "Presque terminé"), message: L("Close Pyrius and open it again to see the new appearance.", "Fermez Pyrius et rouvrez-le pour voir la nouvelle apparence.") });
}

/* ---------------- Appearance ---------------- */

const ORB_NAMES_FR: Record<string, [string, string]> = { ember: ["Braise ardente", "Lumière ambrée chaude"], arctic: ["Pulsation arctique", "Lumière saphir électrique"], violet: ["Nova violette", "Lumière ultraviolette"] };

function ThemeCard({ id, label, icon, on, onPress }: { id: "dark" | "light" | "system"; label: string; icon: ReactNode; on: boolean; onPress: () => void }) {
  const accent = useAccent();
  const paper = id === "light" ? ["#f6f5f2", "#e4e1db", "#17171b"] : id === "dark" ? ["#090a0d", "#262730", "#f5f5f7"] : null;
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} style={[s.themeCard, on && { borderColor: accent.accent }]}>
      <View style={s.preview}>
        {paper ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: paper[0] }]} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
            <View style={{ flex: 1, backgroundColor: "#f6f5f2" }} />
            <View style={{ flex: 1, backgroundColor: "#090a0d" }} />
          </View>
        )}
        <View style={[s.previewOrb, { backgroundColor: accent.accent }]} />
        <View style={[s.previewLine, { backgroundColor: paper ? paper[1] : "#8a8790", width: "55%" }]} />
        <View style={[s.previewLine, { backgroundColor: paper ? paper[1] : "#8a8790", width: "75%", height: 8, borderRadius: 4 }]} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <T weight={on ? "semibold" : "regular"} style={{ fontSize: 13, color: on ? colors.text : colors.text2 }}>{label}</T>
      </View>
    </Pressable>
  );
}

function Appearance() {
  const { L, settings, updateSettings } = useStore();
  const theme = orbThemeById(settings.orbTheme);
  const index = ORB_THEMES.findIndex((t) => t.id === theme.id);
  const fr = settings.locale === "fr";
  const [pref, setPref] = useState<ThemePref>(themePref);

  const choose = (p: ThemePref) => {
    setPref(p);
    updateSettings({ theme: p });
    saveThemePref(p);
    const next = p === "system" ? scheme : p;
    // Only a real change of colours needs a restart ("System" may already be what's showing).
    if (p !== "system" && next !== scheme) {
      confirmDialog({
        title: L("Restart to apply?", "Redémarrer pour appliquer ?"),
        message: L("Pyrius restarts to switch every screen to the new appearance. Your conversations are kept.", "Pyrius redémarre pour appliquer la nouvelle apparence à tous les écrans. Vos conversations sont conservées."),
        cancel: L("Later", "Plus tard"),
        confirm: L("Restart", "Redémarrer"),
        onConfirm: () => restartApp(L),
      });
    } else if (p === "system") {
      toast({ tone: "ok", title: L("Follows your phone from the next launch", "Suivra votre téléphone au prochain lancement") });
    }
  };

  const step = (d: 1 | -1) => {
    tap();
    updateSettings({ orbTheme: stepOrbTheme(theme.id, d) });
  };

  return (
    <>
      <Section title={L("APPEARANCE", "APPARENCE")} footer={L("Dark and Blazing Ember are the defaults. Your choices are saved with your account.", "Sombre et Braise ardente sont les choix par défaut. Vos choix sont enregistrés avec votre compte.")}>
        <View style={{ flexDirection: "row", gap: 10, padding: 14 }} accessibilityRole="radiogroup">
          <ThemeCard id="dark" label={L("Dark", "Sombre")} icon={<Moon color={colors.text2} size={14} />} on={pref === "dark"} onPress={() => choose("dark")} />
          <ThemeCard id="light" label={L("Light", "Clair")} icon={<Sun color={colors.text2} size={14} />} on={pref === "light"} onPress={() => choose("light")} />
          <ThemeCard id="system" label={L("System", "Système")} icon={<Monitor color={colors.text2} size={14} />} on={pref === "system"} onPress={() => choose("system")} />
        </View>
      </Section>

      <Section title={L("ORB COLOR", "COULEUR DE L'ORBE")} footer={L("The light that powers Pyrius. Buttons and highlights across the app follow it.", "La lumière qui anime Pyrius. Les boutons et les accents de l'app la suivent.")}>
        <View style={s.orbStage}>
          <Orb mood="idle" sphere={120} theme={theme.id} />
        </View>
        <View style={s.orbCtrl}>
          <Pressable accessibilityRole="button" accessibilityLabel={L("Previous color", "Couleur précédente")} onPress={() => step(-1)} style={s.orbArrow}>
            <ChevronLeft color={colors.text} size={20} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center", gap: 2 }} accessibilityLiveRegion="polite">
            <T weight="semibold" style={{ fontSize: 17 }}>{fr ? ORB_NAMES_FR[theme.id][0] : theme.name}</T>
            <T style={{ fontSize: 13, color: colors.text2 }}>{fr ? ORB_NAMES_FR[theme.id][1] : theme.mood}</T>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={L("Next color", "Couleur suivante")} onPress={() => step(1)} style={s.orbArrow}>
            <ChevronRight color={colors.text} size={20} />
          </Pressable>
        </View>
        <View style={s.orbDots} accessibilityLabel={L(`${index + 1} of ${ORB_THEMES.length}`, `${index + 1} sur ${ORB_THEMES.length}`)}>
          {ORB_THEMES.map((t, i) => (
            <View key={t.id} style={[s.orbDot, i === index && { width: 18, backgroundColor: colors.text }]} />
          ))}
        </View>
      </Section>
    </>
  );
}

/* ---------------- Plans ---------------- */

const FEATURES_FR: Record<string, string> = {
  "3 AI-assisted flight searches per month": "3 recherches de vols assistées par l'IA par mois",
  "Save 1 flight offer": "Enregistrer 1 offre de vol",
  "Track 1 flight price": "Suivre le prix d'un vol",
  "Basic trip planning": "Planification de voyage de base",
  "Access to available live flight results": "Accès aux résultats de vols en direct",
  "30 AI-assisted flight searches per month": "30 recherches de vols assistées par l'IA par mois",
  "Save unlimited flight offers": "Offres de vol enregistrées illimitées",
  "Track 10 flight prices": "Suivre le prix de 10 vols",
  "Email price alerts": "Alertes de prix par courriel",
  "Saved-search alerts": "Alertes de recherches enregistrées",
  "Compare flexible travel dates": "Comparer des dates flexibles",
  "AI trip refinements": "Affinage du voyage par l'IA",
  "Unlimited AI-assisted flight searches": "Recherches de vols assistées par l'IA illimitées",
  "Unlimited tracked flight prices": "Suivi de prix illimité",
  "Unlimited saved flight offers": "Offres enregistrées illimitées",
  "Email price and saved-search alerts": "Alertes de prix et de recherches par courriel",
  "Priority support": "Assistance prioritaire",
};
const TAGLINES_FR: Record<PlanId, string> = { free: "Essayez Pyrius pour votre prochain voyage.", plus: "Pour ceux qui surveillent toujours un tarif.", pro: "Pour les grands voyageurs et les organisateurs." };

function Plans() {
  const { L, settings, subscription, trackers, saved, auth } = useStore();
  const accent = useAccent();
  const fr = settings.locale === "fr";
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [busy, setBusy] = useState<PlanId | "portal" | null>(null);
  const current = planById(subscription.plan);
  const paying = subscription.source === "stripe" && subscription.plan !== "free";

  const open = async (path: "/api/checkout" | "/api/billing/portal", body: object, key: PlanId | "portal") => {
    if (auth.mode !== "cloud") return showDialog({ title: L("Sign in first", "Connectez-vous d'abord"), message: L("Plans are attached to your Pyrius account.", "Les forfaits sont liés à votre compte Pyrius.") });
    setBusy(key);
    try {
      const r = await api<{ url?: string; demo?: boolean }>(path, body);
      if (r.url) await WebBrowser.openBrowserAsync(r.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      else if (r.demo) showDialog({ title: L("Payments aren't open yet", "Les paiements ne sont pas encore ouverts"), message: L("Upgrades will be available here as soon as billing is connected. Nothing was charged.", "Les forfaits seront disponibles ici dès que la facturation sera connectée. Rien n'a été facturé.") });
    } catch (e) {
      toast({ tone: "error", title: e instanceof ApiError ? e.message : L("Couldn't open checkout", "Impossible d'ouvrir le paiement") });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section
      title={L("PLAN", "FORFAIT")}
      footer={L(
        "Prices in US dollars, plus applicable taxes. Cancel any time; paid features continue until the end of the period you've paid for. Payments are handled securely by Stripe.",
        "Prix en dollars américains, taxes en sus. Annulez à tout moment; les avantages restent actifs jusqu'à la fin de la période payée. Paiements sécurisés par Stripe.",
      )}
    >
      <View style={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[s.planIcon, { backgroundColor: accent.soft }]}>
            <Sparkles color={accent.hi} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="semibold" style={{ fontSize: 16 }}>{L(`${current.name} plan`, `Forfait ${current.name}`)}</T>
            <T style={{ fontSize: 13, color: colors.text3 }}>
              {L(
                `${saved.length} of ${limitText(current.limits.saved)} saved · ${trackers.length} of ${limitText(current.limits.trackers)} tracked`,
                `${saved.length} sur ${limitText(current.limits.saved).replace("unlimited", "illimité")} enregistrées · ${trackers.length} sur ${limitText(current.limits.trackers).replace("unlimited", "illimité")} suivis`,
              )}
            </T>
          </View>
        </View>
        {paying ? (
          <Pressable accessibilityRole="button" onPress={() => open("/api/billing/portal", {}, "portal")} style={s.manage}>
            <CreditCard color={colors.text} size={16} />
            <T weight="medium" style={{ fontSize: 15 }}>{busy === "portal" ? L("Opening…", "Ouverture…") : L("Manage billing", "Gérer la facturation")}</T>
          </Pressable>
        ) : (
          <Segments<BillingInterval>
            value={interval}
            options={[
              ["month", L("Monthly", "Mensuel")],
              ["year", L(`Yearly · save ${YEARLY_SAVING}%`, `Annuel · −${YEARLY_SAVING} %`)],
            ]}
            onChange={setInterval}
          />
        )}
      </View>
      {PLANS.map((p) => {
        const isCurrent = p.id === subscription.plan;
        const featured = p.id === "plus";
        const price = planPrice(p, interval);
        return (
          <View key={p.id}>
            <Divider />
            <View style={[s.plan, featured && { backgroundColor: accent.soft }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T weight="semibold" style={{ fontSize: 18, flex: 1 }}>{p.name}</T>
                {isCurrent ? (
                  <View style={s.badge}>
                    <T weight="medium" style={{ fontSize: 12, color: colors.text2 }}>{L("Current", "Actuel")}</T>
                  </View>
                ) : featured ? (
                  <View style={[s.badge, { backgroundColor: accent.accent, borderColor: accent.accent }]}>
                    <T weight="semibold" style={{ fontSize: 12, color: accent.ink }}>{L("Recommended", "Recommandé")}</T>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <T weight="semibold" style={{ fontSize: 30, letterSpacing: -0.8 }}>{usd(price.perMonth)}</T>
                <T style={{ fontSize: 13, color: colors.text3 }}>{L("USD / month", "USD / mois")}</T>
              </View>
              {p.monthlyUSD > 0 ? (
                <T style={{ fontSize: 12, color: colors.text3, marginTop: -6 }}>{interval === "year" ? L(`Billed ${usd(price.charged)} yearly`, `Facturé ${usd(price.charged)} par an`) : L("Billed monthly", "Facturé chaque mois")}</T>
              ) : null}
              <T style={{ fontSize: 14, color: colors.text2 }}>{fr ? TAGLINES_FR[p.id] : p.tagline}</T>
              <View style={{ gap: 8 }}>
                {p.features.map((f) => (
                  <View key={f} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                    <Check color={accent.hi} size={16} strokeWidth={2.4} style={{ marginTop: 2 }} />
                    <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{fr ? FEATURES_FR[f] ?? f : f}</T>
                  </View>
                ))}
              </View>
              {isCurrent || p.id === "free" ? null : (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy !== null}
                  onPress={() => (paying ? open("/api/billing/portal", {}, "portal") : open("/api/checkout", { plan: p.id, interval }, p.id))}
                  style={({ pressed }) => [s.choose, featured ? { backgroundColor: accent.accent } : { backgroundColor: colors.surface3 }, { opacity: pressed || busy ? 0.8 : 1 }]}
                >
                  <T weight="semibold" style={{ fontSize: 15, color: featured ? accent.ink : colors.text }}>
                    {busy === p.id ? L("Opening checkout…", "Ouverture du paiement…") : paying ? L(`Switch to ${p.name}`, `Passer à ${p.name}`) : L(`Choose ${p.name}`, `Choisir ${p.name}`)}
                  </T>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </Section>
  );
}

/* ---------------- Screen ---------------- */

export default function Settings() {
  const { L, settings, updateSettings, voice, updateVoice, auth, subscription, signOut } = useStore();
  const accent = useAccent();
  const [airport, setAirport] = useState(false);
  const [mic, setMic] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [alerts, setAlerts] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [name, setName] = useState(settings.name);

  // Permissions can change in the system settings while Pyrius is open; re-read them on return.
  useEffect(() => {
    const read = () => {
      getRecordingPermissionsAsync().then((p) => setMic(p.status as typeof mic), () => {});
      getNotificationPermission().then(setAlerts, () => {});
    };
    read();
    const sub = AppState.addEventListener("change", (st) => st === "active" && read());
    return () => sub.remove();
  }, []);

  const home = findAirport(settings.homeAirport);
  const email = auth.mode === "cloud" ? auth.email : settings.email;
  const permText = (p: string) => (p === "granted" ? L("Allowed", "Autorisé") : p === "denied" ? L("Off", "Désactivé") : L("Not asked yet", "Pas encore demandé"));
  const style = settings.travelStyle;
  const n = settings.notifications;

  return (
    <Page title={L("Settings", "Réglages")}>
      <View style={s.profile}>
        <View style={[s.avatar, { backgroundColor: accent.soft, borderColor: accent.line }]}>
          <T weight="semibold" style={{ fontSize: 22, color: accent.hi }}>{initials(name, email)}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="semibold" style={{ fontSize: 20, letterSpacing: -0.3 }} numberOfLines={1}>{name || L("Traveler", "Voyageur")}</T>
          <T style={{ fontSize: 14, color: colors.text2 }} numberOfLines={1}>{email || "—"}</T>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
            <View style={[s.badge, { borderColor: accent.line }]}>
              <T weight="medium" style={{ fontSize: 12, color: accent.hi }}>{planById(subscription.plan).name}</T>
            </View>
            <View style={s.badge}>
              <T style={{ fontSize: 12, color: colors.text2 }}>{auth.mode === "cloud" ? L("Synced", "Synchronisé") : L("On this phone", "Sur ce téléphone")}</T>
            </View>
          </View>
        </View>
      </View>

      <Section title={L("PROFILE", "PROFIL")}>
        <View style={s.row}>
          <T style={{ fontSize: 16, width: 90 }}>{L("Name", "Nom")}</T>
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => updateSettings({ name: name.trim() })}
            placeholder={L("Your name", "Votre nom")}
            placeholderTextColor={colors.text3}
            style={s.input}
            accessibilityLabel={L("Name", "Nom")}
            textContentType="name"
            autoComplete="name"
          />
        </View>
        <Divider />
        <Row label={L("Email", "Courriel")} value={email || "—"} sub={auth.mode === "cloud" ? L("Managed by your sign-in.", "Géré par votre connexion.") : undefined} />
      </Section>

      <Plans />

      <Appearance />

      <Section title={L("TRAVEL PREFERENCES", "PRÉFÉRENCES DE VOYAGE")} footer={L("Defaults Pyrius uses so it can ask fewer questions.", "Les choix par défaut de Pyrius, pour vous poser moins de questions.")}>
        <Row label={L("Home airport", "Aéroport de départ")} value={home ? `${home.city} (${home.code})` : settings.homeAirport} onPress={() => setAirport(true)} />
        <Divider />
        <View style={s.block}>
          <T style={{ fontSize: 16 }}>{L("Currency", "Devise")}</T>
          <Segments<Currency> value={settings.currency} options={[["CAD", "CAD"], ["USD", "USD"], ["EUR", "EUR"]]} onChange={(currency) => updateSettings({ currency })} />
        </View>
        <Divider />
        <View style={s.block}>
          <T style={{ fontSize: 16 }}>{L("Language", "Langue")}</T>
          <Segments<Locale> value={settings.locale} options={[["en", "English"], ["fr", "Français"]]} onChange={(locale) => updateSettings({ locale })} />
        </View>
        <Divider />
        <Row label={L("Adults", "Adultes")} sub={L("Who you usually travel with", "Avec qui vous voyagez d'habitude")} right={<Stepper value={settings.defaultAdults} min={1} max={6} label={L("adults", "adultes")} onChange={(v) => updateSettings({ defaultAdults: v })} />} />
        <Divider />
        <Row label={L("Children", "Enfants")} right={<Stepper value={settings.defaultChildren} min={0} max={4} label={L("children", "enfants")} onChange={(v) => updateSettings({ defaultChildren: v })} />} />
        <Divider />
        <Row label={L("Prefer nonstop flights", "Vols directs de préférence")} right={<Toggle value={style.nonstop} label={L("Prefer nonstop flights", "Vols directs de préférence")} onChange={(v) => updateSettings({ travelStyle: { ...style, nonstop: v } })} />} />
        <Divider />
        <Row label={L("Carry-on included", "Bagage cabine inclus")} right={<Toggle value={style.carryOnOnly} label={L("Carry-on included", "Bagage cabine inclus")} onChange={(v) => updateSettings({ travelStyle: { ...style, carryOnOnly: v } })} />} />
        <Divider />
        <Row label={L("My dates are usually flexible", "Mes dates sont souvent flexibles")} right={<Toggle value={style.flexibleDates} label={L("Flexible dates", "Dates flexibles")} onChange={(v) => updateSettings({ travelStyle: { ...style, flexibleDates: v } })} />} />
      </Section>

      <Section
        title={L("VOICE", "VOIX")}
        footer={L(
          "Your voice goes straight to OpenAI to be understood and answered; Pyrius doesn't record or keep audio. Transcripts are saved in the conversation like typed messages.",
          "Votre voix est envoyée directement à OpenAI pour être comprise; Pyrius n'enregistre ni ne conserve l'audio. Les transcriptions sont gardées dans la conversation comme les messages écrits.",
        )}
      >
        <Row label={L("Voice conversations", "Conversations vocales")} right={<Toggle value={voice.enabled && !voice.textOnly} label={L("Voice conversations", "Conversations vocales")} onChange={(v) => updateVoice({ enabled: v, textOnly: v ? false : voice.textOnly })} />} />
        <Divider />
        <Row label={L("Text only", "Texte seulement")} sub={L("Hides the microphone and voice buttons.", "Masque les boutons micro et voix.")} right={<Toggle value={voice.textOnly} label={L("Text only", "Texte seulement")} onChange={(v) => updateVoice({ textOnly: v })} />} />
        <Divider />
        <Row
          label={L("Microphone", "Micro")}
          sub={mic === "denied" ? L("Turned off for Pyrius. Allow it in your phone's settings to talk or dictate.", "Désactivé pour Pyrius. Autorisez-le dans les réglages du téléphone.") : undefined}
          value={permText(mic)}
          onPress={mic === "denied" ? () => Linking.openSettings() : undefined}
        />
        {!voice.textOnly && voice.enabled ? (
          <>
            <Divider />
            <View style={{ padding: 16 }}>
              <VoiceOptions />
            </View>
          </>
        ) : null}
      </Section>

      <Section title={L("NOTIFICATIONS", "NOTIFICATIONS")} footer={L("Email delivery isn't connected yet, so no emails are sent. Your choices are saved and will apply once it is.", "L'envoi de courriels n'est pas encore connecté. Vos choix sont enregistrés et s'appliqueront dès qu'il le sera.")}>
        <Row
          label={L("Phone notifications", "Notifications du téléphone")}
          value={permText(alerts)}
          onPress={
            alerts === "denied"
              ? () => Linking.openSettings()
              : alerts === "undetermined"
                ? () => requestNotificationPermission(L("Price alerts", "Alertes de prix")).then(setAlerts, () => {})
                : undefined
          }
        />
        {(
          [
            ["email", L("Email notifications", "Notifications par courriel")],
            ["priceAlerts", L("Price alerts", "Alertes de prix")],
            ["savedSearches", L("Saved-search updates", "Recherches enregistrées")],
            ["productNews", L("Product news", "Nouveautés")],
          ] as const
        ).map(([k, label]) => (
          <View key={k}>
            <Divider />
            <Row label={label} right={<Toggle value={n[k]} label={label} onChange={(v) => updateSettings({ notifications: { ...n, [k]: v } })} />} />
          </View>
        ))}
      </Section>

      <Section title={L("ACCOUNT", "COMPTE")}>
        <Row
          label={L("Sign out", "Se déconnecter")}
          icon={<LogOut color={colors.error} size={18} />}
          onPress={() =>
            confirmDialog({
              title: L("Sign out of Pyrius?", "Se déconnecter de Pyrius ?"),
              message: L("Your trips and conversations stay in your account.", "Vos voyages et conversations restent dans votre compte."),
              cancel: L("Cancel", "Annuler"),
              confirm: L("Sign out", "Se déconnecter"),
              destructive: true,
              // Signed out: the layout's guards close the app screens and open the welcome screen.
              onConfirm: () => signOut(),
            })
          }
          right={<View />}
        />
      </Section>

      <AirportPicker
        open={airport}
        onClose={() => setAirport(false)}
        title={L("Home airport", "Aéroport de départ")}
        homeCode={settings.homeAirport}
        onPick={(a) => {
          setAirport(false);
          updateSettings({ homeAirport: a.code });
        }}
      />
    </Page>
  );
}

const s = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 4 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  block: { gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  input: { ...noOutline, flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 16, textAlign: "right", paddingVertical: 4 },
  segments: { flexDirection: "row", padding: 4, borderRadius: radii.pill, backgroundColor: colors.surface },
  segment: { flex: 1, height: 38, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segmentOn: { backgroundColor: colors.surface3 },
  step: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  badge: { height: 24, paddingHorizontal: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  themeCard: { flex: 1, gap: 10, padding: 8, paddingBottom: 12, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.border, alignItems: "center" },
  preview: { alignSelf: "stretch", height: 78, borderRadius: radii.md, overflow: "hidden", alignItems: "center", justifyContent: "center", gap: 6 },
  previewOrb: { width: 20, height: 20, borderRadius: 10 },
  previewLine: { height: 5, borderRadius: 3 },
  orbStage: { height: 190, alignItems: "center", justifyContent: "center" },
  orbCtrl: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  orbArrow: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  orbDots: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 16 },
  orbDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  planIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  manage: { height: 46, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  plan: { padding: 16, gap: 12 },
  choose: { height: 48, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
