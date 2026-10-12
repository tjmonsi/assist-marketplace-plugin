# Google Gemini 3.8 TTS

Verified: 2026-10-12. Ids: `google/gemini-3.8-flash-tts`, `google/gemini-3.8-flash-lite-tts`. Both "share the exact same API schema and prompting format" [G1]. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: `instructions`. "OpenRouter sends it as `speech_metadata.style` on the input text part of the upstream request." [OR1]. Put the user's delivery answer there as a short sustained direction, for example `"whispered urgently"`, `"out of breath"`, `"warm and enthusiastic"` [G1].
- Keep the style short. Google warns against long "Audio Profile" or "Director's Notes" blocks ("the most common cause of voice drift") and against putting age, gender, names, or permanent accent changes in `style` [G1]. Google advises testing with an empty style first [G1].
- The text is a verbatim transcript. "Gemini 3.8 TTS models read `input` verbatim, so delivery directions written into the text may be spoken aloud." [OR1]. Never write direction lines into the script.
- Point-in-time events go inline as `<angle bracket>` tags [G1].
- Header "Model settings": `voice`, `instructions` (the style text), `response_format`.

## Tags

Google: "Gemini 3.8 TTS treats the `text` field strictly as a verbatim transcript." Sustained delivery goes in `speech_metadata.style`; point-in-time events go inline in angle brackets, which Google recommends "for highest audio quality" [G1]. "If your transcript is in a non-English language, continue to use English inline tags for best results." [G1]. OpenRouter pass-through is unconfirmed for every tag below: OR1 says only that the models "read `input` verbatim", and OR10 and OR11 have no 3.8 results [OR10, OR11]. Add the header note "tag pass-through unconfirmed on OpenRouter" when any tag is used.

| Tag | Effect | Use | Source |
|---|---|---|---|
| `<short pause>`, `<long pause>` | Pause at that point | yes, note: pass-through unconfirmed | G1 |
| `<breath>`, `<heavy breath>`, `<exhales>`, `<pant>` | Breathing | yes, note: pass-through unconfirmed | G1 |
| `<laugh>`, `<laughter>`, `<chuckle>`, `<chuckles>`, `<giggle>`, `<snicker>`, `<cackle>` | Laughter | yes, note: pass-through unconfirmed | G1 |
| `<sigh>`, `<sighs>`, `<groan>`, `<moan>`, `<argh>`, `<grr>`, `<pff>`, `<phew>`, `<tsk>` | Sighs and reactions | yes, note: pass-through unconfirmed | G1 |
| `<cough>`, `<throat-clearing>`, `<sneeze>`, `<snort>`, `<yawn>` | Body sounds | yes, note: pass-through unconfirmed | G1 |
| `<cry>`, `<sob>`, `<whimper>` | Crying | yes, note: pass-through unconfirmed | G1 |
| `<gasp>`, `<scream>`, `<shout>`, `<shriek>`, `<cheer>`, `<growl>`, `<grunt>`, `<hiss>` | Vocal bursts | yes, note: pass-through unconfirmed | G1 |
| `<whispers>`, `<whispering>` | Whisper vocal event | yes, note: pass-through unconfirmed | G1 |

Backchannels in multi-speaker turns use pipes, for example `"So the launch is Thursday |oh hmm| Are we actually ready?"` [G1]. The skill writes single-speaker scripts and does not use them. Emphasis: capitalize words, for example "This is a VERY important point!" [G1]. Pacing: commas, `--`, `...`, the pause tags, or a `style` such as `"speaking slowly"` [G1].

## Controls

| Field | Values | Source |
|---|---|---|
| `instructions` (OpenRouter) | Free text; "OpenRouter sends it as `speech_metadata.style` on the input text part of the upstream request." Per-turn `instructions` override the top-level value | OR1 |
| `speech_metadata.style` (Google) | Short sustained direction, for example `"whispered urgently"`, `"out of breath"`, `"warm and enthusiastic"`; Google advises testing with an empty style first and keeping styles short | G1 |
| `input` as turns | Multi-speaker, up to 2 speakers with prebuilt voices | OR1, G1 |
| `provider.options["google-ai-studio"]` | Forwarded as generation config, for example `temperature` | OR1 |

## Voices

