# Aura Video AI — Phase 5

## Production Video Studio & Commercial Video Pipeline

### Flow

```
Product → Analysis → Strategy → Script → Storyboard
  → Template (data-driven) → Brand Kit → Voice → Music
  → Captions → Multi-scene generation → FFmpeg compose
  → Studio render (captions + audio mix) → Storage → Asset
```

### Templates

`TemplateCatalogService` provides structured definitions for:

TikTok, Instagram Reels, YouTube Shorts, Feed, Facebook Ads, UGC, Showcase, Sale, etc.

Each definition includes scene order, type, duration, product/text positions, animation, CTA flags.

Not hard-coded in React.

### Brand Kit

Stored in `settings` as `brand_kit:{workspaceId}`.

Fields: brandName, logoUrl, colors, font, CTA style, default voice/music/aspect ratio.

API: `GET/PUT /api/v1/studio/brand-kit`

### Voice (TTS)

`ITextToSpeechProvider` + `OpenAITTSProvider` (`/audio/speech`).

Audio uploaded via Storage abstraction.

Requires `TTS_API_KEY` or shared AI key.

### Music

Catalog of style placeholders only. Real audio requires `storageKey` of user-uploaded licensed file.
Never claims third-party copyrighted tracks are available.

### Captions

- From script text (timed segments)
- From audio via Whisper transcription when configured

Burned into final video via FFmpeg `drawtext`.

### Studio render

`StudioRenderService`: compose scenes → burn captions → mix voice/music (with optional ducking).

### Project persistence

`studio_state:{projectId}` in settings — analysis, strategy, script, storyboard, template, voice, music, captions, scenes, jobs.

### API (`/api/v1/studio`)

| Method | Path |
|--------|------|
| GET/PUT | `/brand-kit` |
| GET | `/templates`, `/templates/:id` |
| POST | `/voice` |
| POST | `/captions/from-text`, `/captions/from-audio` |
| GET | `/music` |
| POST | `/music/validate` |
| GET/PUT | `/projects/:id/state` |

Video generation remains on `/api/v1/video/*` (Phase 4).

### Credits

Voice/transcription are paid operations at provider level; video credits still use Phase 4 ledger.
Estimate before video generate; TTS fails cleanly if unconfigured without charging video credits.

### Env

```
TTS_PROVIDER=openai
TTS_API_KEY=
TTS_BASE_URL=
TTS_MODEL=tts-1
TTS_DEFAULT_VOICE=alloy
```

### Security

Auth on all studio routes, workspace isolation for brand kit, project ownership for state, Zod validation, server-side keys only.
