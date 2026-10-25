# Video consultations

Patient Mobile, Dentist Mobile and Dentist Web use LiveKit for video, audio and screen sharing. The API owns appointment eligibility, room creation, short-lived access tokens and room cleanup. Setup is documented in [LIVEKIT_SETUP.md](LIVEKIT_SETUP.md).

## Backend ownership and lifecycle

Joining is allowed only for the assigned patient or treating verified dentist, from an active login, for an active paid video appointment. The joining window remains ten minutes before the scheduled start until two hours after it. In-clinic visits do not create video rooms. The deferred three-day appointment requirement is unchanged.

An appointment row lock serializes joins. One active schedule owns one opaque LiveKit room; the API explicitly creates it with two participant slots. Each join rotates that role's opaque participant identity and removes its previous identity. Tokens grant room join, publication and subscription, with a 60-second initial lifetime and no administration, recording or data-publication grant. Patient names, database IDs and clinical details are not sent as LiveKit identity or metadata. Only the role is included as metadata.

Credentials are returned through the authenticated HTTP adapter with `Cache-Control: no-store`; they remain outside Redux request caches, logs, persistent app state and the database. Login refresh does not replace a joined call. LiveKit handles its own reconnect-token refresh for established media sessions. Cloud token revocation is requested when an older identity is removed. A self-hosted server does not offer equivalent revocation; short initial tokens and verified provider joins limit stale access.

`POST /video/webhook` accepts only JWT/checksum-verified LiveKit events. `participant_joined` checks the saved room ID, identity, current login, account status, payment, schedule and expiry before marking a patient waiting. Unknown identities are removed. Screen-share tracks belong to the same participant and do not create another arrival. `room_finished` closes only the matching room instance, so a delayed event cannot close a replacement room.

The cleanup worker checks every ten seconds and closes rooms after cancellation, completion, rescheduling, account/session invalidation, payment loss, provider disablement or expiry. Failed provider shutdowns remain queued for retry. Historical migrations are preserved; the current schema uses provider-neutral room and participant columns.

## Client ownership

`packages/dentra-call-core/src/useVideoRoom.ts` owns the shared LiveKit connection lifecycle. Publication/subscription, mute, participant and reconnection events update media state without recreating the room. Permission/publication failures leave a connected call available for audio-only use. Cleanup releases tracks even if a permission prompt or connection resolves after logout/unmount.

The web connection and remote audio stay above the router. Its visual stage moves between the consultation page and the floating call window through a portal; changing pages does not recreate the connection. Chat state also stays above the movable portal.

Both native apps use `packages/dentra-video`: the official LiveKit React Native SDK, WebRTC renderer, screen-capture picker and shared native chat UI. The full-screen stage, self-preview, four-second control hiding, tap-to-show, accessibility behavior, Back minimization and draggable in-app window remain. Android retains its foreground call service and system PiP integration. iOS uses the SDK's video-call PiP renderer, with React camera-off/waiting placeholders kept outside that renderer.

The iOS ReplayKit extensions use the frame transport recommended by LiveKit's React Native SDK. Extension code is independent of React Native and contains no credentials. Host and extension must be signed for the same App Group. See [screen sharing and consultation chat](CALL_COLLABORATION.md).

## Verification and remaining rollout

Tests use synthetic provider responses and native/UI mocks; they create no cloud meetings. API integration tests use an isolated disposable schema. Checks cover ownership, joining windows, identity rotation, signed raw webhooks, cached-token room recreation, cleanup retry, private chat/files, call continuity, video mute/subscription changes and screen-share rendering.

Verification passed on **25 October 2026**:

| Check | Result |
| --- | --- |
| API integration tests, disposable schema | 24 suites, 222 tests passed |
| Video provider and client-URL unit tests | 7 tests passed |
| Dentist Mobile tests | 33 suites, 272 tests passed |
| Patient Mobile tests | 24 suites, 107 tests passed |
| Dentist Web tests | 9 files, 42 tests passed |
| API/mobile TypeScript and both web production builds | Passed |
| Dentist and Patient Android Debug, ARM64 | Passed |
| Dentist and Patient iOS Debug, ARM64 Simulator, unsigned | Passed, including ReplayKit extensions |
| Android/iOS production JavaScript bundles, both apps | Passed |

Both APKs contain the LiveKit WebRTC native engine and no Chime engine. Both iOS app bundles include the compiled broadcast extension and contain no stale Amazon Chime frameworks. Native builds used `:app:assembleDebug -PreactNativeArchitectures=arm64-v8a` and generic iOS Simulator destinations with signing disabled, `RCT_NO_LAUNCH_PACKAGER=1` and `SKIP_BUNDLING=1`. Separate Metro build commands verified dependency resolution without a running development server. The API regression run used a 20-second test timeout while compilation was active. A payment-test fixture was isolated from earlier orders after the full regression run exposed it consuming another test's mocked response; payment implementation was unchanged.

The restore-LiveKit migration has been applied to the local database. Existing local LiveKit environment values were retained; active Chime configuration was removed. No cloud meeting was created and no app was installed or launched.

Live media transport, physical-device camera and background/PiP behavior still require a configured LiveKit project and installed rebuilt apps. An unsigned Simulator compilation does not verify device signing or App Group provisioning. No project server or app is launched by the migration's compilation checks.

References: [React Native SDK](https://github.com/livekit/client-sdk-react-native), [browser SDK](https://github.com/livekit/client-sdk-js), [token lifecycle](https://docs.livekit.io/frontends/reference/tokens-grants/), [webhooks](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/).
