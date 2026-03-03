import React, { useState, useEffect } from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

export function useSettings() {
    const defaultSettings = {
        mode: 2, // 1: straight key, 2: Iambic A, 3: Iambic B, 4: Ultimatic
        wpm: 20,
        farnsworth: 2
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
        <div className="tool-card">
            <div className="tool-header">
                <h3>Global Settings</h3>
                <p className="tool-subtitle">These settings apply across all your Morse Tools.</p>
            </div>
            
            <div className="control-group">
                <label className="control-label">
                    Keyer Mode:
                    <select 
                        value=${settings.mode} 
                        onChange=${e => updateSetting('mode', parseInt(e.target.value))}
                        className="mode-select"
                        style=${{ padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
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

            <div className="settings-panel instructions-panel" style=${{ marginTop: '2rem', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <h3>Keyboard Shortcuts</h3>
                <p>Use these keys to send Morse code in any tool:</p>
                <ul style=${{ marginLeft: '1.5rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                    <li><kbd>Left Ctrl</kbd> or <kbd>[</kbd> for Dit (.)</li>
                    <li><kbd>Right Ctrl</kbd> or <kbd>]</kbd> for Dah (-)</li>
                </ul>
            </div>
        </div>
    `;
}
