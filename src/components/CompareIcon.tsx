import Svg, { Path, Rect } from 'react-native-svg';

type IconName = 'bag' | 'tag' | 'home' | 'arrow' | 'chevron';

export function CompareIcon({ name, size = 28, color = '#09184A' }: { name: IconName; size?: number; color?: string }) {
  const common = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    {name === 'bag' && <><Path {...common} d="M4 8h16l-1 13H5L4 8Z" /><Path {...common} d="M9 9V6a3 3 0 0 1 6 0v3" /></>}
    {name === 'tag' && <><Path {...common} d="m3 12 9-9h8a1 1 0 0 1 1 1v8l-9 9-9-9Z" /><Path {...common} d="M16.5 7.5h.01" strokeWidth={3} /></>}
    {name === 'home' && <><Path {...common} d="m2 10 10-8 10 8M4 9v12h16V9M9 21v-8h6v8" /></>}
    {name === 'arrow' && <Path {...common} d="M3 12h18m-7-7 7 7-7 7" />}
    {name === 'chevron' && <Path {...common} d="m6 9 6 6 6-6" />}
  </Svg>;
}
