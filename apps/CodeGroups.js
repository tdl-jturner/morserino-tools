import React, { useState, useEffect, useRef, useCallback } from 'react';
import htm from 'htm';
import { useSettings } from './Settings.js';
import { Sounder } from '../lib/sounder.js';

const html = htm.bind(React.createElement);

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
const NUMBERS = "0123456789".split('');
const SYMBOLS = "./?,".split('');

export default function CodeGroups() {
    const [settings] = useSettings();
    const [groupLength, setGroupLength] = useState(5);
    const [useLetters, setUseLetters] = useState(true);
    const [useNumbers, setUseNumbers] = useState(false);
    const [useSymbols, setUseSymbols] = useState(false);

    const [currentGroup, setCurrentGroup] = useState('');
    const [userInput, setUserInput] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [lastDrillTarget, setLastDrillTarget] = useState('');
    const [replaysUsed, setReplaysUsed] = useState(0);

    const [stats, setStats] = useState({
        totalChars: 0,
        correctChars: 0,
        totalGroups: 0
    });

    const sounderRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        sounderRef.current = new Sounder();
        return () => {
            if (sounderRef.current) sounderRef.current.stop();
        };
    }, []);

    useEffect(() => {
        if (sounderRef.current) {
            sounderRef.current.setWpm(settings.wpm, settings.farnsworth);
            sounderRef.current.setTone(settings.tone);
        }
    }, [settings]);

    const playMorse = useCallback(async (textToPlay, isReplay = true) => {
        if (isPlaying || !textToPlay) return;
        setIsPlaying(true);
        if (isReplay) {
            setReplaysUsed(prev => prev + 1);
        }

        // Focus immediately so user can type while hearing it
        if (inputRef.current) inputRef.current.focus();

        await new Promise(r => setTimeout(r, 500));
        await sounderRef.current.playText(textToPlay);
        setIsPlaying(false);
    }, [isPlaying]);

    const generateGroup = useCallback(() => {
        let pool = [];
        if (useLetters) pool = [...pool, ...LETTERS];
        if (useNumbers) pool = [...pool, ...NUMBERS];
        if (useSymbols) pool = [...pool, ...SYMBOLS];
        if (pool.length === 0) pool = LETTERS;

        let group = '';
        for (let i = 0; i < groupLength; i++) {
            group += pool[Math.floor(Math.random() * pool.length)];
        }
        setReplaysUsed(0);
        setCurrentGroup(group);
        setUserInput('');
        setShowResult(false);
        playMorse(group, false); // Initial play is not a "replay"
    }, [groupLength, useLetters, useNumbers, useSymbols, playMorse]);

    // Initial group
    useEffect(() => {
        generateGroup();
    }, []);

    const checkResult = useCallback((val) => {
        const target = currentGroup.toUpperCase();
        const attempt = val.toUpperCase();

        let correct = 0;
        for (let i = 0; i < target.length; i++) {
            if (attempt[i] === target[i]) {
                correct++;
            }
        }

        // Penalty: -1 char per replay
        const finalCorrect = Math.max(0, correct - replaysUsed);

        setStats(prev => ({
            totalChars: prev.totalChars + target.length,
            correctChars: prev.correctChars + finalCorrect,
            totalGroups: prev.totalGroups + 1
        }));

        setLastDrillTarget(currentGroup);
        setShowResult(true);

        setTimeout(() => {
            generateGroup();
        }, 2000);
    }, [currentGroup, generateGroup, replaysUsed]);

    const handleInputChange = (e) => {
        if (showResult) return;
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9./?,]/g, '');
        if (val.length <= groupLength) {
            setUserInput(val);
            if (val.length === groupLength) {
                checkResult(val);
            }
        }
    };

    const handleRestart = () => {
        setStats({
            totalChars: 0,
            correctChars: 0,
            totalGroups: 0
        });
        generateGroup();
    };

    const accuracy = stats.totalChars > 0
        ? Math.round((stats.correctChars / stats.totalChars) * 100)
        : 0;

    return html`
        <div className="tool-card code-groups" onClick=${() => inputRef.current?.focus()}>
            <div className="tool-header">
                <h3>Code Groups</h3>
                <p className="tool-subtitle">Copy practice. Auto-plays & auto-checks. <strong>-1 char penalty</strong> per replay.</p>
            </div>

            <div className="control-group" style=${{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style=${{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '0.5rem' }}>
                    <label style=${{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <span style=${{ fontWeight: 'bold' }}>Letters</span>
                        <label className="switch">
                            <input type="checkbox" checked=${useLetters} onChange=${e => setUseLetters(e.target.checked)} />
                            <span className="slider-toggle"></span>
                        </label>
                    </label>
                    <label style=${{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <span style=${{ fontWeight: 'bold' }}>Numbers</span>
                        <label className="switch">
                            <input type="checkbox" checked=${useNumbers} onChange=${e => setUseNumbers(e.target.checked)} />
                            <span className="slider-toggle"></span>
                        </label>
                    </label>
                    <label style=${{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <span style=${{ fontWeight: 'bold' }}>Symbols</span>
                        <label className="switch">
                            <input type="checkbox" checked=${useSymbols} onChange=${e => setUseSymbols(e.target.checked)} />
                            <span className="slider-toggle"></span>
                        </label>
                    </label>
                </div>
                
                <div style=${{ minWidth: '100%' }}>
                    <label className="control-label">
                        Group Length: <span className="value-display">${groupLength}</span>
                        <input 
                            type="range" min="1" max="10" 
                            value=${groupLength} 
                            onChange=${e => setGroupLength(parseInt(e.target.value))}
                            className="slider"
                        />
                    </label>
                </div>
            </div>

            <div className="output-area" style=${{ minHeight: '180px', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', cursor: 'text' }}>
                <div style=${{ display: 'flex', gap: '12px', justifyContent: 'center', width: '100%' }}>
                    ${Array.from({ length: groupLength }).map((_, idx) => {
        const char = userInput[idx] || '';
        const resultChar = showResult ? (lastDrillTarget[idx] || '') : '';
        const isMatch = showResult && char === resultChar;

        return html`
                            <div key=${idx} style=${{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style=${{
                fontSize: '2.5rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                color: showResult ? (isMatch ? 'var(--green)' : 'var(--red)') : 'var(--base2)',
                height: '3.5rem',
                display: 'flex',
                alignItems: 'center'
            }}>
                                    ${char || (showResult ? '_' : '')}
                                </div>
                                <div style=${{
                width: '32px',
                height: '3px',
                backgroundColor: showResult ? (isMatch ? 'var(--green)' : 'var(--red)') : 'var(--accent-color)',
                borderRadius: '2px'
            }}></div>
                                ${showResult && !isMatch && html`
                                    <div style=${{ fontSize: '1rem', color: 'var(--accent-color)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                                        ${resultChar}
                                    </div>
                                `}
                            </div>
                        `;
    })}
                </div>

                <div style=${{ height: '0', overflow: 'hidden' }}>
                    <input 
                        ref=${inputRef}
                        type="text" 
                        value=${userInput}
                        onChange=${handleInputChange}
                        autoFocus
                        disabled=${showResult}
                    />
                </div>

                ${isPlaying && html`
                    <div style=${{ color: 'var(--accent-color)', fontSize: '0.9rem', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
                        🔊 Playing Morse...
                    </div>
                `}
                
                ${showResult && html`
                    <div style=${{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Auto-advancing in 2s...
                    </div>
                `}

                ${!showResult && !isPlaying && html`
                    <div style=${{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <button className="back-btn" onClick=${(e) => { e.stopPropagation(); playMorse(currentGroup, true); }} style=${{ fontSize: '0.85rem' }}>
                            Re-play Audio
                        </button>
                        ${replaysUsed > 0 && html`
                            <div style=${{ fontSize: '0.75rem', color: 'var(--red)' }}>Penalty: -${replaysUsed} char${replaysUsed > 1 ? 's' : ''}</div>
                        `}
                    </div>
                `}
            </div>

            <div style=${{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style=${{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    <span>Accuracy: <span style=${{ color: 'var(--accent-color)', fontWeight: 'bold' }}>${accuracy}%</span></span>
                    <span>Groups: <span style=${{ color: 'var(--base1)' }}>${stats.totalGroups}</span></span>
                </div>
                <button 
                    onClick=${handleRestart}
                    className="back-btn"
                    style=${{ fontSize: '0.85rem', margin: 0, padding: '0.5rem' }}
                >
                    Reset Score
                </button>
            </div>
        </div>
    `;
}
