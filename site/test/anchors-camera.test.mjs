import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampCamera,
  boundsForPose,
  centrePose,
  cropForFrame,
  fitScale,
  labelPlacement,
  largestLabel,
  litWork,
  poseForRect,
  projectRect,
  screenToWorld,
  tweenPose,
  visibleFraction,
  worldToScreen,
  zoomAt
} from '../src/scripts/anchors-camera.mjs';

const viewport = { width: 1440, height: 900 };
const camera = { x: 0, y: 0, scale: 0.635 };

test('screen and world conversions are inverses', () => {
  const point = { x: 1200, y: 210 };
  const world = screenToWorld(camera, viewport, point);
  const screen = worldToScreen(camera, viewport, world);
  assert.ok(Math.abs(screen.x - point.x) < 1e-9);
  assert.ok(Math.abs(screen.y - point.y) < 1e-9);
});

test('the world point under the viewport centre is the camera', () => {
  const centre = screenToWorld(camera, viewport, { x: 720, y: 450 });
  assert.equal(centre.x, camera.x);
  assert.equal(centre.y, camera.y);
});

test('a work rect projects at the camera scale', () => {
  const rect = { x: -569, y: -320, w: 1138, h: 640 };
  const box = projectRect(camera, viewport, rect);
  assert.equal(box.x, 720 - 569 * camera.scale);
  assert.equal(box.y, 450 - 320 * camera.scale);
  assert.equal(box.w, 1138 * camera.scale);
  assert.equal(box.h, 640 * camera.scale);
});

test('the entry pose keeps the cover exactly where the page drew it', () => {
  // The page crops covers to a 1.9:1 frame, so the 16:9 artwork is wider than
  // the frame is tall: the room matches the frame's width and centre, then
  // opens the crop to reveal the whole work.
  const work = { x: -569, y: -320, w: 1138, h: 640 };
  const frame = { x: 350, y: 50, w: 713, h: 350 };
  const scale = frame.w / work.w;
  const pose = poseForRect(work, frame, viewport, scale);
  const box = projectRect(pose, viewport, work);
  assert.ok(Math.abs(box.x - frame.x) < 1e-9);
  assert.ok(Math.abs(box.w - frame.w) < 1e-9);
  assert.ok(Math.abs(box.x + box.w / 2 - (frame.x + frame.w / 2)) < 1e-9);
  assert.ok(Math.abs(box.y + box.h / 2 - (frame.y + frame.h / 2)) < 1e-9);
  const crop = (box.h - frame.h) / 2;
  assert.ok(Math.abs(crop - (640 * 713 / 1138 - 350) / 2) < 1e-9, 'the crop that opens is the banner trim');
});

test('the entry aperture matches the page while retaining the current hover paint', () => {
  const work = { x: -569, y: -320, w: 1138, h: 640 };
  for (const width of [342, 713, 1100]) {
    for (const hover of [1, 1.006, 1.015]) {
      const frame = { x: 350, y: 50, w: width, h: width / 1.9 };
      const paint = {
        x: frame.x - width * (hover - 1) / 2,
        y: frame.y - frame.h * (hover - 1) / 2,
        w: width * hover,
        h: frame.h * hover
      };
      const scale = paint.w / work.w;
      const pose = poseForRect(work, paint, viewport, scale);
      const projected = projectRect(pose, viewport, work);
      const crop = cropForFrame(projected, frame, scale);
      const aperture = {
        x: projected.x + crop.left * scale,
        y: projected.y + crop.top * scale,
        w: projected.w - (crop.left + crop.right) * scale,
        h: projected.h - (crop.top + crop.bottom) * scale
      };
      for (const key of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(aperture[key] - frame[key]) < 1e-9);
      assert.ok(Math.abs(projected.w - paint.w) < 1e-9, 'the paint never shrinks back to the unhovered frame');
    }
  }
});

