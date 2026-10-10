import { getRandomValues } from 'expo-crypto';
export default function secureRandomInt(): number {
  return getRandomValues(new Uint32Array(1))[0];
}
