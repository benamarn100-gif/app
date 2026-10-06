// Nur lateinische Zeichensätze (inkl. Erweiterung für z. B. türkische und polnische Namen).
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-ext-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-ext-700.css';
import 'virtual:mednow-theme.css';
import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { readConfig } from './config';
import { createRepository } from './data/RepositoryContext';

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

const repository = await createRepository(readConfig());

createRoot(root).render(
  <StrictMode>
    <App repository={repository} />
  </StrictMode>,
);
