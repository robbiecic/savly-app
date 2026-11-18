export function completesSavedDeleteSwipe(distance: number, width: number): boolean {
  return width > 0 && distance >= width * 0.85;
}
