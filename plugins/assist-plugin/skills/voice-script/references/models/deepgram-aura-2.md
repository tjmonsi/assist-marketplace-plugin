# Deepgram Aura-2

Verified: 2026-10-12. Id: `deepgram/aura-2`. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none; `instructions` is ignored [OR1].
- Inline tags: none. Cue words in brackets or parentheses are spoken aloud on OpenRouter [OR10, OR11].
- Express delivery through voice choice, wording, and pause punctuation only. State the delivery in plain words in the header for the user.
- Never write direction lines or bracketed cues into the text.
- Header "Model settings": `voice`, `response_format`.

## Tags

None. Aura-2 spoke bracketed and parenthetical cue words on OpenRouter [OR10, OR11].

| Markup | Effect | Use | Source |
|---|---|---|---|
| `...` (groups of three dots) | Longer natural pause; "Any dots that are not in groups of three (eg. 5 dots) will not be determined as a pause." | yes | DG3 |
| `. . .` (spaced dots) | Silent pause; a workaround that "may not be available in our future models" | no | DG3 |
| `,` or `.` | Short pause ("a very **short** pause" in Deepgram's words) | yes | DG3 |
| `um`, `uh` | Filler words | topic scripts only; never add to a user draft | DG3 |
| `\{"word": "...", "pronounce": "<IPA>"\}` (backslashes required) | Pronunciation override | only when the user asks | DG1 |

The backslashes in the pronunciation marker belong to the Deepgram syntax; they are not MDX escapes [DG1].

## Controls

Native `speed` (Aura-2 0.7 to 1.5) is a query parameter [DG1, DG2]; OpenRouter exposes it nowhere and pass-through is unconfirmed [OR9]. `instructions` is ignored [OR1].

## Voices

90 voices named `aura-2-<name>-<language>` [OR5]: `aura-2-thalia-en`, `aura-2-agathe-fr`, `aura-2-agustina-es`, `aura-2-alvaro-es`, `aura-2-ama-ja`, `aura-2-amalthea-en`, `aura-2-andromeda-en`, `aura-2-antonia-es`, `aura-2-apollo-en`, `aura-2-aquila-es`, `aura-2-arcas-en`, `aura-2-aries-en`, `aura-2-asteria-en`, `aura-2-athena-en`, `aura-2-atlas-en`, `aura-2-aurelia-de`, `aura-2-aurora-en`, `aura-2-beatrix-nl`, `aura-2-callista-en`, `aura-2-carina-es`, `aura-2-celeste-es`, `aura-2-cesare-it`, `aura-2-cinzia-it`, `aura-2-cora-en`, `aura-2-cordelia-en`, `aura-2-cornelia-nl`, `aura-2-daphne-nl`, `aura-2-delia-en`, `aura-2-demetra-it`, `aura-2-diana-es`, `aura-2-dionisio-it`, `aura-2-draco-en`, `aura-2-ebisu-ja`, `aura-2-elara-de`, `aura-2-electra-en`, `aura-2-elio-it`, `aura-2-estrella-es`, `aura-2-fabian-de`, `aura-2-flavio-it`, `aura-2-fujin-ja`, `aura-2-gloria-es`, `aura-2-harmonia-en`, `aura-2-hector-fr`, `aura-2-helena-en`, `aura-2-hera-en`, `aura-2-hermes-en`, `aura-2-hestia-nl`, `aura-2-hyperion-en`, `aura-2-iris-en`, `aura-2-izanami-ja`, `aura-2-janus-en`, `aura-2-javier-es`, `aura-2-julius-de`, `aura-2-juno-en`, `aura-2-jupiter-en`, `aura-2-kara-de`, `aura-2-lara-de`, `aura-2-lars-nl`, `aura-2-leda-nl`, `aura-2-livia-it`, `aura-2-luciano-es`, `aura-2-luna-en`, `aura-2-maia-it`, `aura-2-mars-en`, `aura-2-melia-it`, `aura-2-minerva-en`, `aura-2-neptune-en`, `aura-2-nestor-es`, `aura-2-odysseus-en`, `aura-2-olivia-es`, `aura-2-ophelia-en`, `aura-2-orion-en`, `aura-2-orpheus-en`, `aura-2-pandora-en`, `aura-2-phoebe-en`, `aura-2-pluto-en`, `aura-2-rhea-nl`, `aura-2-roman-nl`, `aura-2-sander-nl`, `aura-2-saturn-en`, `aura-2-selena-es`, `aura-2-selene-en`, `aura-2-silvia-es`, `aura-2-sirio-es`, `aura-2-theia-en`, `aura-2-uzume-ja`, `aura-2-valerio-es`, `aura-2-vesta-en`, `aura-2-viktoria-de`, `aura-2-zeus-en`.

Voice menu: first three listed. The suffix is the language; match it to the script's language.

## Limits

Deepgram states 2000 characters twice on its controls page: the Limits table gives it as Aura-2's max input text length, and the Aura-2 pronunciation note says "a maximum input text length of 2000 characters" [DG1]. This is a provider limit; OpenRouter limit unconfirmed, because the OR8 Aura-2 page states no request limit and OR5 reports `per_request_limits` null [OR5, OR8]. Use 2,000 characters.

## Pauses and punctuation

`...` (exactly three dots) for a longer pause; `,` or `.` for a short one [DG3].

## Unconfirmed

- The OpenRouter per-request limit.
- OpenRouter pass-through of `speed`.

## Sources

- [DG1] Deepgram, Speed, Pause, Pronunciation: https://developers.deepgram.com/docs/tts-voice-controls.md (retrieved 2026-10-12)
- [DG2] Deepgram, Expressivity: https://developers.deepgram.com/docs/tts-expressivity.md (retrieved 2026-10-12)
- [DG3] Deepgram, Text to Speech Prompting (Aura): https://developers.deepgram.com/docs/text-to-speech-prompting.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR8] OpenRouter model pages, full descriptions: https://openrouter.ai/{model-id}, for example https://openrouter.ai/elevenlabs/eleven-v4 (retrieved 2026-10-12)
- [OR9] OpenRouter per-model API guides: https://openrouter.ai/{model-id}/llms.txt, for example https://openrouter.ai/elevenlabs/eleven-v4/llms.txt (retrieved 2026-10-12)
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
