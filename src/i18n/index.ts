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

let savedLang = null;
try {
  savedLang = localStorage.getItem('mjscoreboard_lang');
} catch (e) {
  console.warn('localStorage is not available');
}

const navLang = typeof navigator !== 'undefined' ? (navigator.language || (navigator.languages && navigator.languages[0]) || 'zh') : 'zh';
const defaultLang = savedLang || navLang.split('-')[0] || 'zh';
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
