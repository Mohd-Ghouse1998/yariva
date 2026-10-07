# Aroha mobile

Aroha is a meaningful-connection app for iOS and Android. This package contains
the React Native (Expo) mobile frontend that talks to the Aroha NestJS backend
in `aroha_backend/`.

## Stack

- **React Native + Expo SDK 51**
- **TypeScript (strict mode)**
- **Expo Router** for filesystem-based navigation
- **socket.io-client** for realtime (matches, messages, presence, typing, calls)
- **react-native-webrtc** for voice/video calling (requires a development build)
- **expo-secure-store** for tokens
- **expo-image-picker / expo-location** for photo upload + location capture

## Folder layout

```
frontend-mobile/
  app/                       Expo Router routes (thin shells that import features)
    (auth)/                  Welcome, signup, login
    (onboarding)/            Multi-step profile setup
    (app)/                   Main app stack (tabs, profile, match, conversation, settings, report)
      (tabs)/                Discover · Matches · Chat · Inbox · You
    (call)/                  Incoming + active call screens (full-screen modal)
    (modal)/                 Match-created celebration modal
  assets/                    App icon + brand assets (logo.png copied from aroha_logo_transparent.png)
  src/
    api/
      http.ts                Token-aware HTTP client with 401 refresh + request retry
      errors.ts              Typed ApiError class with backend error-code helpers
      upload.ts              Presigned-URL binary uploader for photos & message attachments
      endpoints/             One file per backend resource (auth, profiles, matches, …)
    auth/
      AuthContext.tsx        AuthProvider; signup/login/logout/refresh + current user state
      storage.ts             Secure token persistence (SecureStore on native, AsyncStorage on web)
      profileGate.ts         Maps profile-completion criteria to setup steps
    realtime/
      socket.ts              Reconnecting Socket.IO client for /ws namespace
      RealtimeProvider.tsx   React context with typed event subscriptions + heartbeat
    components/
      ui/                    Buttons, inputs, cards, chips, toggles, avatars, toasts, etc.
      layout/                Screen + Header
      profile/               Multi-step header with progress dots
      discovery/             ProfileCard
      chat/                  MessageBubble
    features/
      auth/                  Splash, Welcome, Signup, Login
      onboarding/            OnboardingIntro
      profileSetup/          BasicInfo, Bio, Intent, Interests, Lifestyle, Schedule, DiscoveryPrefs, CommunicationPrefs, Photos, Review
      discovery/             Discover feed, ProfileDetail
      matches/               MatchesList, MatchDetail, MatchCreated
      chat/                  ConversationsList, Chat
      calls/                 CallManager (REST + signaling), Incoming, Active, webrtc.ts wrapper
      notifications/         Notifications inbox
      profile/               MyProfile, EditProfile
      settings/              Settings hub, Privacy, Communication, Sessions, BlockedUsers
      safety/                Report flow
      errors/                AccountRestricted, NetworkError, SessionExpired, Maintenance, PermissionDenied, UploadFailed
    theme/                   Colors, spacing, radius, typography, shadows
    types/                   Backend enums + DTO shapes (AuthResponseDto, MyProfileDto, MessageDto, …)
    utils/                   env loader, device fingerprint, formatting helpers
```

## Configuration

Environment variables are read via `expo-constants` and `process.env`. They must
be prefixed with `EXPO_PUBLIC_` to be exposed to the client bundle.

Copy `.env.example` to `.env` and fill in:

```
EXPO_PUBLIC_API_BASE_URL=https://api.aroha.app/api/v1
EXPO_PUBLIC_WS_URL=https://api.aroha.app
EXPO_PUBLIC_STUN_URLS=stun:stun.l.google.com:19302
EXPO_PUBLIC_TURN_URL=
EXPO_PUBLIC_TURN_USERNAME=
EXPO_PUBLIC_TURN_CREDENTIAL=
```

