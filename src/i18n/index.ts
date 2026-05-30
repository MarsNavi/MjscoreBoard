import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zh from './locales/zh.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

const resources = {
  zh: { translation: zh },
  en: { translation: en },
  ja: { translation: ja }
};

const savedLang = localStorage.getItem('mjscoreboard_lang');
const defaultLang = savedLang || (typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'zh') || 'zh';
const finalLang = ['zh', 'en', 'ja'].includes(defaultLang) ? defaultLang : 'zh';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: finalLang,
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
