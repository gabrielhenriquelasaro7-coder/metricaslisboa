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

// Initialize i18n - this will be called after React is ready
export function initI18n() {
  if (!i18n.isInitialized) {
    i18n
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        resources,
        fallbackLng: 'pt-BR',
        supportedLngs: ['pt-BR', 'en-US', 'es'],
        
        detection: {
          order: ['localStorage', 'navigator', 'htmlTag'],
          caches: ['localStorage'],
          lookupLocalStorage: 'i18nextLng',
        },

        interpolation: {
          escapeValue: false
        },

        react: {
          useSuspense: false
        }
      });
  }
  return i18n;
}

export default i18n;
