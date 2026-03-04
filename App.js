import React, { useState } from 'react';
import htm from 'htm';
import Settings from './apps/Settings.js';
import CwPractice from './apps/CwPractice.js';
import EchoTrainer from './apps/EchoTrainer.js';
import About from './apps/About.js';
import { initializeAudio } from './lib/sounder.js';

const html = htm.bind(React.createElement);

// Registry of all available tools
// To add a new tool, import it above and add it to this object.
const apps = {
  about: {
    name: 'About',
    description: 'Learn about compatibility and how to use these tools.',
    component: About,
    icon: 'ℹ️'
  },
  settings: {
    name: 'Settings',
    description: 'Configure WPM, mode, Farnsworth ratio, and tone globally.',
    component: Settings,
    icon: '⚙️'
  },
  cwPractice: {
    name: 'CW Practice',
    description: 'Practice sending Morse code with live adaptive stats.',
    component: CwPractice,
    icon: '📝'
  },
  echoTrainer: {
    name: 'Echo Trainer',
    description: 'Listen to Morse code and echo it back to practice receiving.',
    component: EchoTrainer,
    icon: '🔊'
  }
};

export default function App() {
  const [currentAppId, setCurrentAppId] = useState(null);

  const startApp = (id) => {
    initializeAudio();
    setCurrentAppId(id);
  };

  if (currentAppId && apps[currentAppId]) {
    const ActiveApp = apps[currentAppId].component;
    return html`
      <div className="app-container">
        <header className="app-header">
          <button className="back-btn" onClick=${() => setCurrentAppId(null)}>
            <span className="icon">←</span> Menu
          </button>
          <h2>${apps[currentAppId].name}</h2>
        </header>
        <main className="app-content">
          <${ActiveApp} />
        </main>
      </div>
    `;
  }

  return html`
    <div className="menu-container">
      <header className="menu-header">
        <h1>Morserino Tools</h1>
        <p className="subtitle">Select a tool to begin.</p>
      </header>
      <div className="menu-list">
        ${Object.entries(apps).map(([id, app]) => html`
          <button key=${id} className="menu-item" onClick=${() => startApp(id)}>
            <div className="menu-item-icon-large">${app.icon}</div>
            <div className="menu-item-info">
              <div className="menu-item-title">${app.name}</div>
            </div>
            <div className="menu-item-chevron">→</div>
          </button>
        `)}
      </div>
    </div>
  `;
}
