export function completesSavedDeleteSwipe(distance: number, travelToRightEdge: number): boolean {
  return travelToRightEdge > 0 && distance >= Math.max(48, travelToRightEdge * 0.85);
}
