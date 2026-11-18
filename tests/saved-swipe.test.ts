import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completesSavedDeleteSwipe } from '../src/app/saved-swipe';

test('Saved item deletion requires a nearly full right swipe', () => {
  assert.equal(completesSavedDeleteSwipe(0, 320), false);
  assert.equal(completesSavedDeleteSwipe(-320, 320), false);
  assert.equal(completesSavedDeleteSwipe(200, 320), false);
  assert.equal(completesSavedDeleteSwipe(271, 320), false);
  assert.equal(completesSavedDeleteSwipe(272, 320), true);
  assert.equal(completesSavedDeleteSwipe(320, 320), true);
  assert.equal(completesSavedDeleteSwipe(100, 0), false);
  assert.equal(completesSavedDeleteSwipe(84, 100), false);
  assert.equal(completesSavedDeleteSwipe(85, 100), true);
  assert.equal(completesSavedDeleteSwipe(30, 30), false);
});
