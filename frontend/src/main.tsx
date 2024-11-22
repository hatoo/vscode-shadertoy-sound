import App from './app';
import { createRoot } from 'react-dom/client';
import React from 'react';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';


const container = document.getElementById('app')!;
const root = createRoot(container);
root.render(<App />);