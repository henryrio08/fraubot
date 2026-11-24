# fraubot / LEUTE!

A German translator with one big listen button, live captions, and four reply modes. Built with React, TypeScript, Vinext, and Cloudflare Workers. Uses Meta Model API credits from [dev.meta.ai](https://dev.meta.ai/).

## Run locally

Requires Node 22.13 or newer.

```sh
npm run install:ci
cp .dev.vars.example .dev.vars
npm run dev
```

Add your Meta dashboard key to `MODEL_API_KEY` in `.dev.vars`. The file is ignored by Git. Restart the dev server after changing secrets. No key belongs in chat, a browser bundle, a URL, or GitHub.

The example session works immediately without any credentials. It is prewritten and clearly labeled. Live AI features show a connection message until the key is configured. Chrome's optional speech engine can provide transcripts without a Meta key, subject to browser and school policies; AI translation and replies still need Meta.

## Features

- Meta Muse Voice Transcribe, streaming mono PCM16 over a server-proxied WebSocket.
- German and English language hints, cumulative live captions, automatic utterance boundaries.
- Optional session-scoped speaker labels. These do not identify a person or isolate a voice.
- Accurate English translation plus Normal, tryhard, frau destroyer, and Gibberish reply modes.
- Streaming replies with visible syllable-by-syllable pronunciation, bold stressed syllables, English meaning, and copy.
- Slow German audio with stop controls, plus a compact sound key. Written pronunciation is approximate; examples and sound-key notes reference [Goethe-Institut pronunciation materials](https://www.goethe.de/resources/files/pdf354/gi_lauter_bitte-v2.pdf).
- Typed input, scripted examples, in-tab session notes, bookmarks, and text export.
- Local microphone level test and local audio-reference preview.
- Responsive desktop/mobile layout and reduced-motion support.
- LEUTE sound button using a bundled, level-normalized German voice clip at full playback volume. Repeated clicks restart it; microphone capture stops before playback.
- One shared public class chat with nicknames, automatic updates, unread badges, and refresh recovery.

### Messaging

Click **Chat** to see the shared class channel. No room codes or room selection are needed. Anyone who can open the site can read the latest 100 messages from the last 24 hours. Sign in with ChatGPT and choose a nickname to post. Enter sends; Shift+Enter starts a new line. Chat polls every two seconds while open and every five seconds while closed, with a slower interval when the page is hidden.

Chat messages and nicknames are stored in D1, independently of Meta. Posting is limited to 1,000 characters per message, 30 messages per person per minute, and 120 messages across the channel per minute. Stable message IDs prevent duplicate sends after retries. Messages older than 24 hours are excluded immediately and removed during bounded cleanup on new posts.

The public channel has separate tables from the original private-room feature. Existing private-room messages are never included in public chat. The legacy room endpoints remain protected for compatibility.

**Direct messages:** Open **Chat → DMs**, choose a nickname from the people list, or click an author's nickname in class chat. DMs require sign-in and use the same nickname as class chat. The inbox shows recent conversations and unread counts, which survive reloads. Incoming messages are marked read when their conversation is open and visible. Only the authenticated sender and recipient can retrieve a conversation; DMs and inbox previews are never included in public class-chat responses. Like class chat, the latest 100 messages from the last 24 hours are shown. DMs are stored in D1 and do not go to Meta. Sending is limited to 1,000 characters per message, 30 messages per person per minute across recipients, and 120 DM sends across the site per minute. Retried sends are deduplicated within each pair.

The database schema and generated migrations are in `db/schema.ts` and `drizzle/`. Sites provisions the `DB` binding and applies migrations on publication. For a first local chat preview, build once and apply the migration to the local database before running `npm run dev`:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_outgoing_argent.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_fair_blacklash.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_futuristic_rocket_racer.sql
```

Apply each migration only once. Local sign-in uses the starter's loopback-only mock; production identity is supplied by Sites.

### Reply modes

| Mode | Intended response |
| --- | --- |
| Normal | Short, everyday A2/B1 German. |
| tryhard | Deliberately excessive C2 academic German, long real compound nouns, and complex clauses. |
| frau destroyer | Short, blunt comebacks tied to the actual question; deadpan confidence, literal misreadings, and situational roasts. German swearing when it fits. |
| Gibberish | Invented German-sounding syllables with no literal meaning or fabricated English translation. |

The original speech is translated accurately in every mode. tryhard has a larger output budget for its longer reply, English meaning, and pronunciation.

The frau destroyer prompt uses original calibration examples and aims for roughly 5–18 words. Profanity is allowed without making it mandatory. It removes the earlier funeral/printer stock jokes and asks the model to end on the punchline. The tone was informed by reviewing [public Reel comments](https://www.instagram.com/reel/Dez3kNoPbQe/) and [public TikTok comment screenshots](https://www.boredpanda.com/hilarious-funny-tiktok-replies/). These references inform timing and comic mechanisms; the app does not browse social media or copy comments when generating replies. Humor quality remains subjective; live checks verify the model follows the shorter style and still supplies accurate translation, English meaning, and pronunciation.

**Voice extraction is not implemented.** Audio references are previewed locally; they are not uploaded or used to filter microphone audio. Integrating an actual target-speaker extraction service and evaluating it on German classroom audio is separate work.

## Meta configuration

| Server secret / variable | Purpose | Default |
| --- | --- | --- |
| `MODEL_API_KEY` | Meta Model API key | Required for live AI |
| `META_TEXT_MODEL` | Translation and reply model | `muse-ember-1.0` |
| `META_SPEECH_MODEL` | Streaming transcription model | `muse-voice-transcribe-1.0` |

The text endpoint uses `https://api.meta.ai/v1/responses`, structured JSON output, minimal reasoning, and `store: false`. Speech connects to `wss://api.meta.ai/v1/asr/realtime` in ENDPOINTING mode or optional DIARIZATION mode. The server injects the API credential in the speech handshake; the browser never receives it.

For hosted use, add these values as **Sites runtime secrets**, then redeploy. Local `.dev.vars` does not automatically configure production. The tracked `.openai/hosting.json` retains the Site identity. Public access is managed through Sites sharing. Page access is independent from sign-in for posting or paid AI use.

## Audio and privacy

Use classroom listening and voice references with the speakers' knowledge and permission. The app retains no recordings or transcript database. Notes, reference URLs, and replies live in this tab's memory and disappear on reload; exported notes are downloaded only when requested. Chat messages are stored separately in D1 and are never automatically filled with microphone transcripts. Microphone tests and reference preview stay local. Live speech audio goes to Meta (or the browser speech service if selected), and transcripts go to Meta for translation and replies. Provider retention policies still apply; `store: false` does not imply zero provider retention.

The browser requests microphone permission, runs its visible microphone indicator, and releases tracks on stop, failure, and unmount. Meta streams have a 10-minute server limit. Background-noise processing cannot guarantee clear speech at ten feet or remove overlapping speakers.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Tests cover input limits, untrusted transcript handling, streamed SSE parsing across chunk boundaries, fixed provider destinations, secret redaction, cross-origin rejection, binary WebSocket frame normalization, and PCM conversion at multiple input sample rates. Chat tests execute the actual generated migration and API queries against SQLite, including two-user delivery, room isolation, leave/rejoin, expiry cleanup, retry deduplication, pagination, capacity, and durable send limits. DM tests cover participant-only reads, exclusion from public chat, persisted unread state, recipient-only read acknowledgements, pair-specific retries, and limits across recipients. Live provider quality and latency require a funded Meta key and representative microphone audio.

The website can be opened publicly. Live AI generation and Meta listening require a Sites-authenticated ChatGPT identity. D1-backed limits allow 60 reply attempts and 6 listening starts per person each day, with shared site limits of 500 reply attempts and 24 listening starts. Each Meta session is capped at 10 minutes, and a start reserves the entire session allowance even if it fails or ends early. Daily counters use America/Chicago dates. If quota storage is unavailable, paid requests fail closed. These are usage limits, not a dollar-denominated provider spending cap. The limits are defined in `lib/usage.mjs`. No credentials or voice recordings are tracked in Git.
