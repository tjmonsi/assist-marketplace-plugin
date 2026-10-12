# Microsoft MAI-Voice

Verified: 2026-10-12. Ids: `microsoft/mai-voice-2`, `microsoft/mai-voice-2-flash`, `microsoft/mai-voice-2.1`, `microsoft/mai-voice-2.1-flash`, all served by Azure [OR1, OR7]. The four ids share tags, controls, and limits; voices differ between 2 and 2.1 (see Voices).

## Delivery handling

- Style field: none on OpenRouter. No style field reaches Azure through OpenRouter.
- Inline tags: none documented. Express delivery through the voice choice and the wording and punctuation of the text.
- State the delivery in plain words in the header for the user.
- Never write direction lines or bracketed cues into the text.
- Header "Model settings": `voice` (full Azure id with model suffix), `response_format` (`mp3` or `pcm`, 24 kHz mono).

## Tags

Microsoft documents no inline tags; expression comes from SSML `<mstts:express-as style="...">` [MS1]. OpenRouter hides SSML: "Azure TTS uses SSML internally, but this is fully abstracted, so you only need the standard parameters." [OR1]. OpenRouter's benchmark shows MAI-Voice-2 and 2-Flash honoring `[whispering]` and `[excited]` but speaking `(sighs)` and `(laughs)`, and MAI-Voice-2.1 and 2.1-Flash producing the sigh and laugh for the parenthetical cues [OR10, OR11]. Inline cues for MAI-Voice are therefore unconfirmed (one judged sample each); do not use them.

| Tag | Effect | Use | Source |
|---|---|---|---|
| None documented | Not applicable | no | MS1 |

## Controls

| Control | Values | OpenRouter | Source |
|---|---|---|---|
| SSML `style` on Harper and Grant (2.1) | `agent`, `audiobook`, `customer_call_center`, `educational`, `narrator`, `neutral` (per-locale subsets) | Not exposed | MS1 |
| SSML `style` on many locale voices (2.1) | `angry`, `confused`, `determined`, `disgusted`, `embarrassed`, `excited`, `fearful`, `happy`, `hopeful`, `jealous`, `joyful`, `neutral`, `regretful`, `relieved`, `sad`, `shouting`, `softvoice`, `surprised`, `whispering` (per-voice subsets) | Not exposed | MS1 |
| `voice` | Full Azure id with model suffix; "the voice's locale sets the synthesis language" | Yes | OR1 |
| `response_format` | `mp3` or `pcm` (24 kHz mono) | Yes | OR1 |

## Voices

- `microsoft/mai-voice-2` and `mai-voice-2-flash`: `en-US-Harper:MAI-Voice-2`, `es-MX-Valeria:MAI-Voice-2`, `fr-FR-Soleil:MAI-Voice-2`, `de-DE-Klaus:MAI-Voice-2` [OR5]. OR5 returns the `:MAI-Voice-2` suffix for both models, including `mai-voice-2-flash` (tested 2026-10-12).
- `microsoft/mai-voice-2.1` (suffix `:MAI-Voice-2.1`) and `mai-voice-2.1-flash` (suffix `:MAI-Voice-2.1-Flash`), the same 97 locale-name prefixes [OR5]: cs-CZ-Grant, cs-CZ-Harper, da-DK-Grant, da-DK-Harper, de-DE-Grant, de-DE-Harper, de-DE-Klaus, de-DE-Mia, en-AU-Isla, en-GB-Emily, en-GB-Harry, en-IN-Dhruv, en-IN-Priya, en-US-Ethan, en-US-Grant, en-US-Harper, en-US-Iris, en-US-Jasper, en-US-Olivia, en-US-Sage, es-ES-Marta, es-MX-Alejo, es-MX-Grant, es-MX-Harper, es-MX-Valeria, fi-FI-Grant, fi-FI-Harper, fr-FR-Grant, fr-FR-Harper, fr-FR-Marc, fr-FR-Soleil, hi-IN-Arjun, hi-IN-Dhruv, hi-IN-Grant, hi-IN-Harper, hi-IN-Kavya, hi-IN-Priya, hu-HU-Bence, hu-HU-Grant, hu-HU-Harper, hu-HU-Levente, hu-HU-Lilla, hu-HU-Reka, id-ID-Grant, id-ID-Harper, it-IT-Grant, it-IT-Harper, it-IT-Luca, it-IT-Rosa, ko-KR-Grant, ko-KR-Haena, ko-KR-Harper, ko-KR-Junho, nb-NO-Grant, nb-NO-Harper, nl-NL-Grant, nl-NL-Harper, nl-NL-Sander, pl-PL-Grant, pl-PL-Harper, pt-BR-Caio, pt-BR-Grant, pt-BR-Harper, pt-BR-Luana, pt-BR-Pedro, pt-BR-Rafael, pt-PT-Grant, pt-PT-Harper, pt-PT-Rui, ro-RO-Andrei, ro-RO-Elena, ro-RO-Grant, ro-RO-Harper, ro-RO-Ioana, ro-RO-Radu, ru-RU-Grant, ru-RU-Harper, ru-RU-Lev, ru-RU-Masha, sv-SE-Grant, sv-SE-Harper, th-TH-Grant, th-TH-Harper, th-TH-Krit, th-TH-Nattapong, tr-TR-Aydin, tr-TR-Elif, tr-TR-Grant, tr-TR-Harper, vi-VN-Grant, vi-VN-Harper, zh-CN-Bo, zh-CN-Grant, zh-CN-Harper, zh-CN-Lan, zh-CN-Mei, zh-CN-Wei.
- Instant voice cloning is gated by Microsoft and not available through OpenRouter (`supports_voice_cloning` false) [MS1, OR7].

Voice menu for 2 and 2-Flash: first three listed. For 2.1 and 2.1-Flash: `en-US-Harper`, `en-US-Ethan`, `en-GB-Emily`, each with the model's suffix. The voice's locale sets the language, so match it to the script's language.

## Limits

Azure real-time TTS caps "Maximum audio length produced per request" at 10 minutes [MS2] (provider limit). A character limit on the OpenRouter route is unconfirmed. Segment cap: at most about 1,275 words, or about 2,100 characters for Chinese, Japanese, or Thai (estimates: 10 minutes less a 15 percent margin, at 150 words or 250 characters per minute).

## Pauses and punctuation

No documented markup. Use commas, periods, and paragraph breaks.

## Unconfirmed

- Inline cues (`[whispering]`, `(sighs)`) for any MAI-Voice id.
- A character limit on the OpenRouter route.

## Sources

- [MS1] Microsoft Learn, MAI-Voice in Azure Speech: https://learn.microsoft.com/azure/ai-services/speech-service/mai-voices (retrieved 2026-10-12)
- [MS2] Microsoft Learn source, Speech service quotas and limits: https://github.com/MicrosoftDocs/azure-ai-docs/blob/main/articles/ai-services/speech-service/speech-services-quotas-and-limits.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR7] Tested 2026-10-12: https://openrouter.ai/api/v1/models/{canonical_slug}/endpoints for all 32 speech ids
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
