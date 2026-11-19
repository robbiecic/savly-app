import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import type { NavigationBarStyle } from 'expo-navigation-bar';

// Older development APKs do not include this native module. Avoid loading its
// JavaScript entry point until a rebuilt binary is installed.
const NativeNavigationBar = Platform.OS === 'android' && requireOptionalNativeModule('ExpoNavigationBar')
  ? (require('expo-navigation-bar') as typeof import('expo-navigation-bar')).NavigationBar
  : null;

export function AndroidNavigationBar({ style }: { style: NavigationBarStyle }) {
  return NativeNavigationBar ? <NativeNavigationBar style={style} /> : null;
}