> The HTTP base URL **must** include the backend's `/api/v1` prefix.
> The WebSocket URL is the origin only — the client appends the `/ws`
> namespace path.

## Install & run

```bash
cd frontend-mobile
npm install        # or pnpm install / yarn
npx expo start     # opens Metro bundler

# Run on a specific platform
npm run ios        # requires Xcode + iOS simulator
npm run android    # requires Android Studio + emulator
```

### Voice / video calling (WebRTC)

`react-native-webrtc` is **not** bundled with Expo Go. To exercise the call
flows you must build a custom dev client:

```bash
npx expo prebuild
npx expo run:ios         # or run:android
# or
eas build --profile development --platform ios
```

Without a dev client, the call manager will detect the missing native module
and the `ActiveCallScreen` will display a clear notice instead of crashing.

## Backend contracts followed

REST (all under `/api/v1`):

- Auth: `POST /auth/{signup,login,refresh,logout}`
- Users: `GET /users/me`, `PUT /users/me/{intents,interests}`
- Profiles: `GET|PATCH /profiles/me`, `PUT /profiles/me/{lifestyle,schedule-preference,discovery-preference,communication-preference}`
- Profile photos: presigned upload → finalize → reorder / set primary / delete
- Discovery: `GET /discovery/feed` (cursor)
- Likes & passes: `POST/DELETE /likes`, `POST/DELETE /passes`
- Matches: `GET /matches`, `GET|DELETE /matches/:id`, `PUT /matches/:id/communication-settings/me`
- Conversations: `GET /conversations`, `GET /conversations/:id`, `GET /conversations/:id/messages`, `POST /conversations/:id/read`
- Messages: `POST /conversations/:id/messages`, presigned attachment upload → finalize, `PATCH/DELETE /messages/:id`
- Calls: `POST /calls`, `POST /calls/:id/{accept,decline,end}`
- Sessions + push tokens
- Notifications, blocks, reports, analytics

WebSocket (`/ws`):

- Handshake auth: `{ accessToken, sessionId, lastEventId? }`
- Client emits: `presence.heartbeat`, `conversation.typing.{start,stop}`, `call.ring.ack`, `call.{offer,answer,ice}`
- Server pushes: `system.{ready,error}`, `presence.updated`, `match.created`,
  `conversation.message.{created,updated,deleted}`, `conversation.read.updated`,
  `conversation.typing.updated`, `notification.created`,
  `call.{ringing,accepted,acceptedElsewhere,connected,missed,ended,offer,answer,ice}`

All backend enums (`UserStatus`, `ProfileGender`, `ConnectionIntent`,
`PhotoModerationStatus`, `MessageStatus`, `CallSessionStatus`, etc.) are
mirrored in `src/types/enums.ts` with exact casing.

## Profile completion gating

The onboarding flow inspects the backend's `ProfileCompletionStatusDto`
returned from `/users/me` and `/profiles/me`. The criterion list is mapped to
nine setup steps:

1. Basic info (name + DOB + 18+ + city + region + country + coordinates + geohash)
2. Bio (20–1000 characters)
3. Intent (at least one connection intent)
4. Interests
5. Lifestyle
6. Schedule
7. Discovery preferences
8. Communication preferences
9. Photos (at least one approved photo, with an approved primary)

If the user opens the app while their account isn't `ACTIVE`, they're routed
to `AccountRestrictedScreen` with the appropriate copy for `RESTRICTED`,
`SUSPENDED`, `BANNED`, or `DELETED`.

## Test data & visual smoke testing

There are two ways to populate the app with realistic data so you can click
through every screen.

### 1. Backend demo seed (recommended)

A second Prisma seed creates a primary demo user plus four matched profiles,
three conversations with realistic message threads, a no-message match, and
a few notifications. It's idempotent — re-running just refreshes timestamps.

