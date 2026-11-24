import { useI18n } from '../../i18n';

export function Welcome({ onStart }: { onStart: () => void }) {
  const { t, lang, setLang } = useI18n();
  return (
    <main class="screen welcome">
      <h1 tabIndex={-1}>{t('welcomeTitle')}</h1>
      <p class="muted">{t('welcomeBody')}</p>
      <ul class="promises">
        <li>{t('promiseLocal')}</li>
        <li>{t('promiseSuggest')}</li>
        <li>{t('promiseDecide')}</li>
      </ul>
      <button class="primary" onClick={onStart}>
        {t('getStarted')}
      </button>
      <button
        class="link"
        lang={lang === 'vi' ? 'en' : 'vi'}
        onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
      >
        {lang === 'vi' ? 'English' : 'Tiếng Việt'}
      </button>
    </main>
  );
}
