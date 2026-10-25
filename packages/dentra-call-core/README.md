# Shared call logic

`useVideoRoom` owns one LiveKit room above navigation, observes media/presence events and releases tracks on teardown or late permission/connect completion. SDK objects and credentials stay in memory. Native rendering and capture controls live in `@dentra/video`; the dentist web app renders browser media directly.

`useCallChat` owns durable consultation history, pagination, polling, unread state and message retry state. Receiving uses its own cursor, so a local send cannot skip a remote message committed just before its response. Platform adapters retain their existing authenticated HTTP and private-file storage behavior.

Every consumer supplies React and `livekit-client` as peers. Metro watches the shared packages; Vite deduplicates these dependencies against the consuming application.
