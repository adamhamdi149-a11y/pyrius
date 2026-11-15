/** Web build: the browser's own WebRTC. Used by the web preview of the app. */

export function loadWebRTC() {
  if (typeof RTCPeerConnection === "undefined" || typeof navigator === "undefined" || !navigator.mediaDevices) return null;
  return { RTCPeerConnection: globalThis.RTCPeerConnection, mediaDevices: navigator.mediaDevices } as unknown as Pick<typeof import("react-native-webrtc"), "RTCPeerConnection" | "mediaDevices">;
}

export function speaker(_on: boolean) {}

let el: HTMLAudioElement | null = null;

/** Browsers need an audio element for the remote track. */
export function playRemote(stream: unknown) {
  el ??= document.createElement("audio");
  el.autoplay = true;
  el.srcObject = stream as MediaStream;
}

export function stopRemote() {
  if (el) el.srcObject = null;
}
