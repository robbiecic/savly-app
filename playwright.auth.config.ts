import { defineConfig } from '@playwright/test';

// Isolated mock-provider build: never used as the normal app's Cognito configuration.
export default defineConfig({
  testDir: './tests/auth-ui',
  use: { baseURL: 'http://localhost:4174', viewport: { width: 390, height: 844 } },
  webServer: {
    command: 'npx expo export --platform web --clear --output-dir dist-auth-web && python3 -m http.server 4174 --bind 127.0.0.1 --directory dist-auth-web',
    env: {
      NODE_ENV: 'production', EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_COGNITO_AUTHORITY: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_MncSdF1r0',
      EXPO_PUBLIC_COGNITO_CLIENT_ID: '35vicii2qq71r09bcd0val80lm',
      EXPO_PUBLIC_COGNITO_DOMAIN: 'https://savly-test.auth.us-east-1.amazoncognito.com',
      EXPO_PUBLIC_COGNITO_REDIRECT_URI: 'http://localhost:4174',
    },
    url: 'http://localhost:4174', reuseExistingServer: false, timeout: 120000,
  },
  workers: 1,
});
