import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStars, starAlpha, mulberry32, SKY_SEED } from '../src/scripts/anchors-sky.mjs';

const field = () => makeStars({ width: 1720, height: 1180 });

test('the same seed opens the same sky', () => {
  const a = field();
  const b = field();
  assert.deepEqual(a.slice(0, 12), b.slice(0, 12));
  const other = makeStars({ width: 1720, height: 1180, seed: 99 });
  assert.notDeepEqual(a[0], other[0]);
});

test('the prng is uniform enough and stable', () => {
  const random = mulberry32(SKY_SEED);
  const values = Array.from({ length: 2000 }, random);
  assert.ok(Math.min(...values) >= 0 && Math.max(...values) < 1);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.04, `mean was ${mean}`);
});

test('the sky stays sparse and scales with the canvas', () => {
  const small = makeStars({ width: 860, height: 590 });
  const large = makeStars({ width: 3440, height: 2360 });
  assert.ok(small.length >= 70);
  assert.ok(field().length > small.length);
  assert.ok(large.length <= 320, 'a dense sky would stop reading as a room');
  assert.ok(field().length >= 150 && field().length <= 320);
});

test('stars are small, faint points with rare warm ones', () => {
  const stars = field();
  const warm = stars.filter(star => star.warm).length;
  for (const star of stars) {
    assert.ok(star.radius > 0 && star.radius < 3);
    assert.ok(star.base > 0 && star.base <= 0.7);
    assert.ok(star.x >= 0 && star.y >= 0);
  }
  assert.ok(warm / stars.length < 0.06);
});

test('bright stars arrive later than the near field', () => {
  const stars = field();
  const faint = stars.filter(star => star.radius < 1.6);
  const bright = stars.filter(star => star.radius >= 1.6);
  const first = list => Math.min(...list.map(star => star.born));
  assert.ok(bright.length > 0 && faint.length > 0);
  assert.ok(first(bright) > first(faint), 'the far field shows up before the bright stars');
});

test('a star is invisible before it is born', () => {
  const star = { born: 900, rise: 1000, base: 0.4, amp: 0.2, period: 5000, phase: 0 };
  assert.equal(starAlpha(star, 0), 0);
  assert.equal(starAlpha(star, 899), 0);
  assert.equal(starAlpha(star, 900), 0);
  assert.ok(starAlpha(star, 950) > 0 && starAlpha(star, 950) < star.base * 0.1);
});

test('a star rises and then only breathes a little', () => {
  const star = { born: 700, rise: 1000, base: 0.4, amp: 0.2, period: 5000, phase: 1 };
  const risen = [];
  for (let elapsed = 1700; elapsed < 14000; elapsed += 60) risen.push(starAlpha(star, elapsed));
  const peak = Math.max(...risen);
  const trough = Math.min(...risen);
  assert.ok(peak <= star.base + 1e-9, 'never brighter than its own brightness');
  assert.ok(trough >= star.base * (1 - star.amp) - 1e-9);
  assert.ok(trough >= star.base * 0.6, 'twinkle never swallows a star');
  assert.ok(peak > trough, 'and it does twinkle');
});

test('the sky reaches full brightness within a few seconds', () => {
  const stars = field();
  const late = stars.filter(star => star.born + star.rise > 4000);
  assert.equal(late.length, 0, 'every star has arrived by four seconds');
  const earliest = Math.min(...stars.map(star => star.born));
  assert.ok(earliest >= 700, 'the room is allowed a beat of true darkness first');
});
