# Chatterbox-Turbo (Resemble AI)

Verified: 2026-10-12. Id: `ResembleAI/chatterbox-turbo`. Runs locally from the open-source `chatterbox-tts` package, loaded with `ChatterboxTurboTTS.from_pretrained(device)` [CB1]. It is not on OpenRouter (tested: zero matches for "chatterbox" or "resemble" across all 659 models), so the live check does not apply. Code is pinned at GitHub commit `5de7a54` (2026-07-21) and model files at Hugging Face revision `749d1c1` (2025-12-15). Chatterbox-Nano (`nano=True`, 110M) shares the class and has the same 19 tag tokens (tested) [CB1, CB13].

## Delivery handling

- Style field: none. `exaggeration`, `cfg_weight`, and `min_p` are ignored.
- Express delivery through the reference clip (voice character), the 9 documented tags, and wording and punctuation. Turbo has no delivery-style control [CB1, CB2].
- Never write direction lines into the text.
- Header "Model settings": the reference clip path or the bundled default voice, plus the note that `exaggeration`, `cfg_weight`, and `min_p` have no effect on Turbo.

## Tag syntax

- Square brackets, lowercase, exact spelling, written inside the text string. Each tag is one added tokenizer token, ids 50257 to 50275 [CB6, CB7].
- Tested on the Turbo tokenizer: `[laugh]` encodes to the single token 50275; `[Laugh]`, `[LAUGH]`, `[ laugh ]`, `[laughs]`, `[laughing]`, `(laugh)`, and `<laugh>` encode as ordinary text tokens. `[clear throat]` (one space) is one token; `[clear-throat]` is not [CBT]. A misspelled tag reaches the model as literal text; whether it is then spoken is unconfirmed.
- Placement: anywhere. The README puts a tag mid-sentence before a comma ("calling you back [chuckle], have you got one minute") and the demo puts one between sentences ("Oh, that's hilarious! [chuckle] Um anyway") [CB1, CB3]. The demo's tag buttons insert the tag at the cursor with a space on each side [CB3]. Tested: `Wait[gasp]what?` still yields the single `[gasp]` token [CBT].
- The README describes the tags as letting you use "`[cough]`, `[laugh]`, `[chuckle]`, and more to add distinct realism" [CB1]; no per-tag effect is documented beyond the tag name.

| Tag | Effect | Use | Source |
|---|---|---|---|
| `[clear throat]` | Throat-clearing sound (named in demo; effect inferred from name) | yes | CB3, CB6 |
| `[sigh]` | Sigh | yes | CB3, CB6 |
| `[shush]` | Shushing sound | yes | CB3, CB6 |
| `[cough]` | Cough | yes | CB1, CB3, CB6 |
| `[groan]` | Groan | yes | CB3, CB6 |
| `[sniff]` | Sniff | yes | CB3, CB6 |
| `[gasp]` | Gasp | yes | CB3, CB6 |
| `[chuckle]` | Chuckle | yes | CB1, CB3, CB6 |
| `[laugh]` | Laugh | yes | CB1, CB3, CB6 |
| `[angry]` | Unconfirmed: in tokenizer only, not in demo or docs | experimental | CB6, CB14, CB15 |
| `[fear]` | Unconfirmed (tokenizer only) | experimental | CB6 |
| `[surprised]` | Unconfirmed (tokenizer only) | experimental | CB6 |
| `[whispering]` | Unconfirmed (tokenizer only) | experimental | CB6, CB15 |
| `[advertisement]` | Unconfirmed (tokenizer only) | experimental | CB6 |
| `[dramatic]` | Unconfirmed (tokenizer only) | experimental | CB6 |
| `[narration]` | Unconfirmed (tokenizer only) | experimental | CB6 |
| `[crying]` | Unconfirmed (tokenizer only) | experimental | CB6 |
| `[happy]` | Unconfirmed (tokenizer only) | experimental | CB6 |
| `[sarcastic]` | Unconfirmed (tokenizer only) | experimental | CB6 |

