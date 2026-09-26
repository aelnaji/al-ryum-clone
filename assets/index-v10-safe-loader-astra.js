/* ==== AL RYUM @astra ==== Rebuilt via GPT-6 Astra (experientiallabs). CANDIDATE - disconnect: remove file + revert index.html src. */

/*
 * Drop-in module loader for the Al Ryum timeline bundle.
 * A shared promise prevents concurrent or repeated execution.
 */
const loaderKey = Symbol.for("alryum.index-v10-safe-loader");
const existingLoader = globalThis[loaderKey];

if (existingLoader) {
  await existingLoader;
} else {
  // Defer work until the shared promise has been published.
  const loader = Promise.resolve().then(async () => {
    const bundleURL = new URL(
      "/assets/index-v10-timeline.js?v=93",
      window.location.href
    );

    const FETCH_TIMEOUT_MS = 30000;
    const ASSET_TIMEOUT_MS = 15000;
    let objectURL;

    function waitForDOM() {
      if (document.readyState !== "loading") return Promise.resolve();

      return new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve, { once: true });
      });
    }

    function waitForPageAssets() {
      if (document.readyState === "complete") return Promise.resolve();

      return new Promise((resolve) => {
        let timer;

        function finish() {
          window.removeEventListener("load", finish);
          clearTimeout(timer);
          resolve();
        }

        window.addEventListener("load", finish, { once: true });
        timer = setTimeout(finish, ASSET_TIMEOUT_MS);
      });
    }

    function waitForImage(image) {
      if (image.complete) return decodeImage();

      return new Promise((resolve) => {
        let timer;

        function cleanup() {
          image.removeEventListener("load", loaded);
          image.removeEventListener("error", failed);
          clearTimeout(timer);
        }

        function loaded() {
          cleanup();
          resolve(decodeImage());
        }

        function failed() {
          cleanup();
          resolve();
        }

        image.addEventListener("load", loaded, { once: true });
        image.addEventListener("error", failed, { once: true });
        timer = setTimeout(failed, ASSET_TIMEOUT_MS);

        // Cover completion between the initial check and listener setup.
        if (image.complete) loaded();
      });

      function decodeImage() {
        if (!image.naturalWidth || typeof image.decode !== "function") {
          return Promise.resolve();
        }

        return bounded(Promise.resolve().then(() => image.decode()));
      }
    }

    function bounded(promise) {
      return new Promise((resolve) => {
        const timer = setTimeout(resolve, ASSET_TIMEOUT_MS);

        Promise.resolve(promise).then(
          () => {
            clearTimeout(timer);
            resolve();
          },
          () => {
            clearTimeout(timer);
            resolve();
          }
        );
      });
    }

    async function prepareAssets() {
      await waitForDOM();

      const pending = [
        waitForPageAssets(),
        ...Array.from(document.images, (image) => {
          // Off-screen lazy images must not hold startup hostage.
          if (image.loading === "lazy" && !image.complete) {
            return Promise.resolve();
          }
          return waitForImage(image);
        }),
      ];

      if (document.fonts && document.fonts.ready) {
        pending.push(bounded(document.fonts.ready));
      }

      await Promise.all(pending);
    }

    async function fetchSource() {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        FETCH_TIMEOUT_MS
      );

      try {
        const response = await fetch(bundleURL.href, {
          signal: controller.signal,
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error(`Preview bundle failed to load: ${response.status}`);
        }

        return await response.text();
      } finally {
        clearTimeout(timer);
      }
    }

    try {
      // Fetch in parallel, but never evaluate the bundle before readiness.
      const [source] = await Promise.all([fetchSource(), prepareAssets()]);

      const patched = source
        .replaceAll('L?L.story.quote:""', 'L&&L.story?L.story.quote:""')
        .replaceAll('L?L.story.author:""', 'L&&L.story?L.story.author:""');

      objectURL = URL.createObjectURL(
        new Blob([patched], { type: "text/javascript" })
      );

      await import(objectURL);
    } catch (error) {
      // Keep existing page content intact. Never retry automatically:
      // a failed import may already have installed listeners or started 3D.
      console.error("[Al Ryum] Timeline initialization failed safely.", error);
    } finally {
      if (objectURL) URL.revokeObjectURL(objectURL);
    }
  });

  Object.defineProperty(globalThis, loaderKey, {
    value: loader,
    writable: false,
    configurable: false,
    enumerable: false,
  });

  await loader;
}
