# Fish Audio S2 Pro and S2.1 Pro

Verified: 2026-10-12. Ids: `fish-audio/s2-pro`, `fish-audio/s2.1-pro`, `fish-audio/s2.1-pro-free:free`. Fish describes S2.1 Pro Free as "The same model as S2.1-Pro" at $0 [FA2]; on OpenRouter the free id had zero endpoints on 2026-10-12 (tested) [OR7]. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none on OpenRouter; `instructions` is ignored [OR1].
- Express delivery with square-bracket cues from the table, plus punctuation and the pause tags. Emotion cues work best at the start of a sentence; tone and sound cues can go anywhere; use at most 3 combined emotions per sentence [FA1].
- Never write direction lines into the text.
- Header "Model settings": `voice` (id format unconfirmed) or a reference clip, `response_format`.

## Tags

"S2.1-Pro and S2-Pro treat `[bracket]` tags as standard text rather than dedicated control tokens." Any description works, for example `[whispers sweetly]` or `[laughing nervously]` [FA2]. Free-form cues are allowed here; keep them short, in square brackets, and prefer the listed ones. Use square brackets only. Parentheses are the older S1 syntax [FA2].

| Tag | Effect | Use | Source |
|---|---|---|---|
| `[happy]`, `[sad]`, `[angry]`, `[excited]`, `[calm]`, `[nervous]`, `[confident]`, `[surprised]`, `[satisfied]`, `[delighted]`, `[scared]`, `[worried]`, `[upset]`, `[frustrated]`, `[depressed]`, `[empathetic]`, `[embarrassed]`, `[disgusted]`, `[moved]`, `[proud]`, `[relaxed]`, `[grateful]`, `[curious]`, `[sarcastic]` | Basic emotions | yes | FA1 |
| `[disdainful]`, `[unhappy]`, `[anxious]`, `[hysterical]`, `[indifferent]`, `[uncertain]`, `[doubtful]`, `[confused]`, `[disappointed]`, `[regretful]`, `[guilty]`, `[ashamed]`, `[jealous]`, `[envious]`, `[hopeful]`, `[optimistic]`, `[pessimistic]`, `[nostalgic]`, `[lonely]`, `[bored]`, `[contemptuous]`, `[sympathetic]`, `[compassionate]`, `[determined]`, `[resigned]` | Advanced emotions | yes | FA1 |
| `[in a hurry tone]`, `[shouting]`, `[screaming]`, `[whispering]`, `[soft tone]` | Tone | yes | FA1 |
| `[emphasis]` | Stress the next word or phrase | yes | FA1 |
| `[laughing]`, `[chuckling]`, `[sobbing]`, `[crying loudly]`, `[sighing]`, `[groaning]`, `[panting]`, `[gasping]`, `[yawning]`, `[snoring]`, `[clear throat]` | Human sounds; Fish suggests text after the tag, for example "Ha, ha, ha" | yes | FA1 |
| `[audience laughing]`, `[background laughter]`, `[crowd laughing]` | Background laughter | yes | FA1 |
| `[break]`, `[long-break]` | Short and long pause | yes | FA1 |
| `[whisper]`, `[laugh]`, `[sigh]`, `[gasp]`, `[pause]`, `[inhale]`, `[exhale]` | Common short forms | yes | FA2 |
| `[slightly sad]`, `[very excited]`, `[extremely angry]` | Intensity modifiers | yes | FA1 |

On OpenRouter, S2 Pro and S2.1 Pro did not whisper for `[whispering]`; both produced the sigh and laugh for `(sighs)` and `(laughs)` [OR10, OR11]. These are one judged sample each; they do not change the documented syntax, which stays square brackets. Add a header note: "OpenRouter's benchmark did not hear `[whispering]` work on this model; listen to the first output."

## Controls

No style field on OpenRouter; `instructions` is ignored [OR1]. Fish's native API has `temperature`, `top_p`, and `prosody` (speed, volume) [FA3]; OpenRouter pass-through is unconfirmed.

## Voices

`supported_voices` is null for all Fish ids [OR5]; `voice` is "provider-specific voice identifier" [OR9]. Which Fish id format it accepts is unconfirmed. OpenRouter's benchmark used the provider default voice [OR10]. `fish-audio/s2.1-pro` accepts a reference clip through `input_references`, and Fish uses the clip's transcript [OR1, OR7].

Voice menu: "Provider default voice", "A Fish voice id (type it; format unconfirmed)", and for `fish-audio/s2.1-pro` only, "Reference clip". For the typed id, ask for it in chat. For a clip, ask for the path in chat and record it; never read the audio file.

## Limits

Fish documents no text cap for its TTS endpoint (unconfirmed) [FA3]. OpenRouter limit: unconfirmed (`per_request_limits` is null in the model list) [OR5]. S2.1 Pro supports 83 languages, S2 Pro 80+ [FA2].

## Pauses and punctuation

`[break]` (short), `[long-break]` (long), and `[pause]` [FA1, FA2]. Ordinary punctuation otherwise.

## Unconfirmed

- The `voice` id format on OpenRouter.
- Any per-request text limit on OpenRouter.
- OpenRouter pass-through of Fish native settings.
- Whether `[whispering]` works through OpenRouter.

## Sources

- [FA1] Fish Audio, Emotion Control: https://docs.fish.audio/developer-guide/core-features/emotions.md (retrieved 2026-10-12)
- [FA2] Fish Audio, Models Overview: https://docs.fish.audio/developer-guide/models-pricing/models-overview.md (retrieved 2026-10-12)
- [FA3] Fish Audio, Text to Speech endpoint: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR7] Tested 2026-10-12: https://openrouter.ai/api/v1/models/{canonical_slug}/endpoints for all 32 speech ids
- [OR9] OpenRouter per-model API guides: https://openrouter.ai/{model-id}/llms.txt, for example https://openrouter.ai/elevenlabs/eleven-v4/llms.txt (retrieved 2026-10-12)
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