The 10 tokenizer-only tags have conflicting community reports, neither from a maintainer: an ONNX user wrote that every one "was working, however sometimes it created artefacts or weird sound" [CB14]; an mlx-audio user reports the same 10 have "no audible effect" [CB15]. Offer only the 9 documented tags. Use an experimental tag only when the user asks for it, and mark it experimental in the header notes.

## Controls

`generate()` signature and demo UI ranges [CB2 L272-L291, CB3 L155-L161]:

| Parameter | Default | Range | Effect on Turbo | Source |
|---|---|---|---|---|
| `temperature` | 0.8 | Demo slider 0.05 to 2.0 | Sampling randomness | CB2 L281, CB3 L156 |
| `top_p` | 0.95 | Demo slider 0.00 to 1.00 | Nucleus sampling | CB2 L277, CB3 L157 |
| `top_k` | 1000 | Demo slider 0 to 1000, step 10 | Top-k sampling | CB2 L282, CB3 L158 |
| `repetition_penalty` | 1.2 | Demo slider 1.00 to 2.00 | Repetition penalty | CB2 L275, CB3 L159 |
| `min_p` | 0.0 | Demo slider 0.00 to 1.00 | Ignored; a value above 0 logs a warning | CB2 L276, L290-L291 |
| `exaggeration` | 0.0 | None | Ignored; a value above 0 logs a warning; Turbo config sets `emotion_adv = False` | CB2 L159, L279, L290-L291 |
| `cfg_weight` | 0.0 | None | Ignored; a value above 0 logs a warning | CB2 L280, L290-L291 |
| `norm_loudness` | True | Boolean | Normalizes the reference clip to -27 LUFS before conditioning | CB2 L228-L248, L283 |
| `audio_prompt_path` | None | File path | Reference clip for cloning | CB2 L278, L285-L286 |
| Seed | Not a `generate()` argument | Demo: number, 0 means random | The demo seeds torch, NumPy, and `random` before calling `generate()` | CB3 L69-L74, L98-L99 |

The ignored-parameter warning reads: "CFG, min_p and exaggeration are not supported by the {self.model_label} version and will be ignored." [CB2 L291]. Output is 24 kHz (`S3GEN_SR = 24000`) and always carries the PerTh watermark [CB2 L125, L319; CB9].

The README's tips apply only to the original Chatterbox: "Try lower `cfg_weight` values (e.g. `~0.3`) and increase `exaggeration` to around `0.7` or higher." [CB1]. Do not apply them to Turbo.

## Voices

Voice menu: "Bundled default voice" and "My reference clip".

- **Cloning:** pass `audio_prompt_path`. The code asserts "Audio prompt must be longer than 5 seconds!" [CB2 L245]. The decoder conditions on the first 10 s (`DEC_COND_LEN = 10 * S3GEN_SR`) and the T3 model on the first 15 s at 16 kHz (`ENC_COND_LEN = 15 * S3_SR`) [CB2 L112-L113, L252, L258]. The README example file is named `your_10s_ref_clip.wav` [CB1]. Guidance derived from the code, not documented: use 10 to 15 s of clean single-speaker audio; audio past 15 s is not used.
- **Built-in voice:** the model repo ships `conds.pt`, which loads as default conditionals [CB2 L183-L186]; `example_tts_turbo.py` calls `model.generate(text)` with no clip [CB4 L13]. The built-in voice has no published name or description (unconfirmed).
- **Presets:** the open-source package has none. Third-party hosts add their own: fal.ai takes `voice` (default `lucy`, 20 names: aaron, abigail, anaya, andy, archer, brian, chloe, dylan, emmanuel, ethan, evelyn, gavin, gordon, ivan, laura, lucy, madison, marisol, meera, walter) or an `audio_url` clip of 5 to 10 s [CB20]; Featherless lists the same 20 names capitalized, default Andy [CB21]. These apply only on those hosts.
- **Resemble's hosted API does not serve Turbo:** its Model Versions page lists Chatterbox-Turbo (`tts-v4-turbo`) as "End of life" [CB18]. Its SSML page tags (`[pause]`, `[giggle]`, `<whisper>`, and others) belong to Resemble Ultra and must not be used for Turbo [CB18, CB19].

