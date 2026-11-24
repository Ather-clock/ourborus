import test from 'node:test';
import assert from 'node:assert/strict';
import { SYMBOL_LIBRARY } from '../data/symbols';
import { createArchitectureBoardProject, createPitchDeckProject, TEMPLATE_GALLERY } from '../data/templates';
import {
  addSlideToProject,
  convertBoardFramesToSlides,
  createHistoryStack,
  deleteSlideFromProject,
  duplicateSlideInProject,
  parseImportedProject,
  pushHistory,
  redoHistory,
  reorderElementZ,
  reorderSlidesInProject,
  searchProjectAndSymbols,
  serializeProject,
  undoHistory,
} from './scene';

test('slide CRUD operations maintain activeSlideId and order', () => {
  let proj = createPitchDeckProject('Test Deck');
  const initialCount = proj.slides.length;
  proj = addSlideToProject(proj);
  assert.equal(proj.slides.length, initialCount + 1);

  const addedId = proj.activeSlideId;
  proj = duplicateSlideInProject(proj, addedId);
  assert.equal(proj.slides.length, initialCount + 2);

  proj = reorderSlidesInProject(proj, 0, 2);
  assert.equal(proj.slides[2].title, 'Cover — Vision');

  proj = deleteSlideFromProject(proj, proj.activeSlideId);
  assert.equal(proj.slides.length, initialCount + 1);
});

test('undoHistory and redoHistory restore previous snapshots cleanly', () => {
  const p0 = createPitchDeckProject('Deck v0');
  const p1 = { ...p0, title: 'Deck v1' };
  const p2 = { ...p1, title: 'Deck v2' };

  let stack = createHistoryStack();
  stack = pushHistory(stack, p0);
  stack = pushHistory(stack, p1);

  const u1 = undoHistory(stack, p2);
  assert.ok(u1);
  assert.equal(u1.project.title, 'Deck v1');

  const u2 = undoHistory(u1.stack, u1.project);
  assert.ok(u2);
  assert.equal(u2.project.title, 'Deck v0');

  const r1 = redoHistory(u2.stack, u2.project);
  assert.ok(r1);
  assert.equal(r1.project.title, 'Deck v1');
});

test('reorderElementZ moves selected element forward and backward', () => {
  const p = createPitchDeckProject('Z Test');
  const els = p.slides[0].elements;
  const firstId = els[0].id;
  const movedFront = reorderElementZ(els, new Set([firstId]), 'front');
  assert.equal(movedFront[movedFront.length - 1].id, firstId);
  const movedBack = reorderElementZ(movedFront, new Set([firstId]), 'back');
  assert.equal(movedBack[0].id, firstId);
});

test('convertBoardFramesToSlides turns whiteboard frames into presentation slides', () => {
  const boardProj = createArchitectureBoardProject('Board');
  const converted = convertBoardFramesToSlides(boardProj);
  assert.equal(converted.mode, 'presentation');
  assert.ok(converted.slides.length >= 1);
  assert.equal(converted.slides[0].title, 'Core Studio Architecture');
  assert.ok(converted.slides[0].elements.length >= 4);
});

test('searchProjectAndSymbols finds symbols, slides, elements, and templates', () => {
  const proj = createPitchDeckProject('Searchable Pitch');
  const dbRes = searchProjectAndSymbols('database', proj, SYMBOL_LIBRARY, TEMPLATE_GALLERY);
  assert.equal(dbRes.some((r) => r.kind === 'symbol' && r.title.includes('Database')), true);

  const slideRes = searchProjectAndSymbols('Matrix', proj, SYMBOL_LIBRARY, TEMPLATE_GALLERY);
  assert.equal(slideRes.some((r) => r.kind === 'slide'), true);
});

test('serializeProject and parseImportedProject round-trip safely', () => {
  const proj = createPitchDeckProject('Export Test');
  const json = serializeProject(proj);
  const imported = parseImportedProject(json);
  assert.equal(imported.title, 'Export Test');
  assert.equal(imported.slides.length, proj.slides.length);
  assert.notEqual(imported.id, proj.id);
});
