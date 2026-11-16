export type MainTab = 'calculator' | 'saved';

export function isHorizontalTabSwipe(dx: number, dy: number, minimumDistance: number): boolean {
  return Math.abs(dx) >= minimumDistance && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function tabAfterSwipe(tab: MainTab, dx: number, dy: number): MainTab {
  if (!isHorizontalTabSwipe(dx, dy, 60)) return tab;
  return dx < 0 ? 'saved' : 'calculator';
}
