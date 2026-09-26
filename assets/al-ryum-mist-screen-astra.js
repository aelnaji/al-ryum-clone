/* ==== AL RYUM @astra ==== leading mist screen (first screen, scrolls away to reveal original hero). CANDIDATE - disconnect: remove script from index + delete file. */

(() => {
  'use strict';

  if (window.__alryumMistScreen) return;
  window.__alryumMistScreen = true;

  const SECTION_ID = 'al-ryum-mist-screen';
  const VIDEO_SRC = '/assets/seamless-mist-loop.mp4';
  // Provide a static frame from the loop at this URL.
  const POSTER_SRC = '/assets/seamless-mist-loop-poster.jpg';

  function mount() {
    if (!document.body) {
      window.setTimeout(mount, 16);
      return;
    }

    if (document.getElementById(SECTION_ID)) return;

    const style = document.createElement('style');
    style.textContent = `
      #${SECTION_ID} {
        position: relative;
        display: block;
        box-sizing: border-box;
        width: 100%;
        height: 100vh;
        height: 100svh;
        margin: 0;
        padding: 0;
        overflow: hidden;
        z-index: 1;
        isolation: isolate;
        background-color: #080c10;
      }

      #${SECTION_ID} > .al-ryum-mist-video,
      #${SECTION_ID} > .al-ryum-mist-still {
        position: absolute;
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
        margin: 0;
        border: 0;
        object-fit: cover;
        object-position: center;
        pointer-events: none;
      }

      #${SECTION_ID} > .al-ryum-mist-video {
        opacity: 1;
        background-color: #080c10;
      }

      #${SECTION_ID} > .al-ryum-mist-still {
        opacity: 0.45;
      }

      #${SECTION_ID} > [hidden] {
        display: none !important;
      }

      @media (prefers-reduced-motion: reduce) {
        #${SECTION_ID} > .al-ryum-mist-video {
          display: none !important;
        }
      }
    `;

    const section = document.createElement('section');
    section.id = SECTION_ID;
    section.setAttribute('aria-hidden', 'true');

    const still = document.createElement('img');
    still.className = 'al-ryum-mist-still';
    still.alt = '';
    still.decoding = 'async';
    still.draggable = false;
    still.src = POSTER_SRC;

    // If the poster is unavailable, retain the opaque dark background.
    still.addEventListener('error', () => {
      still.style.visibility = 'hidden';
    });

    const video = document.createElement('video');
    video.className = 'al-ryum-mist-video';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = false;
    video.preload = 'none';
    video.poster = POSTER_SRC;
    video.tabIndex = -1;
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.hidden = true;

    const motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    let playbackAttempt = 0;

    function showStill() {
      video.hidden = true;
      still.hidden = false;
    }

    function applyMotionPreference() {
      const attempt = ++playbackAttempt;

      if (motionPreference.matches) {
        video.autoplay = false;
        video.removeAttribute('autoplay');
        video.pause();
        showStill();
        return;
      }

      video.muted = true;
      video.autoplay = true;
      video.setAttribute('autoplay', '');
      video.preload = 'auto';
      video.hidden = false;
      still.hidden = true;

      if (!video.hasAttribute('src')) {
        video.src = VIDEO_SRC;
      }

      try {
        const playback = video.play();

        if (playback && typeof playback.catch === 'function') {
          playback.catch(() => {
            if (attempt === playbackAttempt) showStill();
          });
        }
      } catch (_) {
        if (attempt === playbackAttempt) showStill();
      }
    }

    video.addEventListener('error', showStill);
    video.addEventListener('playing', () => {
      if (motionPreference.matches) {
        video.pause();
        showStill();
        return;
      }

      video.hidden = false;
      still.hidden = true;
    });

    section.append(still, video);

    // Install styling before insertion to prevent an unstyled first frame.
    (document.head || document.documentElement).appendChild(style);

    // A standalone first flow block; #root and the cinematic remain untouched.
    document.body.prepend(section);

    if (typeof motionPreference.addEventListener === 'function') {
      motionPreference.addEventListener('change', applyMotionPreference);
    } else {
      motionPreference.addListener(applyMotionPreference);
    }

    applyMotionPreference();
  }

  mount();
})();
