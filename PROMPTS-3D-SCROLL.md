# Al Ryum Group — 3D Scroll Cinematic: Video-Generation Prompt Catalog (Moto-Card Style)

> **Style target:** `moto-card.com` — premium, dark + gold, quiet-luxury, one
> continuous camera move per 5-second clip, so each one scrubs perfectly on scroll.
>
> **How it works in the site:** each generated video is converted to a WebP frame
> sequence (`frame_0001.webp … frame_00NN.webp`) and dropped into a folder. A pinned
> `ScrollTrigger` scrubs through those frames as the user scrolls — forward *and*
> reverse. So the prompt's #1 job is a **smooth, continuous, single-direction camera
> move** with no cuts, no text, no people. The video is a camera path, not a story.

---

## The moto-card look in one line

Dark near-black backdrop · single spotlight · brushed metal/marble/glass materials ·
gold-bronze rim light · macro depth of field · **one slow camera move, no cuts,
no text, no people**.

---

## Master formula (paste + fill brackets)

```
[SUBJECT] in [MATERIAL], photorealistic macro/wide cinematic shot.
Dark near-black studio backdrop, single soft spotlight, gold-bronze rim light.
The camera [ONE CAMERA MOVE] [DIRECTION], slow and steady, 5 seconds, no cuts.
Shallow depth of field, subtle reflections, volumetric light, lens: [LENS].
Nothing moves except the camera — no people, no text, no logos,
no morphing, no flicker. Style: ultra-premium quiet-luxury film, dark charcoal
and gold grade.
```

### 4 camera moves (pick ONE per clip)

| Move | Phrase |
|---|---|
| **Push-in** | "slowly dollies forward toward…" |
| **Pull-back reveal** | "pulls back and up, revealing…" |
| **Orbit** | "orbits slowly around…" |
| **Lateral track** | "tracks laterally, gliding past…" |

---

## The clips to generate

### 1. HERO — "BUILT FOR MODERN WEALTH" equivalent
Subject: Al Ryum's signature — **desert transforming into a lush green garden** (their
core business is landscaping).

```
A barren desert landscape transforming into a lush manicured garden with
reflecting pools and palm boulevards, photorealistic, cinematic wide shot.
The camera slowly flies forward at low altitude down the central water axis,
slow and steady, 5 seconds, no cuts. Volumetric golden light, soft haze,
shallow depth of field, lens: 35mm anamorphic.
Nothing moves except the camera — no people, no text, no logos, no morphing.
Style: ultra-premium quiet-luxury film, dark charcoal and gold grade.
```

**Image ref:** first frame of `assets/hero-garden-full.mp4`.

### 2. PROJECT OBJECT — golden architectural model (the "card" moment)
Moto-card's hero is a **single object rotating in 3D**. Mirror that with a golden
building model.

```
A miniature golden architectural model of a modern Abu Dhabi landmark on a dark
polished marble surface, photorealistic, macro cinematic shot.
The camera orbits slowly around the model, keeping it centered, gold light
sweeping across the facade, slow and steady, 5 seconds, no cuts.
Shallow depth of field, soft reflections, lens: 50mm macro.
Nothing moves except the camera — no people, no text, no logos, no morphing.
Style: premium product film, dark charcoal and gold grade.
```

### 3. PROJECT — Louvre Abu Dhabi dome
```
The Louvre Abu Dhabi dome, geometric star-lattice roof filtering shafts of light
onto still water, photorealistic, cinematic.
The camera slowly dollies forward beneath the dome toward the light,
slow and steady, 5 seconds, no cuts. Volumetric beams, soft haze,
shallow depth of field, lens: 24mm.
Nothing moves except the camera — no people, no text, no logos, no morphing.
Style: quiet-luxury architectural film, dark teal and gold grade.
```

### 4. PROJECT — Zayed National Museum
```
Zayed National Museum, sculptural curved steel wings over a landscaped plaza,
photorealistic, cinematic.
The camera pulls back and rises, revealing the full building, slow and steady,
5 seconds, no cuts. Volumetric late-afternoon light, soft haze, lens: 32mm.
Nothing moves except the camera — no people, no text, no logos, no morphing.
Style: museum architectural film, muted sand and gold grade.
```

### 5. PROJECT — Emirates Palace
```
Emirates Palace, grand golden facade and domes, photorealistic, cinematic wide shot.
The camera pushes forward along the approach boulevard toward the central dome,
slow and steady, 5 seconds, no cuts. Warm golden light, soft haze, lens: 35mm anamorphic.
Nothing moves except the camera — no people, no text, no logos, no morphing.
Style: opulent quiet-luxury film, rich gold and charcoal grade.
```

---

## B-roll / macro loops (what makes moto-card feel expensive)
Extreme macro "material" shots that go between sections:

```
[1] Close-up of brushed gold metal with a thin light streak sweeping across it,
    dark background, 5 seconds, no cuts, macro, no text.
[2] Slow-motion water rippling on dark marble, single gold reflection,
    5 seconds, no cuts, macro, no text.
[3] Rain of light through a geometric lattice onto dark stone,
    5 seconds, no cuts, macro, no text.
[4] Palm fronds swaying against a dark dusk sky, single rim light,
    5 seconds, no cuts, cinematic, no text.
[5] Desert sand drifting across black stone, gold backlight,
    5 seconds, no cuts, macro, no text.
```

---

## Hard rules (every single clip)

- **One** camera move, **one** direction. Never "zooms in and out" or "reverses".
- `"5 seconds, no cuts"` in every prompt.
- `"no people, no text, no logos, no morphing, no flicker"` in every prompt.
- Name a lens (24/32/35/50mm) + a grade (`dark charcoal and gold`).
- Image ref = the **first frame** of that shot.

---

## Output → site wiring (what I need back)

Export each clip to WebP frames and drop them in:

| Clip | Folder | Used by |
|---|---|---|
| Hero | `assets/frames/hero/` | `index-v10-scrub.js` |
| Golden model (b-roll) | `assets/frames/object/` | new section |
| Louvre | `assets/frames/louvre/` | `al-ryum-cinematic.js` |
| Zayed | `assets/frames/zayed/` | `al-ryum-cinematic.js` |
| Emirates | `assets/frames/emirates/` | `al-ryum-cinematic.js` |

> Convert video → frames at https://ezgif.com/video-to-webp. Name them
> `frame_0001.webp … frame_00NN.webp`. The scrub scripts auto-detect the frame
> count, so you only need to drop the folder and refresh.