test('an off-centre painted image keeps asymmetric frame insets', () => {
  const projected = { x: 90, y: 20, w: 800, h: 450 };
  const frame = { x: 108, y: 51, w: 760, h: 350 };
  const crop = cropForFrame(projected, frame, 0.6);
  assert.ok(Math.abs(projected.x + crop.left * 0.6 - frame.x) < 1e-9);
  assert.ok(Math.abs(projected.y + crop.top * 0.6 - frame.y) < 1e-9);
  assert.ok(Math.abs(projected.w - (crop.left + crop.right) * 0.6 - frame.w) < 1e-9);
  assert.ok(Math.abs(projected.h - (crop.top + crop.bottom) * 0.6 - frame.h) < 1e-9);
});

test('centring lifts the work clear of the label', () => {
  const rect = { x: 100, y: 200, w: 1000, h: 500 };
  const pose = centrePose(rect, 0.6, 40);
  const box = projectRect(pose, viewport, rect);
  assert.ok(Math.abs(box.x + box.w / 2 - 720) < 1e-9);
  assert.ok(Math.abs(box.y + box.h / 2 - (450 - 40)) < 1e-9);
});

test('zooming keeps the cursor anchored to the same world point', () => {
  const anchor = { x: 1010, y: 260 };
  const before = screenToWorld(camera, viewport, anchor);
  const zoomed = zoomAt(camera, viewport, anchor, 1.1);
  const after = screenToWorld(zoomed, viewport, anchor);
  assert.ok(Math.abs(after.x - before.x) < 1e-9);
  assert.ok(Math.abs(after.y - before.y) < 1e-9);
  assert.equal(zoomed.scale, 1.1);
});

test('fit scale shows all the works with a margin', () => {
  const content = { x: -569, y: -420, w: 4764, h: 1810 };
  const scale = fitScale(content, viewport, 0.06);
  assert.ok(content.w * scale <= viewport.width);
  assert.ok(content.h * scale <= viewport.height);
  assert.ok(Math.abs(content.w * scale - viewport.width / 1.12) < 1e-6);
});

test('the camera cannot wander far from the works', () => {
  const content = { x: -569, y: -420, w: 4764, h: 1810 };
  const far = clampCamera({ x: 99999, y: -99999, scale: 0.635 }, viewport, content);
  const near = clampCamera({ x: 100, y: 100, scale: 0.635 }, viewport, content);
  assert.ok(far.x < 99999 && far.y > -99999);
  assert.deepEqual(near, { x: 100, y: 100, scale: 0.635 }, 'a pose inside the room is untouched');
  const halfW = viewport.width / 0.635 / 2;
  const slackX = viewport.width / 0.635 * 0.45;
  assert.ok(far.x <= content.x + content.w - halfW + slackX + 1e-9);
});

test('zoomed out, the camera settles on the content centre', () => {
  const content = { x: -100, y: -100, w: 200, h: 200 };
  const pose = clampCamera({ x: 5000, y: 5000, scale: 0.05 }, viewport, content);
  assert.equal(pose.x, 0);
  assert.equal(pose.y, 0);
});

test('tweening lands exactly and interpolates the scale geometrically', () => {
  const from = { x: 0, y: 0, scale: 0.5 };
  const to = { x: 400, y: -200, scale: 1.5 };
  assert.deepEqual(tweenPose(from, to, 0), from);
  assert.deepEqual(tweenPose(from, to, 1), to);
  const half = tweenPose(from, to, 0.5);
  assert.equal(half.x, 200);
  assert.equal(half.y, -100);
  assert.ok(Math.abs(half.scale - Math.sqrt(0.75)) < 1e-9);
  const overshoot = tweenPose(from, to, 2);
  assert.deepEqual(overshoot, to);
});

test('visible fraction counts only the part inside the viewport', () => {
  const rect = { x: 0, y: 0, w: 1000, h: 500 };
  assert.equal(visibleFraction({ x: 500, y: 250, scale: 1 }, viewport, rect), 1);
  const half = visibleFraction({ x: 1000, y: 250, scale: 1 }, viewport, rect);
  assert.ok(Math.abs(half - 0.72) < 1e-9, 'only the 720px left inside the viewport counts');
  assert.equal(visibleFraction({ x: 5000, y: 5000, scale: 1 }, viewport, rect), 0);
});

