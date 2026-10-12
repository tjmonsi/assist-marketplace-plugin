# OpenAI gpt-audio (audio-output chat models)

Verified: 2026-10-12. Ids: `openai/gpt-audio`, `openai/gpt-audio-mini`. They list `["text", "audio"]` output and appear under `output_modalities=audio`, not `speech`, so the speech-list live check does not cover them [OR6]. They use chat completions, not `/audio/speech`.

## Delivery handling

- Style field: the messages. Delivery direction goes in a system or user message; OpenRouter's example user message is "Say hello in a friendly tone." [OR13].
- Put the user's delivery answer in the header as the message to send with the script (header "Model settings": `System message`). The fenced block holds only the script text.
- These are conversational models; reading a script verbatim depends on the prompt (unconfirmed reliability). Add that warning to the header notes. Write the system message so it asks the model to read the script aloud exactly as given.
- Inline tags: none documented. Write no bracketed cues.
- Header "Model settings": `voice`, `format`, `System message`, `stream: true`.

## Tags

None documented.

| Tag | Effect | Use | Source |
|---|---|---|---|
| None | Not applicable | no | OR13 |

## Controls

`POST https://openrouter.ai/api/v1/chat/completions` with `"modalities": ["text", "audio"]`, `"audio": {"voice": ..., "format": ...}`, and `"stream": true`; "Audio output requires streaming", returned as base64 `delta.audio.data` chunks plus `delta.audio.transcript` [OR13]. Formats named by OpenRouter: `wav`, `mp3`, `flac`, `opus`, `pcm16`, "Available formats vary by model" [OR13].

## Voices

OpenAI's chat completions reference lists `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `marin`, `cedar` [OA1]. Which of these OpenRouter's `openai/gpt-audio` accepts is unconfirmed (`supported_voices` is null) [OR6].

Voice menu: `alloy`, `ash`, `coral`, `echo`. Add the header note that voice acceptance is unconfirmed.

## Limits

OpenRouter limits: 128,000 context; 16,384 max completion tokens [OR6]. These bound the whole reply, audio included, so the maximum script length is unconfirmed. Use the skill's working cap of 1,000 characters per segment (no vendor sets this cap) and say so in the header notes.

## Pauses and punctuation

No pause markup is documented. Use ordinary punctuation.

## Excluded: Lyria

`google/lyria-3-pro-preview` and `google/lyria-3-clip-preview` also list audio output, but OpenRouter describes them as music generation priced per song or per 30-second clip [OR6]. Do not offer them.

## Unconfirmed

- Which OpenAI voices `openai/gpt-audio` accepts.
- How reliably the model reads a script verbatim.

## Sources

- [OA1] OpenAI API reference, Create chat completion (`voice`): https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create (via Context7 `/websites/developers_openai_api_reference`; retrieved 2026-10-12)
- [OR6] Tested 2026-10-12: https://openrouter.ai/api/v1/models?output_modalities=audio (4 models)
- [OR13] OpenRouter, Audio guide (audio output): https://openrouter.ai/docs/guides/overview/multimodal/audio.md (retrieved 2026-10-12)