30 prebuilt voices, identical for all three Gemini ids [OR5]: `Zephyr`, `Puck`, `Charon`, `Kore`, `Fenrir`, `Leda`, `Orus`, `Aoede`, `Callirrhoe`, `Autonoe`, `Enceladus`, `Iapetus`, `Umbriel`, `Algieba`, `Despina`, `Erinome`, `Algenib`, `Rasalgethi`, `Laomedeia`, `Achernar`, `Alnilam`, `Schedar`, `Gacrux`, `Pulcherrima`, `Achird`, `Zubenelgenubi`, `Vindemiatrix`, `Sadachbia`, `Sadaltager`, `Sulafat`.

Google's one-word characters: Zephyr Bright, Puck Upbeat, Charon Informative, Kore Firm, Fenrir Excitable, Leda Youthful, Orus Firm, Aoede Breezy, Callirrhoe Easy-going, Autonoe Bright, Enceladus Breathy, Iapetus Clear, Umbriel Easy-going, Algieba Smooth, Despina Smooth, Erinome Clear, Algenib Gravelly, Rasalgethi Informative, Laomedeia Upbeat, Achernar Soft, Alnilam Firm, Schedar Even, Gacrux Mature, Pulcherrima Forward, Achird Friendly, Zubenelgenubi Casual, Vindemiatrix Gentle, Sadachbia Lively, Sadaltager Knowledgeable, Sulafat Warm [G1].

OpenRouter's descriptions say the 3.8 models also accept Voice Design and Voice Replication `voice_...` identifiers [OR8]; how to create one for OpenRouter use is unconfirmed.

Voice menu: show a voice with its character word, for example `Kore (Firm)`, `Puck (Upbeat)`, `Charon (Informative)`, `Sulafat (Warm)`.

## Limits

- Google's limits (provider-native): 8,192 input tokens and 16,384 output tokens per request [G2, G4].
- OpenRouter's limit: its endpoints report `max_prompt_tokens` 8192 [OR7].
- The limit is in tokens, not characters. Estimate tokens as characters divided by 4 for Latin-script text and 1 token per character for every non-Latin script (both estimates), and stay at least 20 percent under 8,192, counting the `instructions` text with the script.
- Audio length: no output-audio cap is documented for 3.8. As a precaution, apply the 655 s cap that Google Cloud's Gemini-TTS page states (cited for 3.1 Preview): "The output audio can at most be around 655 seconds"; longer input is truncated [G5]. Segment cap: at most about 1,400 words, or about 2,300 characters for Chinese, Japanese, or Thai (estimates: 655 s less a 15 percent margin, at 150 words or 250 characters per minute). Use the smallest of the token cap and the audio cap.
- OR10 and OR11 have no 3.8 results; their 3.8 samples carry no transcript or judge verdict, and OR12's two 3.8 samples are unscored too [OR10, OR11, OR12].

## Pauses and punctuation

Commas, `--`, `...`, `<short pause>`, `<long pause>`, or a style such as `"speaking slowly"` [G1]. Capitalize a word to stress it [G1].

## Unconfirmed

- OpenRouter pass-through of every inline tag above.
- How to create a `voice_...` id for OpenRouter use.
- Whether the 655 s cap applies to 3.8 (applied as a precaution).

## Sources

- [G1] Google, Gemini API speech generation: https://ai.google.dev/gemini-api/docs/speech-generation (fetched as https://ai.google.dev/gemini-api/docs/speech-generation.md.txt; retrieved 2026-10-12)
- [G2] Google, Gemini 3.8 Flash TTS model page: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts (retrieved 2026-10-12)
- [G4] Google, Gemini 3.8 Flash-Lite TTS model page: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-lite-tts (retrieved 2026-10-12)
- [G5] Google Cloud, Gemini-TTS (Markup tag guide, limits): https://docs.cloud.google.com/text-to-speech/docs/gemini-tts (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR7] Tested 2026-10-12: https://openrouter.ai/api/v1/models/{canonical_slug}/endpoints for all 32 speech ids
- [OR8] OpenRouter model pages, full descriptions: https://openrouter.ai/{model-id}, for example https://openrouter.ai/elevenlabs/eleven-v4 (retrieved 2026-10-12)
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
- [OR12] OpenRouter speech benchmark, Embedded instruction: https://openrouter.ai/benchmarks/media/speech/embedded-instruction (retrieved 2026-10-12)
