// Vite 환경변수 타입
interface ImportMetaEnv {
  readonly VITE_PLATFORM?: 'web' | 'apps-in-toss';
  readonly VITE_AD_REWARDED_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
