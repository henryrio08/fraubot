# fraubot / LEUTE!

An unserious German translator with one big listen button, live captions, and four reply modes. Built with React, TypeScript, Vinext, and Cloudflare Workers. Uses Meta Model API credits from [dev.meta.ai](https://dev.meta.ai/).

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
- Room chat with nicknames, copyable room codes, automatic message updates, unread badges, and refresh recovery.

### Messaging

Click **Chat**, pick a nickname, then **Make a room** or enter a friend's code. A room supports up to 20 signed-in users and expires 24 hours after creation. Chat polls every two seconds while open, every five seconds while closed, and reconnects after interrupted requests. The latest 100 messages are shown. Enter sends; Shift+Enter starts a new line.

Chat uses the site's existing ChatGPT sign-in. Friends must have permission to open the Site before joining a room; a room code does not change Site sharing. Membership is checked on every read and write. Leaving revokes access until the user joins again. Messages and nicknames are stored in D1, independently of Meta, with a 1,000-character message limit, a durable 30-message-per-minute member limit, and a 1,000-message room limit. Retries use a stable message ID to avoid duplicates. Expired rooms are inaccessible immediately and are deleted with their messages during bounded cleanup when someone creates or joins a room.

The database schema and generated migrations are in `db/schema.ts` and `drizzle/`. Sites provisions the `DB` binding and applies migrations on publication. For a first local chat preview, build once and apply the migration to the local database before running `npm run dev`:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_outgoing_argent.sql
```

Apply each migration only once. Local sign-in uses the starter's loopback-only mock; production identity is supplied by Sites.

### Reply modes

| Mode | Intended response |
| --- | --- |
| Normal | Short, everyday A2/B1 German. |
| tryhard | Deliberately excessive C2 academic German, long real compound nouns, and complex clauses. |
| frau destroyer | Punchy dark situational humor with uncensored German swearing. |
| Gibberish | Invented German-sounding syllables with no literal meaning or fabricated English translation. |

The original speech is translated accurately in every mode. tryhard has a larger output budget for its longer reply, English meaning, and pronunciation.

**Voice extraction is not implemented.** Audio references are previewed locally; they are not uploaded or used to filter microphone audio. Integrating an actual target-speaker extraction service and evaluating it on German classroom audio is separate work.

## Meta configuration

| Server secret / variable | Purpose | Default |
| --- | --- | --- |
| `MODEL_API_KEY` | Meta Model API key | Required for live AI |
| `META_TEXT_MODEL` | Translation and reply model | `muse-ember-1.0` |
| `META_SPEECH_MODEL` | Streaming transcription model | `muse-voice-transcribe-1.0` |

The text endpoint uses `https://api.meta.ai/v1/responses`, structured JSON output, minimal reasoning, and `store: false`. Speech connects to `wss://api.meta.ai/v1/asr/realtime` in ENDPOINTING mode or optional DIARIZATION mode. The server injects the API credential in the speech handshake; the browser never receives it.

For hosted use, add these values as **Sites runtime secrets**, then redeploy. Local `.dev.vars` does not automatically configure production. The tracked `.openai/hosting.json` retains the Site identity. New Sites are owner-private; changing sharing is a separate access decision.

## Audio and privacy

Use classroom listening and voice references with the speakers' knowledge and permission. The app retains no recordings or transcript database. Notes, reference URLs, and replies live in this tab's memory and disappear on reload; exported notes are downloaded only when requested. Chat messages are stored separately in D1 and are never automatically filled with microphone transcripts. Microphone tests and reference preview stay local. Live speech audio goes to Meta (or the browser speech service if selected), and transcripts go to Meta for translation and replies. Provider retention policies still apply; `store: false` does not imply zero provider retention.

The browser requests microphone permission, runs its visible microphone indicator, and releases tracks on stop, failure, and unmount. Streams have a 20-minute server limit. Background-noise processing cannot guarantee clear speech at ten feet or remove overlapping speakers.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Tests cover input limits, untrusted transcript handling, streamed SSE parsing across chunk boundaries, fixed provider destinations, secret redaction, cross-origin rejection, binary WebSocket frame normalization, and PCM conversion at multiple input sample rates. Chat tests execute the actual generated migration and API queries against SQLite, including two-user delivery, room isolation, leave/rejoin, expiry cleanup, retry deduplication, pagination, capacity, and durable send limits. Live provider quality and latency require a funded Meta key and representative microphone audio.

Hosted access is enforced by Sites. Additional per-isolate rate limiting is best-effort protection, not a durable account spending cap. Configure spending limits in the Meta dashboard before broader sharing. No credentials or voice recordings are tracked in Git.
