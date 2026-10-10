const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
// Cognito's legacy native random adapter expects ExpoRandom. Use Expo Crypto
// on current Expo, including development builds; never use its debug fallback.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && context.originModulePath.includes('amazon-cognito-identity-js') && moduleName.endsWith('/cryptoSecureRandomInt')) {
    return { type: 'sourceFile', filePath: path.resolve(__dirname, 'src/auth/secure-random.ts') };
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
