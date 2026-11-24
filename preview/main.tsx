import './mockChrome';
import { render } from 'preact';
import { App } from '../src/ui/sidepanel/App';
import { I18nProvider } from '../src/ui/i18n';
import '../src/ui/styles.css';

const root = document.getElementById('app');
if (root)
  render(
    <I18nProvider>
      <App />
    </I18nProvider>,
    root,
  );
