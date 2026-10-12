# MiniMax Speech 2.8

Verified: 2026-10-12. Ids: `minimax/speech-2.8-hd`, `minimax/speech-2.8-turbo`. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none on OpenRouter; `instructions` is ignored [OR1].
- Express delivery with the `(interjection)` tags from the table, punctuation, and the voice choice. Voice names carry delivery (for example `English_Whispering_girl`), which can stand in for a style field.
- Never write direction lines into the text.
- Square-bracket cues are spoken aloud on OpenRouter ("Whispering, Route 6...") [OR10]. Never use them here.
- Half-width parentheses also carry pronunciation overrides (pinyin, IPA, Jyutping) [MM1], so write no ordinary parenthetical asides in the script (derived).
- Header "Model settings": `voice`, `response_format`.

## Tags

Interjections in parentheses, "Only supported when using `speech-2.8-hd` or `speech-2.8-turbo` models." [MM1].

| Tag | Effect | Use | Source |
|---|---|---|---|
| `(laughs)`, `(chuckle)` | Laughter | yes | MM1 |
| `(coughs)`, `(clear-throat)`, `(sneezes)`, `(burps)` | Body sounds | yes | MM1 |
| `(groans)`, `(sighs)`, `(snorts)`, `(sniffs)`, `(gasps)`, `(emm)` | Reactions | yes | MM1 |
| `(breath)`, `(pant)`, `(inhale)`, `(exhale)` | Breathing | yes | MM1 |
| `(lip-smacking)`, `(humming)`, `(hissing)` | Mouth sounds | yes | MM1 |
| `<#x#>` | Pause of x seconds, 0.01 to 99.99, between speakable text, never two in a row (OpenRouter pass-through unconfirmed) | yes, note: pass-through unconfirmed | MM1 |
| Newline | Paragraph break | yes | MM1 |

MiniMax's example: "Omg(sighs), the real danger is not that computers start thinking like people..." [MM1]. Half-width parentheses also carry pinyin, IPA, or Jyutping pronunciation overrides, for example "(lɪv)" [MM1].

## Controls

MiniMax's native `voice_setting.emotion` accepts `happy`, `sad`, `angry`, `fearful`, `disgusted`, `surprised`, `calm` on 2.8 (2.8 does not support `whisper`) [MM1]; it is not exposed on OpenRouter and pass-through is unconfirmed [OR9]. `instructions` is ignored [OR1].

## Voices

45 ids, shared by both models [OR5]: `English_expressive_narrator`, `English_radiant_girl`, `English_magnetic_voiced_man`, `English_compelling_lady1`, `English_Aussie_Bloke`, `English_captivating_female1`, `English_Upbeat_Woman`, `English_Trustworth_Man`, `English_CalmWoman`, `English_UpsetGirl`, `English_Gentle-voiced_man`, `English_Whispering_girl`, `English_Diligent_Man`, `English_Graceful_Lady`, `English_ReservedYoungMan`, `English_PlayfulGirl`, `English_ManWithDeepVoice`, `English_MaturePartner`, `English_FriendlyPerson`, `English_MatureBoss`, `English_Debator`, `English_LovelyGirl`, `English_Steadymentor`, `English_Deep-VoicedGentleman`, `English_Wiselady`, `English_CaptivatingStoryteller`, `English_DecentYoungMan`, `English_SentimentalLady`, `English_ImposingManner`, `English_SadTeen`, `English_PassionateWarrior`, `English_WiseScholar`, `English_Soft-spokenGirl`, `English_SereneWoman`, `English_ConfidentWoman`, `English_PatientMan`, `English_Comedian`, `English_BossyLeader`, `English_Strong-WilledBoy`, `English_StressedLady`, `English_AssertiveQueen`, `English_AnimeCharacter`, `English_Jovialman`, `English_WhimsicalGirl`, `English_Kind-heartedGirl`.

OpenRouter says the models accept "arbitrary MiniMax voice IDs" [OR5].

Voice menu: first three listed.

## Limits

"Must be less than 10,000 characters."; MiniMax recommends streaming above 3,000 characters [MM1]. These are MiniMax's limits for its own API (provider limit); OpenRouter limit unconfirmed. The OR8 pages for both models state no request limit, and OR5 reports `per_request_limits` null for all 32 speech models [OR5, OR8].

## Pauses and punctuation

`<#x#>` for a timed pause (pass-through unconfirmed), a newline for a paragraph break, and ordinary punctuation [MM1].

## Unconfirmed

- OpenRouter pass-through of `<#x#>`.
- Any OpenRouter per-request limit.
- OpenRouter pass-through of `voice_setting.emotion`.

## Sources

- [MM1] MiniMax, Synchronous Text to Speech (HTTP) reference: https://platform.minimax.io/docs/api-reference/speech-t2a-http.md (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR8] OpenRouter model pages, full descriptions: https://openrouter.ai/{model-id}, for example https://openrouter.ai/elevenlabs/eleven-v4 (retrieved 2026-10-12)
- [OR9] OpenRouter per-model API guides: https://openrouter.ai/{model-id}/llms.txt, for example https://openrouter.ai/elevenlabs/eleven-v4/llms.txt (retrieved 2026-10-12)
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
