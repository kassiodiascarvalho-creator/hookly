import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import pt from './locales/pt.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';
import de from './locales/de.json';

export const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
] as const;

export type LanguageCode = typeof languages[number]['code'];

const resources = {
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es },
  fr: { translation: fr },
  zh: { translation: zh },
  de: { translation: de },
};

// Get stored language or browser preference
const getInitialLanguage = (): string => {
  const stored = localStorage.getItem('i18nextLng');
  if (stored && ['en', 'pt', 'es', 'fr', 'zh', 'de'].includes(stored)) {
    return stored;
  }
  
  const browserLang = navigator.language.split('-')[0];
  if (['en', 'pt', 'es', 'fr', 'zh', 'de'].includes(browserLang)) {
    return browserLang;
  }
  
  return 'pt'; // Default to Portuguese for Brazilian market
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
