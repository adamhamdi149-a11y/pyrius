import { Redirect } from "expo-router";
import { startHref } from "~/lib/flow";
import { useStore } from "~/lib/store";

/** The app's entry: opens the screen for the current phase. The router also comes back here whenever the phase changes. */
export default function Index() {
  const { phase, pendingCode, auth } = useStore();
  return <Redirect href={startHref(phase, pendingCode, auth.mode === "local")} />;
}