```bash
cd ../aroha_backend
npm run prisma:migrate:deploy   # if not already migrated
npm run prisma:seed             # interests + feature flags
npm run prisma:seed:demo        # demo users, matches, conversations, messages, notifications
npm run start:dev
```

Demo accounts (all use the same password `Password123!`):

| Email             | Display name | Notes                                            |
|-------------------|--------------|--------------------------------------------------|
| chinmoy@aroha.dev | Chinmoy      | Primary account — sign in as this user           |
| asha@aroha.dev    | Asha         | Active conversation, 1 unread message            |
| rohan@aroha.dev   | Rohan        | Active conversation, no unread                   |
| meera@aroha.dev   | Meera        | Just-matched, 1 incoming "Hi" message            |
| kabir@aroha.dev   | Kabir        | Match exists but no conversation yet             |

Photos are seeded with synthetic objectKeys so they reference your
configured object-storage endpoint. Frontend Avatar / ProfileCard fall back
to initials when an image fails to load, so screens still populate sensibly.

### 2. Frontend fixtures mode (no backend required)

The HTTP client can short-circuit every request to typed demo fixtures. Mutable
chat state is stored under a development-only AsyncStorage key, so sent text,
attachments, previews and read state survive a browser refresh.
This is the fastest way to click through screens without standing up the
backend.

```bash
cd frontend-mobile
echo "EXPO_PUBLIC_USE_FIXTURES=1" >> .env
npx expo start
```

Fixture mode is intentionally disabled by production builds even if the flag is
accidentally present. Production releases must provide the real REST and
WebSocket URLs through the build environment; they are intentionally not
embedded in `app.json`, and a production build fails clearly when either is
missing. To clear locally persisted demo chat state during development or
tests, call the exported `resetFixtureDemoState()` utility from
`src/dev/fixtureRouter.ts` and then reload the app.

Fixtures cover every read endpoint and ack mutating endpoints, so the
following screens render with data:

- Splash routes to authenticated home (any login submission succeeds).
- Discover feed (4 candidate profiles).
- Profile detail page.
- Matches list (4 matches: 1 unread, 1 just-matched, 1 with history, 1 no-message).
- Conversations list (3 conversations).
- Chat screen for each conversation (full message history; the Asha thread
  shows received + sent messages).
- Notifications inbox (NEW_MATCH, NEW_MESSAGE, MISSED_CALL).
- My profile + Edit profile + Settings + Privacy + Communication +
  Sessions (2 devices) + Blocked users (empty) + Report flow.

Fixtures don't simulate Socket.IO events — typing indicators and live
inbound messages won't fire. Otherwise every screen is exercisable.

## Quality / scripts

```bash
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # eslint
npm test             # focused Vitest coverage for chat/navigation/fixtures
npm run format       # prettier
```

## Known limitations / gaps

- The discovery feed doesn't expose a per-user `GET /profiles/:userId` endpoint,
  so `ProfileDetailScreen` finds the profile by paging through the cached
  discovery feed. When the backend gains a public profile endpoint we should
  switch to that.
- Photo presigned upload is performed via an `XMLHttpRequest` PUT of the file
  blob. If the backend expects multipart/form-data uploads we'll need to adapt
  `src/api/upload.ts`.
- Push notifications are wired at the storage / type layer (`POST /push-tokens`
  is exposed via `sessionsApi.registerPushToken`), but Expo Notifications token
  registration is not auto-invoked on launch. Hook this up once Apple/FCM
  credentials are configured in EAS.
- `MatchesListScreen` increments unread count optimistically when a realtime
  message lands but doesn't mark the row read until the user opens the chat —
  that's intentional but we could subscribe to `conversation.read.updated` to
  clear unread when read elsewhere.
- WebRTC remote video rendering uses native `RTCView` from `react-native-webrtc`
  in production; the Active call screen currently displays connection state
  text only so the screen stays compatible with Expo Go. Drop in `<RTCView />`
  inside `ActiveCallScreen` once running on a dev build.
