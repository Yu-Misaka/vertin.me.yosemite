/**
 * The night behind the anchors room.
 *
 * Stars are generated from a fixed seed so every visit opens the same sky: a
 * room you can recognise, not a particle effect. The field is deliberately
 * sparse — a few hundred points, small, almost still. It lives on its own
 * canvas behind the works and drifts only at a fraction of the camera's speed,
 * which is what makes the works feel near and the dark feel far.
 */

export const SKY_SEED = 0x5eed1a;
export const SKY_COOL = '#e8e4dc';
export const SKY_WARM = '#d8c9ae';

/** Small deterministic PRNG; the sky must not reshuffle between visits. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A star's opacity at `elapsed` ms after the room opened. `born` staggers the
 * arrival (near stars first, bright ones later) and `rise` is the eye adapting.
 */
export function starAlpha(star, elapsed) {
  const age = elapsed - star.born;
  if (age <= 0) return 0;
  const rise = Math.min(1, age / star.rise);
  const wave = 0.5 + 0.5 * Math.sin((elapsed / star.period) * Math.PI * 2 + star.phase);
  return star.base * rise * (1 - star.amp * wave);
}

export function makeStars({ width, height, density = 130, seed = SKY_SEED }) {
  const random = mulberry32(seed);
  const area = Math.max(1, width * height);
  const total = Math.max(70, Math.min(320, Math.round((area / (1440 * 900)) * density)));
  const bright = Math.max(4, Math.round(total * 0.14));
  const count = total - bright;
  const stars = [];

  for (let index = 0; index < total; index += 1) {
    const isBright = index >= count;
    const warm = random() < 0.02;
    stars.push({
      x: random() * width,
      y: random() * height,
      radius: isBright ? 1.7 + random() * 0.8 : 0.45 + random() * 1.05,
      base: isBright ? 0.5 + random() * 0.18 : 0.1 + random() * 0.3,
      amp: 0.12 + random() * 0.1,
      period: 4000 + random() * 5000,
      phase: random() * Math.PI * 2,
      warm,
      halo: isBright && random() < 0.55,
      // The near field arrives first; bright stars follow, and the last of
      // them has faded in by about four seconds.
      born: isBright ? 1200 + random() * 1100 : 700 + Math.pow(random(), 1.5) * 1400,
      rise: isBright ? 800 + random() * 900 : 800 + random() * 1000
    });
  }
  return stars;
}

/**
 * Canvas wrapper. `still` renders a single, already-risen sky: reduced-motion
 * visitors get the room without a twinkling screen.
 */
export function createSky(canvas, { still = false } = {}) {
  const context = canvas.getContext('2d');
  let stars = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let startedAt = 0;
  let lastDrawn = 0;
  let playing = false;

  function draw(elapsed) {
    context.clearRect(0, 0, width, height);
    for (const star of stars) {
      const alpha = starAlpha(star, elapsed) * (still ? 0.6 : 1);
      if (alpha <= 0.004) continue;
      context.globalAlpha = Math.min(1, alpha);
      context.fillStyle = star.warm ? SKY_WARM : SKY_COOL;
      if (star.halo) {
        const glow = context.createRadialGradient(star.x, star.y, 0, star.x, star.y, 11);
        glow.addColorStop(0, star.warm ? 'rgb(216 201 174 / 28%)' : 'rgb(232 228 220 / 22%)');
        glow.addColorStop(1, 'rgb(0 0 0 / 0%)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(star.x, star.y, 11, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = star.warm ? SKY_WARM : SKY_COOL;
      }
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function tick(now) {
    frame = 0;
    if (!playing) return;
    // Twinkle is slow: thirty frames a second is indistinguishable and leaves
    // the main thread to the camera.
    if (now - lastDrawn >= 33) {
      lastDrawn = now;
      draw(now - startedAt);
    }
    frame = requestAnimationFrame(tick);
  }

  return {
    layout(viewport, pad) {
      width = Math.round(viewport.width + pad * 2);
      height = Math.round(viewport.height + pad * 2);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.left = `${-pad}px`;
      canvas.style.top = `${-pad}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars({ width, height });
      draw(still ? 6000 : playing ? performance.now() - startedAt : 0);
    },

    play() {
      playing = true;
      startedAt = performance.now();
      lastDrawn = 0;
      if (still) {
        draw(6000);
        return;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    },

    pause() {
      playing = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      context.clearRect(0, 0, width, height);
    },

    /** Stop drawing without forgetting where the night had got to. */
    sleep() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },

    wake() {
      if (playing && !still && !frame) frame = requestAnimationFrame(tick);
    }
  };
}
