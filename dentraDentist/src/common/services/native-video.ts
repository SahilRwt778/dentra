export type VideoSdk = typeof import('@dentra/video');
let sdk: VideoSdk | null = null;
export function getVideoSdk(): VideoSdk | null {
  if (sdk) return sdk;
  try {
    const livekit = require('@dentra/video') as VideoSdk;
    if (!livekit.isAvailable()) return null;
    livekit.initializeVideo();
    sdk = livekit;
    return sdk;
  } catch {
    return null;
  }
}
