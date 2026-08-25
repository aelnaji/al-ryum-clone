// Load the compiled application and make its static assets work both locally and
// when the site is served from the /al-ryum-clone/ GitHub Pages subdirectory.
const response = await fetch(new URL("index-v10-timeline.js?v=30", import.meta.url));
if (!response.ok) throw new Error(`Preview bundle failed to load: ${response.status}`);

const source = await response.text();
const patched = source
  .replaceAll('L?L.story.quote:""', 'L&&L.story?L.story.quote:""')
  .replaceAll('L?L.story.author:""', 'L&&L.story?L.story.author:""')
  .replaceAll('"/assets/hero-garden-full.mp4', '"https://media.githubusercontent.com/media/aelnaji/al-ryum-clone/main/assets/hero-garden-full.mp4')
  .replaceAll('"/assets/', '"assets/')
  .replaceAll("'/assets/", "'assets/");

await import(URL.createObjectURL(new Blob([patched], { type: "text/javascript" })));
