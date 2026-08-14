import type { Locale } from '@/types';

const num = (raw: string | undefined, fallback: number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Configuration lue une seule fois au démarrage. */
export const env = {
  /** Base d'API. Vide = proxy Vite en même origine (`/api`). */
  apiUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, ''),
  authTransport: (import.meta.env.VITE_AUTH_TRANSPORT ?? 'header') as 'header' | 'cookie',
  defaultLocale: (import.meta.env.VITE_DEFAULT_LOCALE ?? 'fr') as Locale,
  faithfulnessThreshold: num(import.meta.env.VITE_FAITHFULNESS_THRESHOLD, 0.9),
  confidenceThreshold: num(import.meta.env.VITE_CONFIDENCE_THRESHOLD, 0.6),
  /** Seuils de production RAGAS (chapitre Phase 4 du dossier technique). */
  ragasThresholds: {
    faithfulness: num(import.meta.env.VITE_FAITHFULNESS_THRESHOLD, 0.9),
    answerRelevancy: num(import.meta.env.VITE_ANSWER_RELEVANCY_THRESHOLD, 0.85),
    contextPrecision: num(import.meta.env.VITE_CONTEXT_PRECISION_THRESHOLD, 0.8),
    contextRecall: num(import.meta.env.VITE_CONTEXT_RECALL_THRESHOLD, 0.8),
  },
  /** Boîte du support informatique CAMRAIL, jointe depuis la barre du haut. */
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL ?? 'coordination.informatique@camrail.cm',
  /** Interface vocale (Whisper ASR + Coqui TTS côté serveur). */
  voiceEnabled: (import.meta.env.VITE_VOICE_ENABLED ?? 'true') !== 'false',
} as const;

export const usesCookieAuth = env.authTransport === 'cookie';
