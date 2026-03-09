import { useAccessibility } from './accessibility/AccessibilityProvider';
import { useLanguage } from './i18n/LanguageProvider';
import { useI18n } from './i18n/useI18n';

export const GlobalControlsBar = () => {
  const {
    focusMode,
    largeText,
    reduceMotion,
    captionsOn,
    signsOn,
    toggleFocusMode,
    toggleLargeText,
    toggleReduceMotion,
    toggleCaptions,
    toggleSigns,
  } = useAccessibility();
  const { language, setLanguage } = useLanguage();
  const { t } = useI18n();

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center justify-center gap-3 mr-2">
          <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">{t('controls.contentSettings')}</span>
          <button
            onClick={toggleFocusMode}
            aria-pressed={focusMode}
            className={`btn-3d px-4 py-2 rounded-2xl text-sm font-bold border-2 ${focusMode ? 'bg-secondary-500 text-white border-secondary-600 btn-3d-secondary' : 'bg-surface-50 text-surface-700 border-surface-200 btn-3d-surface'
              }`}
          >
            {t('controls.focus')}
          </button>
          <button
            onClick={toggleLargeText}
            aria-pressed={largeText}
            className={`btn-3d px-4 py-2 rounded-2xl text-sm font-bold border-2 ${largeText ? 'bg-primary-500 text-white border-primary-600 btn-3d-primary' : 'bg-surface-50 text-surface-700 border-surface-200 btn-3d-surface'
              }`}
          >
            {t('controls.largeText')}
          </button>
          <button
            onClick={toggleCaptions}
            aria-pressed={captionsOn}
            className={`btn-3d px-4 py-2 rounded-2xl text-sm font-bold border-2 ${captionsOn ? 'bg-secondary-500 text-white border-secondary-600 btn-3d-secondary' : 'bg-surface-50 text-surface-700 border-surface-200 btn-3d-surface'
              }`}
          >
            {t('controls.captions')}
          </button>
          <button
            onClick={toggleSigns}
            aria-pressed={signsOn}
            className={`btn-3d px-4 py-2 rounded-2xl text-sm font-bold border-2 ${signsOn ? 'bg-primary-500 text-white border-primary-600 btn-3d-primary' : 'bg-surface-50 text-surface-700 border-surface-200 btn-3d-surface'
              }`}
          >
            {t('controls.signs')}
          </button>
          <button
            onClick={toggleReduceMotion}
            aria-pressed={reduceMotion}
            className={`btn-3d px-4 py-2 rounded-2xl text-sm font-bold border-2 ${reduceMotion ? 'bg-tertiary-500 text-white border-tertiary-600 btn-3d-tertiary' : 'bg-surface-50 text-surface-700 border-surface-200 btn-3d-surface'
              }`}
          >
            {t('controls.calmMotion')}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label htmlFor="language-select" className="text-xs font-bold text-surface-500 uppercase tracking-widest">{t('controls.language')}</label>
          <select
            id="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'es' | 'hi')}
            className="px-4 py-2 rounded-2xl border-2 border-surface-200 bg-white text-surface-700 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 shadow-[0_4px_0_0_var(--color-surface-200)] transition-transform active:translate-y-1 active:shadow-none hover:bg-surface-50"
          >
            <option value="en">US English 🇺🇸</option>
            <option value="es">ES Espanol 🇪🇸</option>
            <option value="hi">IN Hindi 🇮🇳</option>
          </select>
        </div>
      </div>
    </div>
  );
};
