import { createContext, useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, type ScrollViewProps } from 'react-native';

export const RevealInputContext = createContext<((input: TextInput | null) => void) | null>(null);

// Android can resize the viewport without scrolling the focused field into it.
// Reveal after layout as well as focus, including when switching fields with
// the keyboard already open. Keep the native input instance (no numeric handles).
export function KeyboardFormScrollView(props: ScrollViewProps) {
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const focused = useRef<TextInput | null>(null);
  const frame = useRef<number | null>(null);
  const reveal = useCallback(() => {
    if (Platform.OS !== 'android') return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = focused.current;
      if (!input?.isFocused()) return;
      scroll.current?.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (!input.isFocused()) return;
          const bottom = Math.min(top + height, Keyboard.metrics()?.screenY ?? Infinity);
          const overlap = inputTop + inputHeight + 20 - bottom;
          if (overlap > 0) scroll.current?.scrollTo({ y: offset.current + overlap, animated: true });
        });
      });
    });
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = Keyboard.addListener('keyboardDidShow', reveal);
    return () => subscription.remove();
  }, [reveal]);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const focus = useCallback((input: TextInput | null) => { focused.current = input; reveal(); }, [reveal]);
  return <RevealInputContext.Provider value={focus}>
    <ScrollView {...props} ref={scroll} scrollEventThrottle={16}
      onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.y; props.onScroll?.(event); }} onLayout={(event) => { props.onLayout?.(event); reveal(); }} />
  </RevealInputContext.Provider>;
}
