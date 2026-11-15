import { isRunningInExpoGo } from "expo";
import { PermissionsAndroid, Platform } from "react-native";

export type PermissionStatus = "granted" | "denied" | "undetermined";

/**
 * Expo Go on Android doesn't include all of expo-notifications' native code (push was removed from it),
 * and importing the package there crashes the app on launch. So the package is only loaded, on first use,
 * where it works: development and store builds, and Expo Go on iPhone. In Expo Go on Android the app asks
 * for Android's own notification permission instead.
 */
const expoGoAndroid = Platform.OS === "android" && isRunningInExpoGo();

type NotificationsModule = typeof import("expo-notifications");
let mod: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (mod !== undefined) return mod;
  try {
    // Loaded here, not at the top of the file, so that nothing runs until it's needed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = expoGoAndroid ? null : (require("expo-notifications") as NotificationsModule);
  } catch {
    mod = null;
  }
  return mod;
}

/** Android 13 and later ask for notifications; earlier versions allow them by default. */
async function androidPermission(request: boolean): Promise<PermissionStatus> {
  if (Number(Platform.Version) < 33) return "granted";
  const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(perm)) return "granted";
  if (!request) return "undetermined";
  const res = await PermissionsAndroid.request(perm);
  return res === PermissionsAndroid.RESULTS.GRANTED ? "granted" : "denied";
}

export async function getNotificationPermission(): Promise<PermissionStatus> {
  const n = notifications();
  if (!n) return Platform.OS === "android" ? androidPermission(false) : "undetermined";
  return (await n.getPermissionsAsync()).status as PermissionStatus;
}

/** Asks to show price alerts. On Android this also creates the "Price alerts" channel the alerts arrive on. */
export async function requestNotificationPermission(channelName: string): Promise<PermissionStatus> {
  const n = notifications();
  if (!n) return Platform.OS === "android" ? androidPermission(true) : "undetermined";
  if (Platform.OS === "android") {
    await n.setNotificationChannelAsync("price-alerts", { name: channelName, importance: n.AndroidImportance.DEFAULT });
  }
  return (await n.requestPermissionsAsync()).status as PermissionStatus;
}
