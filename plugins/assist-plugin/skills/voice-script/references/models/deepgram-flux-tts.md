# Deepgram Flux TTS

Verified: 2026-10-12. Id: `deepgram/flux-tts`. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none; `instructions` is ignored [OR1]. Flux has a native `expressivity` query parameter (integer -2 to 2, beta), but OpenRouter exposes it nowhere and pass-through is unconfirmed [DG2, OR9].
- Inline tags: none. Flux kept `[whispering]` silent on OpenRouter but did not whisper [OR10, OR11].
- Express delivery through voice choice, wording, and punctuation only. State the delivery in plain words in the header for the user.
- Never write direction lines or bracketed cues into the text.
- Header "Model settings": `voice`, `response_format`.

## Tags

None.

| Markup | Effect | Use | Source |
|---|---|---|---|
| `\{pause:1s\}` (simple form, backslashes required; value in milliseconds with or without `ms`, or in seconds with `s`) or `{pause:{duration_ms:500}}` (structured form, no backslashes) | Batch requests only. Silence of 500 to 3000 ms in 100 ms steps, at most 8 per request | only when the user asks (whether OpenRouter calls Flux in batch mode is unconfirmed) | DG1 |
| `\{"word": "...", "pronounce": "<IPA>"\}` (backslashes required) | Pronunciation override (Flux in Early Access) | only when the user asks | DG1 |

The backslashes belong to the Deepgram syntax; they are not MDX escapes. Checked on the rendered DG1 page and its Markdown source on 2026-10-12: the page shows the markers inside code spans, says for pronunciation "Curly braces must be escaped with backslashes (`\{` and `\}`)", and says for pauses "Write the structured form without backslashes; an escaped structured marker, or a simple marker without backslashes, is rejected with `BREAK_SYNTAX_INVALID`." In a JSON request body the backslash is itself escaped: DG1's curl example sends `\\{pause:1s\\}` inside the JSON string [DG1].

The simple marker accepts a duration in milliseconds or seconds. DG1: "Write the duration in milliseconds (`\{pause:500\}` or `\{pause:500ms\}`) or seconds (`\{pause:1.5s\}`). A number with no unit is read as milliseconds." The documented forms are therefore `\{pause:500\}` and `\{pause:500ms\}` (milliseconds) and `\{pause:1.5s\}` (seconds); DG1's own example uses `\{pause:1s\}`. The 500 to 3000 ms range and the 100 ms grid still apply [DG1].

Whether OpenRouter calls Flux in batch mode, and so whether pause markers work, is unconfirmed. Do not use pause markers unless the user asks, and then add the header note.

## Controls

Native `speed` (Flux 0.5 to 1.5) and `expressivity` (integer -2 to 2, beta) are query parameters [DG1, DG2]; OpenRouter exposes neither and pass-through is unconfirmed [OR9]. `instructions` is ignored [OR1].

## Voices

36 English voices [OR5]: `flux-alexis-en`, `flux-bree-en`, `flux-brittany-en`, `flux-brooke-en`, `flux-bruce-en`, `flux-cliff-en`, `flux-cole-en`, `flux-colin-en`, `flux-conor-en`, `flux-donovan-en`, `flux-drew-en`, `flux-elise-en`, `flux-gemma-en`, `flux-haley-en`, `flux-hannah-en`, `flux-heather-en`, `flux-jack-en`, `flux-kai-en`, `flux-kelsey-en`, `flux-kit-en`, `flux-maeve-en`, `flux-marcelo-en`, `flux-marcus-en`, `flux-meena-en`, `flux-meghan-en`, `flux-miles-en`, `flux-naveen-en`, `flux-paige-en`, `flux-priya-en`, `flux-rufus-en`, `flux-sean-en`, `flux-sharon-en`, `flux-sienna-en`, `flux-tanner-en`, `flux-wade-en`, `flux-wes-en`.

Voice menu: first three listed.

## Limits

Unconfirmed (the DG1 Limits table points to the Flux TTS batch page, which gives no figure) [DG1].

## Pauses and punctuation

No confirmed pause markup. Use ordinary punctuation.

## Unconfirmed

- The per-request limit.
- Whether OpenRouter calls Flux in batch mode (pause markers).
- OpenRouter pass-through of `speed` and `expressivity`.

## Sources

- [DG1] Deepgram, Speed, Pause, Pronunciation: https://developers.deepgram.com/docs/tts-voice-controls.md (retrieved 2026-10-12)
- [DG2] Deepgram, Expressivity: https://developers.deepgram.com/docs/tts-expressivity.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR9] OpenRouter per-model API guides: https://openrouter.ai/{model-id}/llms.txt, for example https://openrouter.ai/elevenlabs/eleven-v4/llms.txt (retrieved 2026-10-12)
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
