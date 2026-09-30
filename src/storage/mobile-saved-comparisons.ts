import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedComparisonStore } from './saved-comparisons';
export const savedComparisons = new SavedComparisonStore(AsyncStorage);
