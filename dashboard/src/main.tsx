import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
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