test('the lit work follows what the camera is looking at', () => {
  const rects = [
    { x: -569, y: -320, w: 1138, h: 640 },
    { x: 1278, y: -420, w: 1244, h: 700 }
  ];
  assert.equal(litWork(camera, viewport, rects), 0);
  assert.equal(litWork({ x: 1900, y: -70, scale: 0.635 }, viewport, rects), 1);
  assert.equal(litWork({ x: 9000, y: 9000, scale: 0.2 }, viewport, rects), -1, 'the empty dark lights nothing');
});

test('the entry pose is never clamped away from the cover', () => {
  // A cover low on a tall page puts the camera below the room's usual range.
  const content = { x: -569, y: -420, w: 6754, h: 900 };
  const pose = { x: -21, y: -540, scale: 0.638 };
  const bounds = boundsForPose(content, pose, { width: 834, height: 1112 });
  assert.deepEqual(clampCamera(pose, { width: 834, height: 1112 }, bounds), pose);
  assert.ok(bounds.y < content.y, 'bounds only ever grow');
  assert.ok(bounds.h > content.h);
});

const labelSize = { w: 200, h: 140 };
const bigViewport = { width: 1000, height: 700 };

test('the label stands beside the work, bottom aligned, when the wall is clear', () => {
  const rect = { x: 100, y: 100, w: 400, h: 220 };
  const placed = labelPlacement({ size: labelSize, rect, viewport: bigViewport });
  assert.equal(placed.x, 530);
  assert.equal(placed.y, 180);
});

test('it steps to the other side rather than onto a neighbouring work', () => {
  const rect = { x: 300, y: 100, w: 300, h: 220 };
  const neighbour = { x: 620, y: 80, w: 300, h: 260 };
  const placed = labelPlacement({ size: labelSize, rect, obstacles: [neighbour], viewport: bigViewport });
  assert.equal(placed.x, 70, 'left of the work, clear of the neighbour');
});

test('it drops below when both sides are taken', () => {
  const rect = { x: 300, y: 100, w: 300, h: 200 };
  const obstacles = [
    { x: 610, y: 60, w: 300, h: 280 },
    { x: 0, y: 60, w: 290, h: 200 }
  ];
  const placed = labelPlacement({ size: labelSize, rect, obstacles, viewport: bigViewport });
  assert.equal(placed.y, 330);
  assert.equal(placed.x, 300);
});

test('it keeps clear of the exit and the index', () => {
  const rect = { x: 380, y: 120, w: 240, h: 180 };
  const chrome = [
    { x: 12, y: 12, w: 110, h: 44 },
    { x: 12, y: 620, w: 180, h: 50 }
  ];
  const placed = labelPlacement({ size: labelSize, rect, obstacles: chrome, viewport: bigViewport });
  const box = { x: placed.x, y: placed.y, w: labelSize.w, h: labelSize.h };
  for (const obstacle of chrome) {
    const overlap = box.x < obstacle.x + obstacle.w && box.x + box.w > obstacle.x &&
      box.y < obstacle.y + obstacle.h && box.y + box.h > obstacle.y;
    assert.equal(overlap, false);
  }
});

test('a room with no spot for a label gets no label', () => {
  const viewport = { width: 700, height: 500 };
  const rect = { x: 0, y: 0, w: 700, h: 500 };
  assert.equal(labelPlacement({ size: labelSize, rect, obstacles: [rect], viewport }), null);

  const tight = { width: 520, height: 420 };
  const work = { x: 8, y: 60, w: 504, h: 300 };
  assert.equal(labelPlacement({ size: labelSize, rect: work, viewport: tight }), null,
    'both sides are off the screen and below has no room');
});

