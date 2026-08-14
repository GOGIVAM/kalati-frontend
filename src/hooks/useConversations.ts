import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationsService } from '@/services/conversations.service';
import { authService } from '@/services/auth.service';
import { qk } from '@/lib/queryClient';
import type { Scope } from '@/types';

export function useConversations(search?: string) {
  return useQuery({
    queryKey: qk.conversations(search),
    queryFn: () => conversationsService.list({ search }),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: qk.conversation(id ?? 'none'),
    queryFn: () => conversationsService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (scopes: string[]) => conversationsService.create({ scopes }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useRenameConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      conversationsService.rename(id, title),
    onSuccess: () => client.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useDeleteConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsService.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

const FALLBACK_SCOPES: Scope[] = [
  { code: 'MAINTENANCE', label: 'Maintenance ferroviaire' },
  { code: 'TRANSPORT', label: 'Transport / Exploitation' },
  { code: 'RH', label: 'Ressources humaines' },
  { code: 'JURIDIQUE', label: 'Juridique' },
  { code: 'FINANCE', label: 'Finance' },
  { code: 'COMMERCIAL', label: 'Commercial' },
];

/**
 * Périmètres métier. Le référentiel fait foi ; la liste de repli évite
 * un écran de filtres vide si l'endpoint n'est pas encore implémenté.
 */
export function useScopes() {
  const query = useQuery({
    queryKey: qk.scopes,
    queryFn: () => authService.scopes(),
    staleTime: 10 * 60_000,
  });
  return { ...query, scopes: query.data?.length ? query.data : FALLBACK_SCOPES };
}
