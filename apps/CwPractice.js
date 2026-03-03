import React, { useState, useEffect, useRef } from 'react';
import htm from 'htm';
import { useSettings } from './Settings.js';
import { Decoder, morseToAlphabet } from '../lib/decoder.js?v=9';
import { Keyer } from '../lib/keyer.js';
import { Sounder } from '../lib/sounder.js';

window.restartAudioNeeded = () => false;
window.restartAudio = () => { };

const html = htm.bind(React.createElement);

const ditdahMap = {};
for (const [morse, letter] of morseToAlphabet.entries()) {
    ditdahMap[letter] = morse;
}

function getIdealTiming(letter, wpm) {
    const upperLetter = letter ? letter.toUpperCase() : '';
    const patternString = upperLetter ? ditdahMap[upperLetter] : '';
    if (!patternString) return [];

    const ditDuration = 1200 / wpm;
    const dahDuration = ditDuration * 3;
    const intraCharSpace = ditDuration;

    let timings = [];
    let isFirstElement = true;
    for (const element of patternString) {
        if (!isFirstElement) {
            timings.push({ type: 'space', duration: intraCharSpace });
        }
        if (element === '1') {
            timings.push({ type: 'mark', duration: ditDuration });
        } else if (element === '2') {
            timings.push({ type: 'mark', duration: dahDuration });
        }
        isFirstElement = false;
    }
    return timings;
}

const TimingBar = ({ timings }) => {
    if (!timings || timings.length === 0) return null;
    const ownTotalDuration = timings.reduce((sum, t) => sum + Math.max(t.duration, 0), 0);
    if (ownTotalDuration <= 0) return null;

    const minElementDuration = 1;
    const effectiveTotalDuration = Math.max(ownTotalDuration, minElementDuration * timings.length);

    return html`
        <div style=${{ display: 'flex', height: '24px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', overflow: 'hidden', width: '100%', borderRadius: '4px' }}>
            ${timings.map((t, idx) => {
        const duration = Math.max(t.duration, 0);
        const percentage = (duration / effectiveTotalDuration) * 100;
        const isMark = t.type === 'mark';
        return html`
                    <div key=${idx} style=${{
                width: percentage + '%',
                minWidth: percentage > 0 && percentage < 0.5 ? '1px' : 'auto',
                height: '100%',
                backgroundColor: isMark ? 'var(--blue)' : 'var(--bg-color)',
                opacity: isMark ? 0.9 : 1
            }}></div>
                `;
    })}
        </div>
    `;
};

