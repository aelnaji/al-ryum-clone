# Al Ryum Group — 3D Scroll Cinematic: Video-Generation Prompt Catalog

> **Purpose:** Generate the short clips (5s, one image ref) that get scrub-scrolled
> into the site as pinned cinematic films — the same effect as **moto-card.com** and
> **void.sbs** (scroll-driven camera moves through pre-rendered frames).
>
> **How it works in the site:** each generated video is converted to a WebP frame
> sequence (`frame_0001.webp … frame_00NN.webp`) and dropped into a folder. A pinned
> `ScrollTrigger` scrubs through those frames as the user scrolls — forward *and*
> reverse. So the prompt's #1 job is a **smooth, continuous, single-direction camera
> move** with no cuts, no text, no sudden objects. The video is a camera path, not a
> narrative edit.

---

## 1. The one master prompt formula

Paste this skeleton and fill the `[BRACKETS]`. This is the exact structure the free
tools (Veo/Flow, Kling, Hailuo/MiniMax, Runway, Pika, Luma, Sora) respond to best
for image-to-video.

```
[SUBJECT] with [MATERIAL/DETAIL], photorealistic, cinematic wide shot.
The camera [CAMERA MOVE] through/around the subject, slow and steady,
5 seconds, no cuts. Volumetric golden-hour light, soft atmospheric haze,
shallow depth of field, lens: [LENS].
The scene is completely still except for the single camera move —
no people walking, no text, no logos, no morphing, no flicker.
Style: [STYLE], [COLOR GRADE] grade.
```

### The 4 camera moves that read best on scroll

| Move | Prompt phrase | Feels like |
|---|---|---|
| **Push-in (dolly)** | "the camera slowly dollies forward toward…" | Entering a project |
| **Pull-back (reveal)** | "the camera pulls back and up, revealing…" | Grand reveal |
| **Orbit / arc** | "the camera orbits around…" | 3D product feel |
| **Lateral track** | "the camera tracks laterally, gliding past…" | Sideways cinematic |

> **Rule of thumb:** one clip = one move. Scrub animation looks broken when a clip
> reverses mid-flight, so forbid "then the camera reverses".

---

## 2. The Al Ryum projects to cover

These are the real projects already in the site (from `al-ryum-cinematic.js` and
`assets/frames/`). Generate one clip per project, plus the hero. Each clip = one
pinned scroll film.

---

### HERO — "Shape the future" garden flyover
**Image ref:** a lush desert-greened landscaped garden / palm boulevard at dusk
(Abu Dhabi). Use `assets/hero-garden-full.mp4`'s first frame as the ref.

**Primary prompt:**
```
A vast luxury landscaped garden and palm boulevard in Abu Dhabi at golden hour,
photorealistic, cinematic wide establishing shot.
The camera slowly flies forward at low altitude down the central water axis,
gliding over reflecting pools and manicured palms, slow and steady, 5 seconds, no cuts.
Volumetric golden light, soft atmospheric haze, shallow depth of field, lens: 35mm anamorphic.
The scene is completely still except for the single forward camera move —
no people walking, no text, no logos, no morphing, no flicker.
Style: ultra-premium architectural film, warm amber and teal grade.
```

**Alternative (pull-back reveal):**
```
… The camera pulls back and up from the water feature, revealing the full garden
and a distant Abu Dhabi skyline, slow and steady, 5 seconds, no cuts. …
```

---

### PROJECT 1 — Louvre Abu Dhabi
**Image ref:** the Louvre dome's geometric "rain of light" lattice over water.

**Prompt:**
```
The Louvre Abu Dhabi dome, geometric star lattice roof filtering shafts of light
onto still water, photorealistic, cinematic.
The camera slowly dollies forward beneath the dome toward the light, gliding low
over the reflecting pool, slow and steady, 5 seconds, no cuts.
Volumetric light beams, soft haze, shallow depth of field, lens: 24mm.
The scene is completely still except for the single forward camera move —
no people, no text, no logos, no morphing, no flicker.
Style: architectural masterpiece film, cool teal and warm amber grade.
```

