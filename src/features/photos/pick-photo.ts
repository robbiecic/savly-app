import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

export async function pickPhoto(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera access is off. Allow it in device settings, or use Add photo.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 };
  // The system photo picker grants access to the chosen image only.
  const result = await (source === 'camera' ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options));
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('No photo was selected. Please try again.');
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1000 || asset.height > 1000) {
    context.resize(asset.width >= asset.height ? { width: 1000 } : { height: 1000 });
  }
  const image = await context.renderAsync();
  try {
    const output = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.65, base64: true });
    if (!output.base64 || output.base64.length > 399_970) throw new Error('This photo is too large. Please choose a simpler or smaller image.');
    return `data:image/jpeg;base64,${output.base64}`;
  } finally { image.release(); context.release(); }
}