export default function CwPractice() {
    const [settings] = useSettings();
    const [practiceMode, setPracticeMode] = useState('open'); // Dropdown for "mode" -> Open
    const [input, setInput] = useState('');
    const [calculatedWpm, setCalculatedWpm] = useState('--');
    const [showTiming, setShowTiming] = useState(false);

    // Stats for timing table
    const [stats, setStats] = useState({
        dit: { avg: NaN, min: NaN, max: NaN, ideal: NaN },
        dah: { avg: NaN, min: NaN, max: NaN, ideal: NaN }
    });

    // Graphical timings for the last letter
    const [lastTimings, setLastTimings] = useState({ actual: [], ideal: [] });

    // Refs to hold mutable tool instances
    const decoderRef = useRef(null);
    const keyerRef = useRef(null);
    const sounderRef = useRef(null);
    const settingsRef = useRef(settings);

    // Always keep settingsRef current so event listeners have access to latest state
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // Initialize keyer tools on first render
    useEffect(() => {
        const sounder = new Sounder();
        sounderRef.current = sounder;

        const decoder = new Decoder((letter) => {
            setInput(prev => prev + letter);
            updateStats(decoder);

            if (letter && letter.trim()) {
                const wpmToUse = settingsRef.current.wpm;
                const ideal = getIdealTiming(letter, wpmToUse);
                const actual = typeof decoder.getLastLetterTimings === 'function' ? decoder.getLastLetterTimings() : [];
                setLastTimings({ ideal, actual });
            }
        });
        decoderRef.current = decoder;

        const keyer = new Keyer(sounder, decoder);
        keyerRef.current = keyer;

        // Start listening to key events manually at document level to ensure focus isn't an issue
        const handleKeyDown = (e) => {
            if (sounder && typeof sounder.initialize === 'function') sounder.initialize();

            if (['ControlLeft', 'ControlRight', 'BracketLeft', 'BracketRight'].includes(e.code)) {
                e.preventDefault();
                keyer.press(e, true);
            }
        };

        const handleKeyUp = (e) => {
            if (['ControlLeft', 'ControlRight', 'BracketLeft', 'BracketRight'].includes(e.code)) {
                e.preventDefault();
                keyer.press(e, false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (sounderRef.current) sounderRef.current.off();
            clearInterval(keyer.oscillatorTimer); // Cleanup setInterval memory leak from the class
        };
    }, []);

    // Sync settings changes into the tools dynamically
    useEffect(() => {
        if (!keyerRef.current || !decoderRef.current || !sounderRef.current) return;

        const { wpm, mode, farnsworth, tone = 550 } = settings;
        keyerRef.current.setWpm(wpm);
        keyerRef.current.setMode(mode);
        if (typeof keyerRef.current.setTone === 'function') keyerRef.current.setTone(tone);
        if (typeof sounderRef.current.setTone === 'function') sounderRef.current.setTone(tone);
        decoderRef.current.setFarnsworth(farnsworth);

        updateStats(decoderRef.current);
    }, [settings]);

    const updateStats = (decoder) => {
        if (!decoder) return;

        const idealDit = decoder.unit;
        const idealDah = decoder.unit * 3;

        const ditData = decoder.getStats ? decoder.getStats('dit') : { avg: NaN, min: NaN, max: NaN };
        const dahData = decoder.getStats ? decoder.getStats('dah') : { avg: NaN, min: NaN, max: NaN };

        setStats({
            dit: { ideal: idealDit, ...ditData },
            dah: { ideal: idealDah, ...dahData }
        });

        // WPM update
        if (settings.mode === 1) { // Straight key mode is adaptive
            const cwpm = decoder.calculateWpm();
            setCalculatedWpm(cwpm ? cwpm.toFixed(1) : '--');
        } else {
            setCalculatedWpm(settings.wpm);
        }
    };

    const handleClear = () => {
        setInput('');
        setCalculatedWpm('--');
        setLastTimings({ actual: [], ideal: [] });
        if (decoderRef.current && decoderRef.current.clearStats) {
            decoderRef.current.clearStats();
        }
    };

    return html`
        <div className="tool-card cw-practice">
            <div className="tool-header">
                <h3>CW Practice</h3>
                <p className="tool-subtitle">Freestyle practice mode to key characters with live adaptive stats.</p>
            </div>

            <div className="control-group">
                <label className="control-label">
                    Practice Mode:
                    <select 
                        value=${practiceMode} 
                        onChange=${e => setPracticeMode(e.target.value)}
                        className="mode-select"
                        style=${{ padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                    >
                        <option value="open">Open (Freestyle)</option>
                    </select>
                </label>
            </div>

            <div className="output-area" style=${{ fontSize: '2rem', minHeight: '150px', letterSpacing: '2px', wordBreak: 'break-all', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', fontFamily: 'var(--font-mono)' }}>
                ${input || html`<span style=${{ color: 'var(--text-secondary)' }}>Start keying...</span>`}
            </div>

            <div style=${{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
                <button className="primary-btn" style=${{ padding: '0.5rem 1rem', width: 'auto' }} onClick=${handleClear}>Clear</button>
            </div>

            <div className="timing-collapsible" style=${{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button 
                    onClick=${() => setShowTiming(!showTiming)} 
                    style=${{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 'bold' }}
                >
                    <span style=${{ width: '20px', display: 'inline-block' }}>${showTiming ? '▼' : '▶'}</span>
                    Show Timing Stats
                </button>

                ${showTiming && html`
                    <div className="stats-panel" style=${{ marginTop: '1rem', backgroundColor: 'var(--bg-color-alt)', padding: '1rem', borderRadius: '8px' }}>
                        <div style=${{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div>
                                <strong style=${{ color: 'var(--base1)' }}>Set WPM:</strong> <span style=${{ color: 'var(--accent-color)' }}>${settings.wpm}</span>
                            </div>
                            <div>
                                <strong style=${{ color: 'var(--base1)' }}>Calculated WPM:</strong> <span style=${{ color: 'var(--accent-color)' }}>${calculatedWpm}</span>
                            </div>
                        </div>

                        <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="stat-card" style=${{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px' }}>
                                <h4 style=${{ margin: '0 0 0.5rem 0', color: 'var(--base2)' }}>Dit (ms)</h4>
                                <div>Ideal: <span style=${{ color: 'var(--accent-color)' }}>${stats.dit.ideal ? stats.dit.ideal.toFixed(0) : '--'}</span></div>
                                <div style=${{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Avg/Min/Max: ${!isNaN(stats.dit.avg) ? stats.dit.avg + ' / ' + stats.dit.min + ' / ' + stats.dit.max : '-- / -- / --'}
                                </div>
                            </div>

                            <div className="stat-card" style=${{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px' }}>
                                <h4 style=${{ margin: '0 0 0.5rem 0', color: 'var(--base2)' }}>Dah (ms)</h4>
                                <div>Ideal: <span style=${{ color: 'var(--accent-color)' }}>${stats.dah.ideal ? stats.dah.ideal.toFixed(0) : '--'}</span></div>
                                <div style=${{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Avg/Min/Max: ${!isNaN(stats.dah.avg) ? stats.dah.avg + ' / ' + stats.dah.min + ' / ' + stats.dah.max : '-- / -- / --'}
                                </div>
                            </div>
                        </div>
                        
                        ${(lastTimings.ideal.length > 0 || lastTimings.actual.length > 0) && html`
                            <div className="timing-comparison" style=${{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <h4 style=${{ margin: '0 0 1rem 0', color: 'var(--base2)' }}>Last Character Timing</h4>
                                
                                <div style=${{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', gap: '1rem' }}>
                                    <span style=${{ width: '50px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Ideal:</span>
                                    <div style=${{ flex: 1 }}><${TimingBar} timings=${lastTimings.ideal} /></div>
                                </div>
                                <div style=${{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style=${{ width: '50px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Actual:</span>
                                    <div style=${{ flex: 1 }}><${TimingBar} timings=${lastTimings.actual} /></div>
                                </div>
                            </div>
                        `}
                    </div>
                `}
            </div>
        </div>
    `;
}
