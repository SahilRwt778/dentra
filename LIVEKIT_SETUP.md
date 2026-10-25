# LiveKit setup

Dentra uses LiveKit for video, audio and screen sharing. Private consultation messages and attachments remain in the Dentra API and database. No AWS Chime account, IAM role, event queue or AWS credentials are required by the video code.

## Configure a LiveKit project

1. Sign in to [LiveKit Cloud](https://cloud.livekit.io/) and create/select a project. The free Build plan can be used within its current monthly allowances; see [pricing](https://livekit.com/pricing).
2. In the project's settings, obtain the WebSocket project URL and generate an API key/secret. The URL looks like `wss://YOUR-PROJECT.livekit.cloud`.
3. Add the following values to the API's local, ignored `dentra-api/.env`, or to server environment variables when deploying:

```dotenv
VIDEO_ENABLED=true
LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud
LIVEKIT_API_KEY=your-project-api-key
LIVEKIT_API_SECRET=your-project-api-secret
```

The key and secret stay on the API server. No LiveKit secret is placed in either mobile app or either web portal. Clients request a short-lived room token through the existing authenticated video-token endpoint.

4. In LiveKit Cloud, open **Settings → Webhooks** and add `https://YOUR-API/video/webhook`. Select the same signing API key configured above. Use your real API route prefix if deployment adds one. LiveKit must be able to reach this URL; `localhost` on your computer is not reachable from LiveKit Cloud. For local webhook testing, use a reachable development API URL or a temporary HTTPS tunnel to your API.
5. Restart your API after changing its environment. Dentra verifies the webhook JWT and the exact raw-body checksum before accepting patient-arrival or room-finished events. Token generation alone does not mark a patient as arrived.

Dentra creates rooms with two participant slots and enables camera, microphone and screen publishing. Each join gets a new opaque participant identity and a 60-second initial token. An established connection can reconnect using LiveKit's token-refresh behavior. Old identities are removed when a device/session is replaced. LiveKit Cloud additionally supports token revocation; self-hosted servers rely on short initial token lifetime, verified join events and backend cleanup for stale joins.

## Existing local server or self-hosting

The previous local LiveKit URL/key/secret values are retained in this workspace's ignored API environment file. Run your own LiveKit server using your existing configuration before joining, or replace those values with your Cloud project's values. No LiveKit server is started by the migration.

`LIVEKIT_URL` is the endpoint the API uses for room administration. If clients need a different reachable address, set optional `LIVEKIT_PUBLIC_URL` to that WebSocket URL. For Android Emulator, a loopback public URL is returned as `10.0.2.2`; iOS Simulator and web keep loopback. Physical phones need a reachable LAN hostname/IP with an appropriate development setup, or a secure Cloud URL. Self-hosted LiveKit must deliver signed webhooks to `/video/webhook` using the API's configured signing key; retain the raw JSON body through any proxy.

## Install dependencies and apply migrations

Keep `packages/dentra-call-core` and `packages/dentra-video` alongside the applications. From each application folder, run `npm ci --legacy-peer-deps`. From `dentra-api`, run:

```sh
npm run migrate -- up
```

The additive `1792980000000_restore_livekit.sql` migration renames the provider-specific room columns and closes the earlier provider's local sessions. It preserves appointments, chat, attachments, clinical notes, payments and wallet data. It has been applied locally. Already-applied historical migrations are retained so existing databases can upgrade normally.

## Rebuild the mobile apps

A JavaScript reload cannot replace the installed native media SDK. From each mobile app's `ios/` folder, resolve dependencies with `pod install`, then rebuild/install through your usual React Native or Xcode workflow. Rebuild/install Android through your usual workflow too. The dentist app retains Metro port 8082; the patient app uses 8081. The development agent does not start these servers or launch the apps.

Android initializes LiveKit with communication audio. The existing camera/microphone foreground service and system PiP integration remain; LiveKit's WebRTC module handles the screen-capture foreground service after Android's capture consent.

iOS uses `@livekit/react-native` and `@livekit/react-native-webrtc`. Each app includes a `DentraScreenShare` ReplayKit extension. Enable/provision the host and extension's App Groups using your Apple team as described in [CALL_COLLABORATION.md](CALL_COLLABORATION.md#ios-signing-configuration). The screen-sharing extension sends captured frames over the SDK's App Group socket; it receives no meeting token or API secret. iOS Simulator cannot provide a real camera. Verify camera, microphone, Home/PiP and phone-wide sharing on physical phones.

## Manual check

Join a paid, eligible test appointment from both participants. Check speech, camera on/off, switching cameras, reconnection, minimizing/restoring and navigating while the call remains connected. Share a screen from each side, stop through the app and OS, and exchange text, a photo and a PDF. Confirm that cancellation/completion/logout closes the correct room, and that the dentist's queue shows arrival only after the patient's verified LiveKit join event.

References: [React Native SDK setup](https://github.com/livekit/client-sdk-react-native), [LiveKit webhooks](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/), [access-token lifecycle](https://docs.livekit.io/frontends/reference/tokens-grants/), [self-hosting](https://docs.livekit.io/intro/cloud/).
