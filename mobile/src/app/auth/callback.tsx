import { router, useGlobalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { toast } from "~/components/Toast";
import { completeFromUrl } from "~/lib/auth";
import { colors } from "~/lib/theme";

/** Landing route for the sign-in redirect, when the system opens the app from the link itself. */
export default function AuthCallback() {
  const params = useGlobalSearchParams<{ code?: string; error_description?: string }>();
  useEffect(() => {
    const q = new URLSearchParams();
    if (params.code) q.set("code", String(params.code));
    if (params.error_description) q.set("error_description", String(params.error_description));
    completeFromUrl(`pyrius://auth/callback?${q}`)
      .catch((e: Error) => toast({ tone: "error", title: e.message }))
      .finally(() => router.replace("/"));
  }, [params.code, params.error_description]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.text2} />
    </View>
  );
}
