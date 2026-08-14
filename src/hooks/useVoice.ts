import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceService } from '@/services/voice.service';
import { useLocale } from './useLocale';

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'error';

/**
 * Dictée : capture le micro, envoie l'enregistrement à Whisper côté serveur,
 * puis restitue le texte transcrit. Aucun traitement vocal dans le navigateur.
 */
export function useVoiceInput(onTranscript: (text: string) => void) {
  const locale = useLocale();
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const supported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  const stopTracks = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
  }, []);

  useEffect(() => stopTracks, [stopTracks]);

  const start = useCallback(async () => {
    if (!supported || state === 'recording') return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stopTracks();
        const audio = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        if (audio.size === 0) {
          setState('idle');
          return;
        }
        setState('transcribing');
        try {
          const text = await voiceService.transcribe(audio, locale);
          if (text.trim()) onTranscript(text.trim());
          setState('idle');
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Transcription indisponible.');
          setState('error');
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setState('recording');
    } catch {
      setError('Micro inaccessible.');
      setState('error');
    }
  }, [locale, onTranscript, state, stopTracks, supported]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  return { supported, state, error, start, stop };
}

/** Lecture d'une réponse par la synthèse vocale du serveur. */
export function useSpeech() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
    audioRef.current = null;
    setPlayingId(null);
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback(
    async (messageId: string) => {
      if (playingId === messageId) {
        stop();
        return;
      }
      stop();
      try {
        const blob = await voiceService.speak(messageId);
        const audio = new Audio(URL.createObjectURL(blob));
        audio.onended = () => stop();
        audioRef.current = audio;
        setPlayingId(messageId);
        await audio.play();
      } catch {
        stop();
      }
    },
    [playingId, stop],
  );

  return { playingId, play, stop };
}
