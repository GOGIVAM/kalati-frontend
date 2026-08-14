import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './fr.json';
import en from './en.json';
import { env } from '@/lib/env';
import type { Locale } from '@/types';

const STORAGE_KEY = 'kalati.locale';

const detectLocale = (): Locale => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : env.defaultLocale;
};

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: detectLocale(),
  fallbackLng: 'fr',
  supportedLngs: ['fr', 'en'],
  interpolation: { escapeValue: false },
  returnNull: false,
});

const applyDocumentLang = (locale: string) => {
  document.documentElement.lang = locale;
};

applyDocumentLang(i18n.language);
i18n.on('languageChanged', applyDocumentLang);

export const setLocale = (locale: Locale) => {
  localStorage.setItem(STORAGE_KEY, locale);
  void i18n.changeLanguage(locale);
};

export const currentLocale = (): Locale => (i18n.language === 'en' ? 'en' : 'fr');

export default i18n;