## Limits

Local package limits, not OpenRouter limits.

- No character cap in code. The tokenizer has `model_max_length` 1024 and `generate()` tokenizes with `truncation=True` [CB2 L295, CB7]. Tested: a 13,500-character text (3,001 tokens) truncates to 1,024 tokens [CBT]. The tested sample ran about 4.5 characters per token (estimate for English prose).
- The generation loop stops at `max_gen_len=1000` speech tokens [CB5 L393-L394]; speech tokens run at 25 per second [CB8 L18], so one call yields at most about 40 s of audio (derived).
- The official demo labels its textbox "Text to synthesize (max chars 300)" without enforcing it [CB3 L123, CB12 L111].
- Community reports (not maintainers): hallucination above about 350 characters [CB16]; instability after 25 to 30 s [CB17]. Third-party hosts: fal.ai accepts up to 5,000 characters [CB20]; Featherless says "Turbo documents a 500-character text maximum" [CB21], a claim found in no Resemble source (unconfirmed).
- Segment size for the skill: at most 300 characters per generation, split at sentence ends (estimate).

## Pauses and punctuation

`punc_norm()` runs on every input before tokenizing [CB2 L30-L66, L294]:

| Input | What Turbo does | Source |
|---|---|---|
| U+2026 (single-character ellipsis) | Replaced with `, ` | CB2 L47 |
| `...` (three periods) | Kept; tested as the single token `...` | CB2 L46-L56, CBT |
| U+2014 (em dash), U+2013 (en dash) | Replaced with `-` | CB2 L49-L50 |
| `:` | Replaced with `,` | CB2 L48 |
| Line breaks, tabs, repeated spaces | Collapsed to one space | CB2 L43 |
| Curly quotes | Replaced with straight quotes | CB2 L52-L55 |
| Missing end punctuation (including a trailing tag) | `.` appended unless the text ends in `.`, `!`, `?`, `-`, or `,` | CB2 L60-L64 |
| Lowercase first character | Capitalized | CB2 L38-L40 |
| Empty text | Replaced with "You need to add some text for me to talk." | CB2 L35-L36 |

Script rules from the table:

- Mark hesitation with ASCII `...` or a comma. Never use U+2026, U+2014, or U+2013 as a pause mark.
- Line breaks do nothing, so do not use them for pacing.
- End each segment with `.`, `!`, or `?`, so a trailing tag does not get an appended `.` (derived).
- Turbo has no pause tag; a community user asked for one in [CB14] and got no answer.

## Unconfirmed

- How long Turbo pauses at `-`, `...`, `,`, or `.`.
- Whether a misspelled tag is spoken aloud.
- Whether the 10 tokenizer-only tags change delivery on the official PyTorch build.
- The built-in voice's name and description.
- The Featherless 500-character claim.

## Differences from the original Chatterbox

The original Chatterbox (500M) has no paralinguistic tags, uses `exaggeration` (default 0.5) and `cfg_weight` (default 0.5), and also maps `...`, ` - `, and `;` to commas [CB10, CB11]. None of that applies to Turbo.

## Sources

