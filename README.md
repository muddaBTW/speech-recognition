# Sarvam TeleHealth

Realtime telemedicine room with:

- ZegoCloud video consultation
- browser speech-to-text
- Sarvam translation
- multilingual prescription display

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Make sure the environment variables are available in `.env` / `.env.local`.

Required values:

```env
NEXT_PUBLIC_ZEGOCLOUD_APP_ID=
NEXT_PUBLIC_ZEGOCLOUD_SERVER_SECRET=
SARVAM_API_KEY=
```

3. Start the app:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## Important runtime note

Zego/WebRTC works only on:

- `http://localhost`
- or `https://...`

If you open the app on a raw LAN URL like `http://192.168.x.x:3000`, WebRTC may fail with:

- `webrtc requires https or localhost`

For another person to test the project, ask them to run it on their own machine with `localhost`, or deploy it over HTTPS.

## Production run

```bash
npm run build
npm run start -- --port 3000
```

## Known behavior

- The invite-link button now falls back if the Clipboard API is unavailable.
- Doctor and patient both have language selectors.
- Incoming voice notes auto-translate to the currently selected viewer language.
