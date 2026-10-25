# Screen sharing and consultation chat

Patient Mobile, Dentist Mobile and Dentist Web support sharing a screen and exchanging private messages, photos and PDF files during a video consultation. The call stays connected while chat is open, while the app is minimized, and while the dentist navigates the web app.

## Screen sharing

- In a joined call, select **Share screen**. Browser users choose a screen, window or tab using the browser's picker. Android users approve the system capture prompt. iOS users choose **Start Broadcast** in ReplayKit's system sheet.
- Select **Stop sharing** to finish. Android also provides a foreground notification with a Stop sharing action; iOS provides its system broadcast controls.
- A received screen becomes the main video, fitted without cropping. Camera and microphone controls remain separate. Either participant can share; each client displays the other participant's content stream.
- Capture ends when the user stops sharing, the call ends, the session is replaced, or the consultation expires. Capture failures leave the audio/video call available.
- LiveKit screen tracks belong to the sharing participant. They do not consume an additional participant slot or replace that participant's camera track.

Android uses LiveKit WebRTC's `MediaProjection` capture and foreground service. iOS uses a ReplayKit Broadcast Upload Extension and the SDK's App Group frame socket. Desktop browsers use LiveKit's screen-share API and the browser's capture picker.

## Chat and attachments

Open **Chat** from the call controls. Both participants can send text, choose a photo, or attach a PDF. A selected photo has a compact preview and a red remove button before Send. Received attachments open through authenticated downloads; native photos open in a safe-area-aware viewer and PDFs use the device's document viewer.

- Text: up to 4,000 characters per message.
- Files: one JPEG, PNG or PDF per message, up to 10 MB.
- Consultation limits: 2,000 messages and 100 MB of attachments; each sender may send up to 30 messages per minute.
- Retry keys prevent duplicate messages when a response is lost. Changing a draft creates a new retry key.
- Latest history loads first, with an Earlier messages control. Incoming messages update through a two-second poll, with retry after network failure. Sending does not advance the receive cursor past unseen messages.
- Web chat state lives above its movable visual portal, so minimizing or changing pages preserves drafts and history.

Messages are associated with the appointment in PostgreSQL. Attachments use the existing private `PATIENT_FILES_DIRECTORY`; this directory must remain on persistent server storage. No public file URL is generated. Message content and file bytes use authenticated HTTP rather than LiveKit data messages or Redux request caches.

Only the appointment's patient and treating dentist can read the conversation or download its files. Sending additionally requires current video eligibility and the login session associated with that role's joined room. Replacing a role's device prevents its older device from sending. Cancellation, completion or expiry closes writing while preserving the private history endpoint. Existing booking, payment and consultation time rules remain in force.

## Backend deployment

Apply `dentra-api/migrations/1792893600000_video_collaboration.sql` with the normal migration command:

```sh
npm run migrate -- up
```

This additive migration has been applied locally. It creates the message table and indexes without modifying existing clinical or payment records. The OpenAPI contract includes list, send and private attachment download routes under `/appointments/{appointmentId}/video/chat`.

Configure LiveKit and its signed webhook as described in [LIVEKIT_SETUP.md](LIVEKIT_SETUP.md). Chat does not require a separate messaging provider.

## iOS signing configuration

Both Xcode projects include a `DentraScreenShare` extension. App Groups must be enabled and provisioned for the host app and its own extension on the same Apple development team. The prepared values are:

| App | Extension bundle ID | Shared App Group |
| --- | --- | --- |
| Patient | `com.dentra.patient.ScreenShare` | `group.com.dentra.patient.screenshare` |
| Dentist | `org.reactjs.native.example.dentraDentist.ScreenShare` | `group.org.reactjs.native.example.dentraDentist.screenshare` |

Use your organization's registered bundle identifiers before device distribution. In Xcode, update the host/extension bundle identifiers, the `DENTRA_SCREEN_SHARE_GROUP` project build setting, and the host Info.plist's `RTCScreenSharingExtension` value together. The host and extension entitlements and Info.plist reference that group setting. Keep patient and dentist App Groups separate. Existing patient APNs entitlements are preserved.

The repeatable project setup helper is `packages/dentra-video/scripts/configure-ios-sharing.rb`. It creates the extension target, source references and embedding phase. Extension embedding precedes Firebase's Info.plist script to avoid a build dependency cycle. Resolve CocoaPods dependencies after changing targets or native dependencies.

The host Info.plist uses `RTCAppGroupIdentifier` and `RTCScreenSharingExtension`, matching the WebRTC SDK. ReplayKit sends video frames to the host over its App Group socket. No meeting credentials or chat attachments are copied into the extension. Closing screen capture closes that connection and ends the broadcast.

## Verification and rollout

Automated tests cover private access, joined-device checks, file signatures/downloads, duplicate retries, sequence pagination, preserved drafts, screen-share controls, content tile rendering and call continuity. Native compilation checks include the app and broadcast extension. See [VIDEO_CONSULTATIONS.md](VIDEO_CONSULTATIONS.md) for the final build scope.

Actual media capture requires your LiveKit configuration, installed rebuilt apps and physical-device checks. In particular, an unsigned Simulator build does not verify App Group provisioning or ReplayKit broadcasting on a phone. Test both directions between dentist web/mobile and patient mobile, including consent cancellation, system Stop sharing, rotation, Home/PiP, leaving/rejoining and file transfer during a share. The development agent has not launched apps or project servers.

References: [LiveKit React Native screen sharing](https://github.com/livekit/client-sdk-react-native#screenshare), [LiveKit screen sharing](https://docs.livekit.io/transport/media/screenshare/), [Apple App Groups](https://developer.apple.com/documentation/xcode/configuring-app-groups).