test('the label never covers a work when any clear spot exists', () => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1158, height: 726 },
    { width: 1024, height: 768 },
    { width: 900, height: 600 }
  ];
  const rects = [
    { x: 200, y: 120, w: 300, h: 170 },
    { x: 520, y: 200, w: 260, h: 150 },
    { x: 120, y: 380, w: 420, h: 220 }
  ];
  for (const viewport of viewports) {
    for (const rect of rects) {
      const others = rects.filter(other => other !== rect);
      const placed = labelPlacement({ size: labelSize, rect, obstacles: others, viewport });
      if (!placed) continue;
      const box = { x: placed.x, y: placed.y, w: labelSize.w, h: labelSize.h };
      const covered = others.some(other =>
        box.x < other.x + other.w && box.x + box.w > other.x &&
        box.y < other.y + other.h && box.y + box.h > other.y);
      assert.equal(covered, false, `covered a work at ${viewport.width}x${viewport.height}`);
    }
  }
});

test('the label shrinks continuously as the wall closes in', () => {
  const work = { x: 0, y: 138, w: 798, h: 449 };
  const size = { w: 220, h: 187 };
  const scales = [];
  for (let width = 1160; width <= 1360; width += 10) {
    const rect = { ...work, x: (width - work.w) / 2 };
    const placed = largestLabel({ size, rect, viewport: { width, height: 726 } });
    assert.ok(placed, `no label at ${width}`);
    scales.push(placed.scale);
  }
  for (let index = 1; index < scales.length; index += 1) {
    assert.ok(scales[index] >= scales[index - 1] - 1e-9, 'a wider room never needs a smaller label');
    assert.ok(scales[index] - scales[index - 1] < 0.06, 'no visible steps between widths');
  }
});

test('the solved label never covers anything and never exceeds its bounds', () => {
  const size = { w: 220, h: 187 };
  const obstacles = [{ x: 900, y: 100, w: 300, h: 400 }];
  for (let width = 1100; width <= 1500; width += 25) {
    const rect = { x: width / 2 - 300, y: 150, w: 600, h: 340 };
    const placed = largestLabel({ size, rect, obstacles, viewport: { width, height: 800 }, min: 0.6, max: 1 });
    if (!placed) continue;
    assert.ok(placed.scale >= 0.6 - 1e-9 && placed.scale <= 1 + 1e-9);
    const box = { x: placed.x, y: placed.y, w: size.w * placed.scale, h: size.h * placed.scale };
    for (const obstacle of obstacles) {
      const overlap = box.x < obstacle.x + obstacle.w && box.x + box.w > obstacle.x &&
        box.y < obstacle.y + obstacle.h && box.y + box.h > obstacle.y;
      assert.equal(overlap, false);
    }
    assert.ok(box.x >= 18 - 1e-6 && box.y >= 18 - 1e-6);
    assert.ok(box.x + box.w <= width - 18 + 1e-6);
  }
});

test('with no room even for the smallest label, nothing is placed', () => {
  const size = { w: 220, h: 187 };
  const viewport = { width: 520, height: 420 };
  const rect = { x: 8, y: 60, w: 504, h: 300 };
  assert.equal(largestLabel({ size, rect, viewport, min: 0.6, max: 1 }), null);
});

test('the label keeps a gap from the painting next door', () => {
  // Two works with a 400px gap: a full-size label left of the second one would
  // stop 8px short of the first, which is exactly the "pasted on" look.
  const left = { x: 0, y: 100, w: 600, h: 400 };
  const right = { x: 1000, y: 100, w: 600, h: 400 };
  const size = { w: 362, h: 200 };
  const placed = labelPlacement({
    size,
    rect: right,
    obstacles: [left],
    viewport: { width: 1600, height: 800 }
  });
  assert.ok(placed, 'there is room below');
  assert.notEqual(placed.x, right.x - 30 - size.w, 'it did not butt against the left work');
  const box = { x: placed.x, y: placed.y, w: size.w, h: size.h };
  const clearance = 24;
  const inflated = {
    x: left.x - clearance,
    y: left.y - clearance,
    w: left.w + clearance * 2,
    h: left.h + clearance * 2
  };
  const touches = box.x < inflated.x + inflated.w && box.x + box.w > inflated.x &&
    box.y < inflated.y + inflated.h && box.y + box.h > inflated.y;
  assert.equal(touches, false);
});