**Alternative (orbit):**
```
… The camera orbits slowly around the dome, keeping it centered, revealing the
lattice geometry from every angle, 5 seconds, no cuts. …
```

---

### PROJECT 2 — Zayed National Museum
**Image ref:** the museum's curved wing/tower architecture over landscaped plaza.

**Prompt:**
```
Zayed National Museum, sculptural curved steel wings rising from a landscaped
Abu Dhabi plaza, photorealistic, cinematic.
The camera pulls back and rises, revealing the full building and its reflecting
pools and palms, slow and steady, 5 seconds, no cuts.
Volumetric late-afternoon light, soft haze, shallow depth of field, lens: 32mm.
The scene is completely still except for the single pull-back camera move —
no people, no text, no logos, no morphing, no flicker.
Style: museum architecture film, muted sand and teal grade.
```

**Alternative (lateral track):**
```
… The camera tracks laterally, gliding past the building's wings and reflecting
facade, 5 seconds, no cuts. …
```

---

### PROJECT 3 — Emirates Palace
**Image ref:** the palace's grand golden facade and domes.

**Prompt:**
```
Emirates Palace hotel, grand golden facade and domes, photorealistic, cinematic wide shot.
The camera slowly pushes forward along the approach boulevard toward the central
dome, gliding past fountains and palms, slow and steady, 5 seconds, no cuts.
Warm golden-hour light, soft haze, shallow depth of field, lens: 35mm anamorphic.
The scene is completely still except for the single forward camera move —
no people, no text, no logos, no morphing, no flicker.
Style: opulent architectural film, rich gold and emerald grade.
```

---

### TRANSITION — Corniche → Legoland (first/last-shot, Veo Flow)
This one uses the **first-frame + last-frame** mode (already scaffolded in the repo
via `corniche-legoland.js` and `flow-frames/start-corniche.png` + `end-legoland.png`).
A transition clip interpolates between the two pinned frames.

**Prompt:**
```
A continuous architectural flythrough that begins on the Abu Dhabi Corniche
waterfront promenade and ends at the Legoland theme park entrance, photorealistic.
The camera glides in one smooth, unbroken motion from the corniche, over the city,
toward the Legoland park entrance, 5 seconds, no cuts, no text, no morphing.
Style: travel flythrough film, warm cinematic grade.
```
> For this one, pass **both** `flow-frames/start-corniche.png` (first) and
> `flow-frames/end-legoland.png` (last) as the two reference frames.

---

## 3. Global "do / don't" for every prompt

**Do:**
- "photorealistic, cinematic" in every prompt
- name a lens (24/32/35mm anamorphic)
- "5 seconds, no cuts"
- "single camera move", named explicitly (dolly / pull-back / orbit / track)
- "no people, no text, no logos, no morphing, no flicker"
- a color grade ("amber + teal" is the site's brand palette)

**Don't:**
- don't ask for cuts, jump cuts, or multiple shots
- don't ask for text/titles/watermarks (they bake in and ruin the scrub)
- don't ask for "camera reverses", "zooms in and out", or "pans back and forth"
- don't ask for crowds, hands, or faces (artifacts on scrub)
- don't mix two camera moves in one 5s clip

---

## 4. Output → site wiring (what I need back)

After you generate each clip, export it as WebP frames and drop them in:

| Clip | Folder | Used by |
|---|---|---|
| Hero | `assets/frames/hero/` | `index-v10-scrub.js` (or new hero film) |
| Louvre | `assets/frames/louvre/` | `al-ryum-cinematic.js` |
| Zayed | `assets/frames/zayed/` | `al-ryum-cinematic.js` |
| Emirates | `assets/frames/emirates/` | `al-ryum-cinematic.js` |
| Corniche→Legoland | `assets/frames/corniche-legoland/` | `corniche-legoland.js` |

> Convert video → frames at https://ezgif.com/video-to-webp (the repo README already
> uses this). Name them `frame_0001.webp … frame_00NN.webp`. The scrub scripts
> auto-detect the frame count, so you only need to drop the folder and refresh.
