# EnglishAI

EnglishAI is a pronunciation coach built on the existing DATA FORGE interface. A learner chooses a target phrase, hears it at 0.7× and natural speed, records an attempt, receives content and delivery feedback, and retries against persisted before/after evidence.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Copy `.env.example` to `.env.local` and configure `RIME_API_KEY` for server-generated en-US coaching audio and `OPENAI_API_KEY` (or `STT_API_KEY`) for Whisper. Without those keys, the app deliberately falls back to browser speech recognition, browser speech synthesis, and local SQLite. Set `DATABASE_URL` to PostgreSQL for production persistence with pgvector.

## EnglishAI API

- `GET /api/english/health` — FastAPI, database, Whisper, and Rime readiness.
- `GET /api/english/catalog` — the 20-phrase validation and practice catalog.
- `POST /api/english/evaluate` — audio/Whisper transcription, evaluation, and persistence.
- `GET|DELETE /api/english/state` — attempts, recurring mistakes, and improvement evidence.
- `POST /api/english/tts` — server-side Rime audio at slow or normal speed.

The browser records audio with `MediaRecorder`. FastAPI sends it to Whisper when configured, evaluates the transcript and delivery timing, records recurring issues, then keeps the server-side Rime credential out of the browser. Every correction plays slowly first and naturally second. The original ORBIT endpoints remain available for compatibility.

Run `npm run test:english` for the provider-independent EnglishAI integration suite.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
