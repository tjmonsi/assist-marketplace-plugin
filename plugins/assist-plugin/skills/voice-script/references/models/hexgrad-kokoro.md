# hexgrad Kokoro 82M

Verified: 2026-10-12. Id: `hexgrad/kokoro-82m`, served by DeepInfra and Together [OR7]. Served through `POST https://openrouter.ai/api/v1/audio/speech` [OR1].

## Delivery handling

- Style field: none; `instructions` is ignored [OR1].
- Inline tags: none. Express delivery through the voice choice, wording, and punctuation only. State the delivery in plain words in the header for the user.
- Never write direction lines into the text, and write no square brackets: the upstream library uses them for pronunciation overrides, and OpenRouter's Kokoro spoke every cue word [OR10, OR11].
- Header "Model settings": `voice`, `response_format`.

## Tags

None in the model card or README [KK1, KK2]. On OpenRouter it spoke every cue word [OR10, OR11]. The upstream library writes pronunciation overrides as Markdown links, for example `[Kokoro](/kˈOkəɹO/)` [KK1]; whether the hosted routes honor that syntax is unconfirmed, and the skill should avoid square brackets for this model.

| Tag | Effect | Use | Source |
|---|---|---|---|
| None | Not applicable | no | KK1 |

## Controls

No style field.

## Voices

54 voices [OR5]: `af_alloy`, `af_aoede`, `af_bella`, `af_heart`, `af_jessica`, `af_kore`, `af_nicole`, `af_nova`, `af_river`, `af_sarah`, `af_sky`, `am_adam`, `am_echo`, `am_eric`, `am_fenrir`, `am_liam`, `am_michael`, `am_onyx`, `am_puck`, `am_santa`, `bf_alice`, `bf_emma`, `bf_isabella`, `bf_lily`, `bm_daniel`, `bm_fable`, `bm_george`, `bm_lewis`, `ef_dora`, `em_alex`, `em_santa`, `ff_siwis`, `hf_alpha`, `hf_beta`, `hm_omega`, `hm_psi`, `if_sara`, `im_nicola`, `jf_alpha`, `jf_gongitsune`, `jf_nezumi`, `jf_tebukuro`, `jm_kumo`, `pf_dora`, `pm_alex`, `pm_santa`, `zf_xiaobei`, `zf_xiaoni`, `zf_xiaoxiao`, `zf_xiaoyi`, `zm_yunjian`, `zm_yunxi`, `zm_yunxia`, `zm_yunyang`.

OpenRouter describes them as "organized by language and gender" across 8 languages [OR8].

Voice menu: first three listed.

## Limits

OpenRouter reports a 4,096 context length [OR5]; unconfirmed for text length.

## Pauses and punctuation

No pause markup is documented. Use ordinary punctuation.

## Unconfirmed

- The per-request text limit.
- Whether hosted routes honor Markdown-link pronunciation overrides.

## Sources

- [KK1] Kokoro-82M model card: https://huggingface.co/hexgrad/Kokoro-82M (retrieved 2026-10-12)
- [KK2] hexgrad/kokoro README: https://github.com/hexgrad/kokoro (retrieved 2026-10-12)
- [OR1] OpenRouter, Text-to-Speech guide: https://openrouter.ai/docs/guides/overview/multimodal/tts.md (retrieved 2026-10-12)
- [OR5] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=speech (32 models, HTTP 200 without a key)
- [OR7] Tested 2026-10-12: https://openrouter.ai/api/v1/models/{canonical_slug}/endpoints for all 32 speech ids
- [OR8] OpenRouter model pages, full descriptions: https://openrouter.ai/{model-id}, for example https://openrouter.ai/elevenlabs/eleven-v4 (retrieved 2026-10-12)
- [OR10] OpenRouter speech benchmark, Bracketed cue: https://openrouter.ai/benchmarks/media/speech/bracketed-cue (retrieved 2026-10-12)
- [OR11] OpenRouter speech benchmark, Nonverbal cue: https://openrouter.ai/benchmarks/media/speech/nonverbal-cue (retrieved 2026-10-12)
