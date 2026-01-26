import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Importação direta para garantir que o compilador inclua os dados
import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";
import es from "./locales/es.json";

export const resources = {
  "pt-BR": { translation: ptBR },
  "en-US": { translation: enUS },
  es: { translation: es },
} as const;

export const supportedLanguages = [
  { code: "pt-BR", name: "Português", flag: "🇧🇷" },
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Idioma padrão se nada for detetado
    fallbackLng: "pt-BR",
    // Permite apenas estes idiomas
    supportedLngs: ["pt-BR", "en-US", "es"],

    detection: {
      // Prioridade: LocalStorage > Navegador > HTML Tag
      order: ["localStorage", "navigator", "htmlTag"],
      // Nome da chave guardada no navegador
      lookupLocalStorage: "i18nextLng",
      // Guarda a escolha do utilizador automaticamente
      caches: ["localStorage"],
    },

    interpolation: {
      escapeValue: false, // O React já trata da segurança contra XSS
    },

    react: {
      useSuspense: false, // Evita que a aplicação "pisque" ou trave ao carregar
    },
  });

export default i18n;
