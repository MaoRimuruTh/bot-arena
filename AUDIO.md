# Audio: levels and how they are checked

All sound in BoT Arena is synthesized with WebAudio (`js/sfx.js`, `js/music.js`, `js/score.js`). There are no audio files.

## Level targets

Loudness is measured offline per sound (ITU BS.1770 K-weighting, momentary max), with SFX at their default volume.

| What | Target |
|---|---|
| Key moments (summon, clash, LIFE, crit, win, lose) | about −19 LUFS momentary |
| Mid cues (cast, land, turn, battle, heal, destroy) | 4–8 LU under the key moments |
| UI tick | about −40 LUFS |
| Music at its default volume | about −21 LUFS; key hits stay 6 LU or more above it |

The per-sound trims live in `TRIM` in `js/sfx.js`. Music output gain is set in `js/score.js`.

## The phone check

Most games are played on phone speakers, which give almost nothing under about 350 Hz. A sound made only of a sub-bass
thump disappears there. Each key sound is therefore checked twice: as rendered, and through a 350 Hz high-pass (a phone
speaker model). The loss between the two should stay small.

| Sound | Loss through the phone model, before → after (25 Nov 2026) |
|---|---|
| LIFE | 20.1 dB → 8.7 dB |
| crit (one LIFE left) | 38.1 dB → 10.1 dB |
| clash | 7.9 dB |
| summon | 3.6–5.5 dB |
| heal, destroy | under 1 dB |

Rule for new sounds: every low impact also gets a mid "body" (its 2nd–5th harmonics, or a short noise band at
400–1800 Hz) and a short transient between 1 and 3 kHz, so it is heard on a phone.

## Stacking

`Sfx.play` skips a repeat of the same sound within 50 ms, allows at most 3 copies in 0.35 s, and plays each later copy
at 1/√n. The flat 2D table spaces the sounds of one burst of events 120 ms apart and drops what would start more than
2.4 s late.

## Unlocking on phones

Browsers start audio only from a user gesture. Sound and music resume on `pointerdown`, `pointerup`, `touchend` and
`keydown`. On iPhone the silent switch mutes web audio.
