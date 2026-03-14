# Sarvam TeleHealth

Realtime telemedicine room with:

- ZegoCloud video consultation
- browser speech-to-text
- Sarvam translation
- multilingual prescription display

## Quick Start

This project is pre-configured for a hackathon demo. API keys are already included in `.env`, so you can just run it.


1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Run the development server**:

   ```bash
   npm run dev
   ```

3. **Open the app**:
   Go to [http://localhost:3000](http://localhost:3000)

4. **Start the app**:

   ```bash
   npm run dev
   ```

5. **Open the app**:
   Go to [http://localhost:3000](http://localhost:3000)

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
