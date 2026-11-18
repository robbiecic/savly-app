import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

// Reuse the open sky in the welcome photo without bringing the cathedral into the header.
export function CloudHeaderBackground() {
  const { width } = useWindowDimensions();
  const imageWidth = width * 2.4;
  return <View pointerEvents="none" style={styles.sky}>
    <Image source={require('../../assets/welcome-travel.png')} resizeMode="stretch" accessible={false}
      style={{ position: 'absolute', width: imageWidth, height: imageWidth * 1672 / 941, top: -imageWidth * 0.14, left: 0 }} />
    <LinearGradient colors={['rgba(5, 37, 93, 0.35)', 'rgba(5, 37, 93, 0.08)']} style={StyleSheet.absoluteFill} />
  </View>;
}

const styles = StyleSheet.create({
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: 230, overflow: 'hidden', backgroundColor: '#3C90D1' },
});
