const response = await fetch("/assets/index-v10-timeline.js?v=22");
if (!response.ok) throw new Error(`Preview bundle failed to load: ${response.status}`);

const source = await response.text();
const patched = source
  .replaceAll('L?L.story.quote:""', 'L&&L.story?L.story.quote:""')
  .replaceAll('L?L.story.author:""', 'L&&L.story?L.story.author:""');

await import(URL.createObjectURL(new Blob([patched], { type: "text/javascript" })));
