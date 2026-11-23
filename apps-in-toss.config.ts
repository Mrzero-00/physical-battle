// 앱인토스 미니앱 빌드 설정
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'physical-battle',
  permissions: [],
  webBundleDir: 'dist-toss',
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
    theme: 'dark',
  },
});
