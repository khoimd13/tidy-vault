import './mockChrome';
import { render } from 'preact';
import { App } from '../src/ui/sidepanel/App';
import '../src/ui/styles.css';

const root = document.getElementById('app');
if (root) render(<App />, root);
