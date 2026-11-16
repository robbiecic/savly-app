import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isHorizontalTabSwipe, tabAfterSwipe } from '../src/app/tab-swipe';

test('Horizontal swipes change only to the tab in their direction', () => {
  assert.equal(tabAfterSwipe('calculator', -70, 8), 'saved');
  assert.equal(tabAfterSwipe('saved', 70, -8), 'calculator');
  assert.equal(tabAfterSwipe('calculator', 70, 0), 'calculator');
  assert.equal(tabAfterSwipe('saved', -70, 0), 'saved');
});

test('Vertical scrolling and short or diagonal movements do not change tabs', () => {
  assert.equal(isHorizontalTabSwipe(19, 4, 18), true);
  for (const [dx, dy] of [[59, 0], [-59, 0], [80, 70], [8, 100], [0, -100]]) {
    assert.equal(tabAfterSwipe('calculator', dx, dy), 'calculator');
    assert.equal(tabAfterSwipe('saved', dx, dy), 'saved');
  }
});
