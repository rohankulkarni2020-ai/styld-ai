# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Styld.ai — India's AI Fashion Assistant mobile app built with Expo React Native.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Anthropic Claude (via Replit AI Integrations)
- **Mobile**: Expo React Native (Expo Router)

## App

**Styld.ai** — India's AI Fashion Assistant
- Describe your style and occasion
- Claude AI generates personalized outfit recommendations
- Products from Myntra and Amazon Fashion
- History of past outfit lookups

### Screens
- **Home**: Style prompt input with example prompts
- **Results**: Polling-based outfit display with product cards
- **History**: Past outfit generations

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── lib/outfitAI.ts     # Claude AI outfit generation
│   │       └── routes/outfit.ts    # Outfit API endpoints
│   └── mobile/             # Expo React Native app
│       └── app/
│           ├── (tabs)/
│           │   ├── index.tsx   # Home / search screen
│           │   └── history.tsx # History screen
│           └── results.tsx     # Results/polling screen
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   ├── db/                 # Drizzle ORM schema + DB connection
│   │   └── src/schema/outfitJobs.ts  # outfit_jobs table
│   └── integrations-anthropic-ai/    # Anthropic AI client
```

## API Endpoints

- `POST /api/outfit/start` — Start outfit generation job
- `GET /api/outfit/poll/:jobId` — Poll job status (includes `productsReady` + `imageReady` flags)
- `GET /api/outfit/:jobId/image/:idx` — Fetch outfit image (200 cached, 202 still generating)
- `GET /api/outfit/history` — Get completed outfit history

## Image Generation

- Phase 2b auto-starts after products are saved (fire-and-forget)
- `buildImagePrompt(outfit, userPrompt)` in `outfitAI.ts` — context-aware: location, occasion, season from user prompt shape the background; no hardcoded white background
- `sanitizeTargetProfile()` strips "teenage/teen/girl/boy" to avoid Azure content moderation flags
- `generateOutfitImage()` uses `gpt-image-1` via OpenAI image client

## Testing (Vitest)

**50 tests across 3 suites:**

- `src/__tests__/extractJson.unit.test.ts` — 12 unit tests for `extractFirstJsonObject` (edge cases: trailing text, nested objects, code fences, brace-in-strings, unclosed JSON)
- `src/__tests__/buildImagePrompt.unit.test.ts` — 12 unit tests for `buildImagePrompt` (context inclusion, sanitization, missing fields, editorial quality keywords)
- `src/__tests__/outfit.integration.test.ts` — 26 integration + load time tests hitting the live API (health, validation, full flow, product structure, load times, image endpoint)

**Load time assertions:**
- Phase 1 (outfit structure) < 8s ✓ (actual ~3s)
- `productsReady=true` < 20s ✓ (actual ~6s)
- Image endpoint response < 1s ✓

Run tests: `pnpm --filter @workspace/api-server run test`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Database

The `outfit_jobs` table stores all outfit generation jobs with status tracking (`analyzing`, `done`, `error`).

Production migrations: `pnpm --filter @workspace/db run push`

## AI Integration

Uses Replit AI Integrations for Anthropic Claude (`claude-sonnet-4-6`). No user API key needed — billed to Replit credits.

Env vars auto-provisioned: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
