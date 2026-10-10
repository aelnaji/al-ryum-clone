# Al Ryum Group website — www.alryum.com

A static site: no build step and no server code. Upload the whole folder to the
web root of any static host.

## Hosting
- **Direct links** such as `/about` or `/projects/3` must open the app:
  - Apache, cPanel or LiteSpeed: `.htaccess` already handles this.
  - Other hosts: they serve `404.html`, which hands the path back to the app.
  - Nginx: add `try_files $uri $uri/ /index.html;` instead.
- **Search engines**: `robots.txt` and `sitemap.xml` point to `https://www.alryum.com`.
- **Sharing**: link previews use `assets/og-image.jpg`.

## Contact form
Set in `index.html`:

```html
<script>window.alRyumForm = { endpoint: "", accessKey: "" };</script>
```

- **Empty**: the form opens the visitor's email app with the message addressed to
  alryum@alryum.com.
- **Web3Forms**: set `endpoint: "https://api.web3forms.com/submit"` and
  `accessKey: "<key>"`. Messages then go straight to the inbox the key belongs to.
- **Formspree**: set `endpoint: "https://formspree.io/f/<form id>"` and leave
  `accessKey` empty.

## Media
- **Project films**: frame strips in `assets/projects/<film>/frames/`, wired in
  `assets/al-ryum-project-films-astra.js`.
- **4K masters**: kept in `assets/cinematic-4k/` for future re-cuts. No page loads them.
- **Landing hero**: 142 frames in `assets/hero-0817-astra/`, wired in
  `assets/al-ryum-final-cinematic-astra.js`.
- **Garden video** ("Who we are", after the hero): `assets/garden-film.webm`,
  `assets/garden-film.mp4` and `assets/garden-film-poster.webp`.
- **After changing a file**, bump its `?v=` number where it is referenced, so
  browsers fetch the new copy.
