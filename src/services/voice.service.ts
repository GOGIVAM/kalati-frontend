import { ApiError, authHeaders, buildUrl, credentialsMode } from '@/lib/httpClient';

/**
 * Interface vocale (Phase 6 du dossier technique).
 *
 * La reconnaissance et la synthèse restent côté serveur : Whisper large-v3
 * pour la dictée, Coqui TTS pour la lecture. Le navigateur ne fait que
 * capturer le micro et jouer l'audio — aucune API vocale externe n'est
 * utilisée, ce qui préserve le confinement intranet.
 */
export const voiceService = {
  /** Envoie l'enregistrement au backend et récupère la transcription corrigée. */
  async transcribe(audio: Blob, locale: string): Promise<string> {
    const form = new FormData();
    form.append('audio', audio, 'question.webm');
    form.append('language', locale);

    const response = await fetch(buildUrl('/api/voice/transcribe'), {
      method: 'POST',
      headers: authHeaders(),
      credentials: credentialsMode,
      body: form,
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'ASR_FAILED', 'Transcription indisponible.');
    }
    const body = (await response.json()) as { text: string };
    return body.text ?? '';
  },

  /** Récupère la lecture audio d'une réponse déjà générée. */
  async speak(messageId: string): Promise<Blob> {
    const response = await fetch(
      buildUrl(`/api/voice/speak/${encodeURIComponent(messageId)}`),
      { headers: authHeaders(), credentials: credentialsMode },
    );
    if (!response.ok) {
      throw new ApiError(response.status, 'TTS_FAILED', 'Synthèse vocale indisponible.');
    }
    return response.blob();
  },
};
