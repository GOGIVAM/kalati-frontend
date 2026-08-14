import { useTranslation } from 'react-i18next';
import type { Locale } from '@/types';

/** Locale courante typée, pour les helpers de formatage Intl. */
export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return i18n.language === 'en' ? 'en' : 'fr';
}
