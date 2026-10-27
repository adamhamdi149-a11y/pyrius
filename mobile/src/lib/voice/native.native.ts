/**
 * Native pieces for live voice. They exist only in a Pyrius build (development or store build),
 * not in Expo Go, so each is loaded lazily and reported as missing instead of crashing.
 */

type WebRTC = typeof import("react-native-webrtc");

let cached: WebRTC | null | undefined;

export function loadWebRTC(): Pick<WebRTC, "RTCPeerConnection" | "mediaDevices"> | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("react-native-webrtc") as WebRTC;
    cached = m?.RTCPeerConnection && m.mediaDevices ? m : null;
  } catch {
    cached = null;
  }
  return cached;
}

type InCall = { start(o: { media: "audio" }): void; stop(): void; setForceSpeakerphoneOn(on: boolean): void; setKeepScreenOn(on: boolean): void };

/** Routes the call audio to the loudspeaker (WebRTC defaults to the earpiece on phones). */
export function speaker(on: boolean) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("react-native-incall-manager");
    const InCallManager = (m.default ?? m) as InCall;
    if (on) {
      InCallManager.start({ media: "audio" });
      InCallManager.setForceSpeakerphoneOn(true);
      InCallManager.setKeepScreenOn(true);
    } else {
      InCallManager.setKeepScreenOn(false);
      InCallManager.stop();
    }
  } catch {
    // Not in this build: the system routes the audio.
  }
}

/** Remote audio plays by itself on native once the track arrives. */
export function playRemote(_stream: unknown) {}
export function stopRemote() {}
