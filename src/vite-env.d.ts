/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_AUTH_TRANSPORT?: 'header' | 'cookie';
  readonly VITE_DEFAULT_LOCALE?: 'fr' | 'en';
  readonly VITE_FAITHFULNESS_THRESHOLD?: string;
  readonly VITE_CONFIDENCE_THRESHOLD?: string;
  readonly VITE_ANSWER_RELEVANCY_THRESHOLD?: string;
  readonly VITE_CONTEXT_PRECISION_THRESHOLD?: string;
  readonly VITE_CONTEXT_RECALL_THRESHOLD?: string;
  readonly VITE_VOICE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
