import React, { useState, useEffect } from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

export function useSettings() {
    const defaultSettings = {
        mode: 2, // 1: straight key, 2: Iambic A, 3: Iambic B, 4: Ultimatic
        wpm: 20,
        farnsworth: 2,
        tone: 550
    };
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('morse-settings');
        return saved ? JSON.parse(saved) : defaultSettings;
    });

    useEffect(() => {
        localStorage.setItem('morse-settings', JSON.stringify(settings));
    }, [settings]);

    return [settings, setSettings];
}

export default function Settings() {
    const [settings, setSettings] = useSettings();

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return html`
        <div className="settings-panel">
            <div className="tool-header" style=${{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <h3 style=${{ margin: 0 }}>Global Settings</h3>
            </div>
            
            <div className="control-group">
                <label className="control-label">
                    Keyer Mode:
                    <select 
                        value=${settings.mode} 
                        onChange=${e => updateSetting('mode', parseInt(e.target.value))}
                        className="mode-select"
                        style=${{ padding: '0.6rem', marginTop: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color-alt)', color: 'var(--text-primary)', width: '100%', fontSize: '1rem' }}
                    >
                        <option value="1">Straight Key</option>
                        <option value="2">Iambic A</option>
                        <option value="3">Iambic B</option>
                        <option value="4">Ultimatic</option>
                    </select>
                </label>
            </div>

            <div className="control-group">
                <label className="control-label">
                    Speed (WPM): <span className="value-display">${settings.wpm}</span>
                    <input 
                        type="range" min="5" max="50" 
                        value=${settings.wpm} 
                        onChange=${e => updateSetting('wpm', parseInt(e.target.value))}
                        className="slider wpm-slider"
                    />
                </label>
            </div>

            <div className="control-group">
                <label className="control-label">
                    Farnsworth Multiplier: <span className="value-display">${settings.farnsworth}x</span>
                    <input 
                        type="range" min="1" max="10" 
                        value=${settings.farnsworth} 
                        onChange=${e => updateSetting('farnsworth', parseInt(e.target.value))}
                        className="slider"
                    />
                </label>
            </div>

            <div className="control-group">
                <label className="control-label">
                    Tone (Hz): <span className="value-display">${settings.tone}</span>
                    <input 
                        type="range" min="300" max="1000" step="10"
                        value=${settings.tone} 
                        onChange=${e => updateSetting('tone', parseInt(e.target.value))}
                        className="slider"
                    />
                </label>
            </div>

            <div className="instructions-panel" style=${{ marginTop: '2rem', padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color-alt)', borderRadius: '8px' }}>
                <h4 style=${{ marginBottom: '0.5rem' }}>Keyboard Shortcuts</h4>
                <ul style=${{ marginLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <li><kbd>Left Ctrl</kbd> or <kbd>[</kbd> for Dit</li>
                    <li><kbd>Right Ctrl</kbd> or <kbd>]</kbd> for Dah</li>
                </ul>
            </div>
        </div>
    `;
}
