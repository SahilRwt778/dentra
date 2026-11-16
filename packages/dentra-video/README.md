# Dentra native video

A small React Native adapter over the official LiveKit SDKs. `VideoRoom` uses the shared `useVideoRoom` lifecycle, `useMeeting` exposes media state and controls, and `VideoView` renders a camera or screen track with optional iOS PiP. Initialize once through `initializeVideo` at application startup.

`CallChat` and `pickChatFile` provide the shared native consultation chat and attachment preview/picker UI. API authentication, file download/cache and PDF opening remain in the individual app adapters.

Both applications install this package through a local `file:` dependency. Native LiveKit setup belongs in each application's Android/iOS project. The ReplayKit extension sends frames over the WebRTC SDK's App Group socket; it does not receive meeting credentials. `scripts/configure-ios-sharing.rb` maintains the two extension targets and signing settings.

Both Metro configurations watch the sibling `packages` directory and map `@dentra/video` and `@dentra/call-core` directly to their source folders. Keep this workspace layout when cloning. If Metro reports that `@dentra/video/src/CallChat` is missing even though the file exists, stop that app's Metro process in its terminal and restart it with `npm start -- --reset-cache`, then reload the app. A running Metro process must restart to load configuration changes. This does not require a native rebuild.

The broadcast transport files under `broadcast/` are adapted from the Jitsi sample recommended by LiveKit's React Native installation guide, at commit `18c35f7625b38233579ff34f761f4c126ba7e03a`. Their Apache 2.0 license and copyright notices are retained in that folder. Dentra supplies its App Group through Info.plist and limits pending host connections to thirty seconds.

See [LiveKit setup](../../LIVEKIT_SETUP.md) and [screen sharing/chat setup](../../CALL_COLLABORATION.md).
