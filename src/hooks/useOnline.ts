import { useEffect, useState } from 'react';
import { create } from 'zustand';

/** État de la connexion à l'intranet CAMRAIL. */
export function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}

interface QueuedQuestion {
  id: string;
  question: string;
  scopes: string[];
}

interface QueueState {
  items: QueuedQuestion[];
  enqueue: (question: string, scopes: string[]) => void;
  shift: () => QueuedQuestion | undefined;
  clear: () => void;
}

/**
 * File d'attente des questions posées hors ligne.
 *
 * Le pipeline RAG s'exécute intégralement côté serveur : hors connexion, aucune
 * réponse n'est possible. La question est donc conservée et rejouée dès le
 * rétablissement de l'intranet, plutôt que perdue.
 */
export const useQuestionQueue = create<QueueState>((set, get) => ({
  items: [],
  enqueue: (question, scopes) =>
    set((state) => ({
      items: [...state.items, { id: `q_${Date.now()}_${state.items.length}`, question, scopes }],
    })),
  shift: () => {
    const [first, ...rest] = get().items;
    if (first) set({ items: rest });
    return first;
  },
  clear: () => set({ items: [] }),
}));
