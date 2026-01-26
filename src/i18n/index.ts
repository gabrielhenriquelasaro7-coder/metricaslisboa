import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import es from './locales/es.json';

export const resources = {
  'pt-BR': { translation: ptBR },
  'en-US': { translation: enUS },
  'es': { translation: es }
} as const;

export const supportedLanguages = [
  { code: 'pt-BR', name: 'Português', flag: '🇧🇷' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }
] as const;

// Initialize i18n synchronously
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en-US', 'es'],
    
    detection: {
      // Check localStorage first, then browser navigator language
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      // Convert browser language codes to our supported codes
      convertDetectedLanguage: (lng: string) => {
        // Handle common browser language codes
        if (lng.startsWith('pt')) return 'pt-BR';
        if (lng.startsWith('es')) return 'es';
        if (lng.startsWith('en')) return 'en-US';
        return lng;
      }
    },

    interpolation: {
      escapeValue: false
    },

    react: {
      useSuspense: false
    }
  });

export default i18n;
