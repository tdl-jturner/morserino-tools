import React from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import App from './App.js';

// Initialize htm with React
const html = htm.bind(React.createElement);

// Render the application
const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
