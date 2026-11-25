# Licences of what the edit tool uses

Rule N7 of the design: every font, sound and picture in the kit has a licence that allows a
creator's commercial post, written down here. Nothing goes into the kit before its line is here.

## The engine

Remotion `4.0.545`, all packages on that one version.

- **Its licence is not MIT.** It is free for an individual and for a company of up to three people
  (the Free License). Above that it needs a paid company licence. As read on 2026-11-19: the
  "Automators" tier is 0.01 USD a render with a minimum of 100 USD a month. Terms can change: check
  remotion.pro/license before a fourth person joins or the product is sold to teams.
- **The owner qualifies for the Free License today** (his own statement, 2026-11-19).
- **Nobody but the owner sets a licence key or acknowledges the licence in code.** No agent sets
  `licenseKey` or `acknowledgeRemotionLicense`. When a render first needs one, it is his call.
- The licence forbids letting end users bring their own Remotion code. The agent writes
  operations, never code (rule N2), so this cannot happen.
- Not used, on purpose: `@remotion/openai-whisper` (its model is being shut down), the sounds of
  `@remotion/sfx` (most are clips from other people's media), Remotion's caption gallery (its
  licence is not stated).

## Fonts

Each is the upright variable font from Google's open fonts repository
(`github.com/google/fonts`, folder `ofl/`), fetched on 2026-11-19 and not changed, with its
`OFL.txt` beside it. The SIL Open Font License 1.1 allows use in a creator's commercial video and
bundling with software. The file names are ours; the fonts are not modified, so the reserved
font names are not touched.

| Typeface | File | Weights | Copyright |
|---|---|---|---|
| Inter | `public/edit/fonts/inter/Inter.ttf` | 100 to 900 | 2020 The Inter Project Authors |
| Montserrat | `public/edit/fonts/montserrat/Montserrat.ttf` | 100 to 900 | 2024 The Montserrat.Git Project Authors |
| TikTok Sans | `public/edit/fonts/tiktoksans/TikTokSans.ttf` | 300 to 900 | 2024 TikTok Inc. |

## Sounds

None added yet. Only CC0 or licensed sounds, each with its measured length and its source.