- [CB1] Chatterbox README at commit 5de7a54: https://github.com/resemble-ai/chatterbox/blob/5de7a54aa4e5e2baadb0182dde554908b48b85c2/README.md (retrieved 2026-10-12)
- [CB2] `tts_turbo.py` at commit 5de7a54: https://github.com/resemble-ai/chatterbox/blob/5de7a54aa4e5e2baadb0182dde554908b48b85c2/src/chatterbox/tts_turbo.py (retrieved 2026-10-12)
- [CB3] `gradio_tts_turbo_app.py` at commit 5de7a54: https://github.com/resemble-ai/chatterbox/blob/5de7a54aa4e5e2baadb0182dde554908b48b85c2/gradio_tts_turbo_app.py (retrieved 2026-10-12)
- [CB4] `example_tts_turbo.py` at commit 5de7a54: https://github.com/resemble-ai/chatterbox/blob/5de7a54aa4e5e2baadb0182dde554908b48b85c2/example_tts_turbo.py (retrieved 2026-10-12)
- [CB5] `t3.py` at commit 5de7a54: https://github.com/resemble-ai/chatterbox/blob/5de7a54aa4e5e2baadb0182dde554908b48b85c2/src/chatterbox/models/t3/t3.py#L393-L394 (retrieved 2026-10-12)
- [CB6] Turbo `added_tokens.json` at revision 749d1c1: https://huggingface.co/ResembleAI/chatterbox-turbo/blob/749d1c1a46eb10492095d68fbcf55691ccf137cd/added_tokens.json (retrieved 2026-10-12)
- [CB7] Turbo `tokenizer_config.json` at revision 749d1c1: https://huggingface.co/ResembleAI/chatterbox-turbo/blob/749d1c1a46eb10492095d68fbcf55691ccf137cd/tokenizer_config.json (retrieved 2026-10-12)
- [CB8] `s3tokenizer.py` at commit 5de7a54: https://github.com/resemble-ai/chatterbox/blob/5de7a54aa4e5e2baadb0182dde554908b48b85c2/src/chatterbox/models/s3tokenizer/s3tokenizer.py#L15-L18 (retrieved 2026-10-12)
- [CB9] `s3gen/const.py` at commit 5de7a54: https://github.com/resemble-ai/chatterbox/blob/5de7a54aa4e5e2baadb0182dde554908b48b85c2/src/chatterbox/models/s3gen/const.py (retrieved 2026-10-12)
- [CB10] Original `tts.py` at commit 5de7a54: https://github.com/resemble-ai/chatterbox/blob/5de7a54aa4e5e2baadb0182dde554908b48b85c2/src/chatterbox/tts.py (retrieved 2026-10-12)
- [CB11] Original `gradio_tts_app.py` at commit 5de7a54: https://github.com/resemble-ai/chatterbox/blob/5de7a54aa4e5e2baadb0182dde554908b48b85c2/gradio_tts_app.py (retrieved 2026-10-12)
- [CB12] Official Turbo demo Space `app.py`: https://huggingface.co/spaces/ResembleAI/chatterbox-turbo-demo/blob/main/app.py (retrieved 2026-10-12)
- [CB13] Nano `added_tokens.json`: https://huggingface.co/ResembleAI/chatterbox-nano/blob/main/added_tokens.json (retrieved 2026-10-12; tested: same 19 tags as Turbo)
- [CB14] Issue #492 "Paralinguistic tags?": https://github.com/resemble-ai/chatterbox/issues/492 (retrieved 2026-10-12)
- [CB15] Issue #557 on the 10 tokenizer-only tags: https://github.com/resemble-ai/chatterbox/issues/557 (retrieved 2026-10-12)
- [CB16] Issue #424 on output above about 350 characters: https://github.com/resemble-ai/chatterbox/issues/424 (retrieved 2026-10-12)
- [CB17] Issue #543 on instability after 25 to 30 s: https://github.com/resemble-ai/chatterbox/issues/543 (retrieved 2026-10-12)
- [CB18] Resemble AI, Model Versions: https://docs.resemble.ai/getting-started/model-versions.md (retrieved 2026-10-12)
- [CB19] Resemble AI, SSML Reference: https://docs.resemble.ai/getting-started/ssml.md (retrieved 2026-10-12)
- [CB20] fal.ai Chatterbox Turbo API and schema: https://fal.ai/models/fal-ai/chatterbox/text-to-speech/turbo/api and https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/chatterbox/text-to-speech/turbo (retrieved 2026-10-12)
- [CB21] Featherless, Chatterbox Turbo: https://featherless.ai/docs/audio-speech-model-chatterbox-turbo (retrieved 2026-10-12)
- [CBT] Tested 2026-10-12: Turbo tokenizer files from revision 749d1c1 loaded with `transformers` 5.19.0 `AutoTokenizer`; encoded the tag variants, punctuation samples, and a 13,500-character text listed above.
