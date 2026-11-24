import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignElements,
  computeMindMapBranch,
  computeSmartGuides,
  distributeElements,
  findNearestPort,
  getElementBounds,
  hitTestElement,
  hitTestElements,
  syncBoundConnectors,
} from './geometry';
import type { CanvasElement } from '../types/studio';

function makeBox(id: string, x: number, y: number, w = 100, h = 80): CanvasElement {
  return {
    id,
    type: 'rect',
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    opacity: 1,
    strokeColor: '#0F172A',
    fillColor: '#DBEAFE',
    fillStyle: 'hachure',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1.2,
    cornerRadius: 0,
    seed: 1,
  };
}

test('hitTestElement detects rect, ellipse, and diamond accurately', () => {
  const rect = makeBox('r1', 100, 100, 100, 80);
  assert.equal(hitTestElement(rect, { x: 150, y: 140 }), true);
  assert.equal(hitTestElement(rect, { x: 50, y: 50 }), false);

  const ellipse: CanvasElement = { ...rect, id: 'e1', type: 'ellipse' };
  assert.equal(hitTestElement(ellipse, { x: 150, y: 140 }), true);
  // Corner outside ellipse boundary
  assert.equal(hitTestElement(ellipse, { x: 100, y: 100 }, 0), false);

  const diamond: CanvasElement = { ...rect, id: 'd1', type: 'diamond' };
  assert.equal(hitTestElement(diamond, { x: 150, y: 140 }), true);
  assert.equal(hitTestElement(diamond, { x: 105, y: 105 }, 0), false);
});

test('hitTestElements prefers non-frame elements and top-most z-order', () => {
  const frame: CanvasElement = { ...makeBox('f1', 0, 0, 500, 400), type: 'frame' };
  const bottom = makeBox('b1', 50, 50, 120, 80);
  const top = makeBox('b2', 80, 60, 120, 80);

  const hit = hitTestElements([frame, bottom, top], { x: 100, y: 90 });
  assert.equal(hit?.id, 'b2');
});

test('syncBoundConnectors updates arrow endpoints when connected shapes move', () => {
  const a = makeBox('a', 100, 100, 100, 80); // right port at (200, 140)
  const b = makeBox('b', 350, 100, 100, 80); // left port at (350, 140)
  const arrow: CanvasElement = {
    ...makeBox('arr1', 200, 140, 150, 0),
    type: 'arrow',
    points: [
      { x: 0, y: 0 },
      { x: 150, y: 0 },
    ],
    startBinding: { elementId: 'a', port: 'right' },
    endBinding: { elementId: 'b', port: 'left' },
  };

  // Move node b down by 60 and right by 50
  const movedB = { ...b, x: 400, y: 160 };
  const synced = syncBoundConnectors([a, movedB, arrow]);
  const updatedArrow = synced.find((el) => el.id === 'arr1')!;
  assert.equal(updatedArrow.x, 200);
  assert.equal(updatedArrow.y, 140);
  assert.equal(updatedArrow.points?.[1].x, 200); // 400 - 200
  assert.equal(updatedArrow.points?.[1].y, 60); // 200 - 140
});

test('findNearestPort snaps to closest cardinal anchor port', () => {
  const box = makeBox('box1', 100, 100, 100, 100);
  const res = findNearestPort([box], { x: 204, y: 152 });
  assert.equal(res?.element.id, 'box1');
  assert.equal(res?.port, 'right');
  assert.deepEqual(res?.point, { x: 200, y: 150 });
});

test('computeSmartGuides snaps aligned edges and emits guide lines', () => {
  const stationary = makeBox('s1', 200, 100, 100, 80);
  const moving = makeBox('m1', 203, 250, 100, 80);
  const res = computeSmartGuides(getElementBounds(moving), [stationary], 6);
  assert.equal(res.dx, -3);
  assert.equal(res.guides.some((g) => g.axis === 'x' && g.position === 200), true);
});

test('alignElements and distributeElements compute exact positions', () => {
  const b1 = makeBox('1', 50, 100, 60, 40);
  const b2 = makeBox('2', 200, 130, 80, 40);
  const b3 = makeBox('3', 400, 180, 60, 40);

  const aligned = alignElements([b1, b2, b3], new Set(['1', '2', '3']), 'left');
  assert.equal(aligned[0].x, 50);
  assert.equal(aligned[1].x, 50);
  assert.equal(aligned[2].x, 50);

  const distributed = distributeElements([b1, b2, b3], new Set(['1', '2', '3']), 'horizontal');
  // Total span: 50 to 460 = 410. Total widths: 60 + 80 + 60 = 200. Gap = 105.
  // b2 should start at 50 + 60 + 105 = 215
  assert.equal(distributed[1].x, 215);
});

test('computeMindMapBranch places child node and returns matching ports', () => {
  const parent = makeBox('p1', 100, 100, 160, 80);
  const branch = computeMindMapBranch(parent, 'right');
  assert.equal(branch.fromPort, 'right');
  assert.equal(branch.toPort, 'left');
  assert.equal(branch.nodeRect.x, 340);
});
