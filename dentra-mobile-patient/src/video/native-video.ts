type NativeVideo = typeof import('@dentra/video');
let sdk: NativeVideo | undefined;
export function nativeVideo(): NativeVideo | null {
  if (sdk) return sdk;
  try {
    const value = require('@dentra/video') as NativeVideo;
    if (!value.isAvailable()) return null;
    value.initializeVideo();
    sdk = value;
    return sdk;
  } catch {
    return null;
  }
}
