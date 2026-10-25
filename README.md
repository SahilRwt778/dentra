# Dentra

One workspace for the Dentra backend, web portals and React Native applications.

| Folder | Application |
| --- | --- |
| `dentra-api` | NestJS API, PostgreSQL schema, migrations and OpenAPI contract |
| `dentra-web-admin` | Admin web portal |
| `dentra-web-dentist` | Dentist web portal |
| `dentra-mobile-patient` | Patient mobile app |
| `dentraDentist` | Dentist mobile app, with Axios API adapters and Redux |
| `packages/dentra-call-core` | Shared chat history and LiveKit room lifecycle |
| `packages/dentra-video` | Native LiveKit rendering, screen capture and chat UI |
| `index.html` | UI prototype |

Keep this folder layout when cloning or building: the apps depend on the shared packages through local `file:` dependencies. Each application owns its package manifest and lockfile; run `npm ci --legacy-peer-deps` from each application folder. Use Node.js 22.23.2 or a compatible supported Node 22 version. Run CocoaPods installation from each mobile app's `ios/` folder after installing JavaScript dependencies.

Copy the relevant `.env.example` to a local `.env`, fill in your environment's values and apply API migrations with `npm run migrate -- up` from `dentra-api`. Firebase configuration and server credentials are supplied separately. Follow each application README for its development commands; the projects are started independently.

Video consultations use LiveKit. See [LIVEKIT_SETUP.md](LIVEKIT_SETUP.md), [video architecture and verification](VIDEO_CONSULTATIONS.md), and [screen sharing and private chat](CALL_COLLABORATION.md).

To publish this workspace, follow [GITHUB_SETUP.md](GITHUB_SETUP.md). It includes the one-time steps for preserving the existing mobile Git histories before creating a repository at this root.
