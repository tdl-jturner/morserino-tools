import React, { useState, useEffect, useRef, useCallback } from 'react';
import htm from 'htm';
import { useSettings } from './Settings.js';
import { Decoder, morseToAlphabet } from '../lib/decoder.js';
import { Keyer } from '../lib/keyer.js';
import { Sounder } from '../lib/sounder.js';
import { practiceTexts } from '../lib/practiceSets.js';

const html = htm.bind(React.createElement);

// ---- Echo Trainer Component ----
export default function EchoTrainer() {
    const [settings] = useSettings();
    const [practiceMode, setPracticeMode] = useState(Object.keys(practiceTexts)[0]);
    const [randomize, setRandomize] = useState(false);

    // Guided state
    const [guidedGroups, setGuidedGroups] = useState([]);
    const [guidedGroupIndex, setGuidedGroupIndex] = useState(0);
    const [guidedCharIndex, setGuidedCharIndex] = useState(0);
    const [guidedResults, setGuidedResults] = useState([]);
    const [guidedComplete, setGuidedComplete] = useState(false);
    const [guidedRetrying, setGuidedRetrying] = useState(false);
    const [revealed, setRevealed] = useState(false);

    const decoderRef = useRef(null);
    const keyerRef = useRef(null);
    const sounderRef = useRef(null);
    const settingsRef = useRef(settings);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const guidedStateRef = useRef({
        groups: [],
        groupIndex: 0,
        charIndex: 0,
        results: [],
        complete: false,
        retrying: false
    });
    useEffect(() => {
        guidedStateRef.current = {
            groups: guidedGroups,
            groupIndex: guidedGroupIndex,
            charIndex: guidedCharIndex,
            results: guidedResults,
            complete: guidedComplete,
            retrying: guidedRetrying
        };
    }, [guidedGroups, guidedGroupIndex, guidedCharIndex, guidedResults, guidedComplete, guidedRetrying]);

    const playCurrentGroup = useCallback(async () => {
        if (!sounderRef.current || guidedComplete) return;
        const group = guidedGroups[guidedGroupIndex];
        if (!group) return;

        sounderRef.current.setWpm(settings.wpm, settings.farnsworth);
        sounderRef.current.setTone(settings.tone || 550);
        await sounderRef.current.playText(group);
    }, [guidedComplete, guidedGroups, guidedGroupIndex, settings]);

    const handleDecodedLetter = useCallback((letter, decoder) => {
        if (letter === ' ') return;

        const gs = guidedStateRef.current;
        if (gs.complete || gs.retrying || !gs.groups.length) return;

        // Error signal (<err>)
        if (letter === '<err>') {
            setGuidedRetrying(true);
            setTimeout(() => {
                setGuidedCharIndex(0);
                setGuidedResults([]);
                setGuidedRetrying(false);
            }, 1000);
            return;
        }

        const currentGroup = gs.groups[gs.groupIndex];
        if (!currentGroup) return;

        const expectedChar = currentGroup[gs.charIndex];
        const isCorrect = letter.toUpperCase() === expectedChar.toUpperCase();

        const newResults = [...gs.results, isCorrect];
        setGuidedResults(newResults);

        const nextCharIdx = gs.charIndex + 1;

        if (nextCharIdx >= currentGroup.length) {
            // End of group
            const anyFailed = newResults.some(r => !r);
            if (anyFailed) {
                setGuidedRetrying(true);
                setTimeout(() => {
                    setGuidedCharIndex(0);
                    setGuidedResults([]);
                    setGuidedRetrying(false);
                    playCurrentGroup();
                }, 1500);
            } else {
                const nextGroupIdx = gs.groupIndex + 1;
                if (nextGroupIdx >= gs.groups.length) {
                    setGuidedComplete(true);
                } else {
                    setGuidedGroupIndex(nextGroupIdx);
                    setGuidedCharIndex(0);
                    setGuidedResults([]);
                    setRevealed(false);
                }
            }
        } else {
            setGuidedCharIndex(nextCharIdx);
        }
    }, [playCurrentGroup]);

    useEffect(() => {
        const sounder = new Sounder();
        sounderRef.current = sounder;
        const decoder = new Decoder((letter) => {
            if (handleDecodedLetter) handleDecodedLetter(letter, decoder);
        });
        decoderRef.current = decoder;
        const keyer = new Keyer(sounder, decoder);
        keyerRef.current = keyer;

        const handleKeyDown = (e) => {
            if (sounder.initialize) sounder.initialize();
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
            if (sounderRef.current) {
                if (sounderRef.current.stop) sounderRef.current.stop();
                else sounderRef.current.off();
            }
            clearInterval(keyer.oscillatorTimer);
        };
    }, []); // Only initialize once

    useEffect(() => {
        if (!keyerRef.current || !decoderRef.current || !sounderRef.current) return;
        const { wpm, mode, farnsworth, tone = 550 } = settings;
        keyerRef.current.setWpm(wpm);
        keyerRef.current.setMode(mode);
        keyerRef.current.setTone(tone);
        decoderRef.current.setFarnsworth(farnsworth);
        sounderRef.current.setWpm(wpm, farnsworth);
        sounderRef.current.setTone(tone);
    }, [settings]);

    useEffect(() => {
        setGuidedGroupIndex(0);
        setGuidedCharIndex(0);
        setGuidedResults([]);
        setGuidedComplete(false);
        setRevealed(false);

        if (practiceTexts[practiceMode]) {
            let groups = [...practiceTexts[practiceMode].groups];
            if (randomize) {
                for (let i = groups.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [groups[i], groups[j]] = [groups[j], groups[i]];
                }
            }
            setGuidedGroups(groups);
        }
    }, [practiceMode, randomize]);

    // Automatically play the current group whenever the set or index changes
    useEffect(() => {
        if (guidedGroups.length > 0 && !guidedComplete && !guidedRetrying) {
            const timer = setTimeout(playCurrentGroup, 600);
            return () => clearTimeout(timer);
        }
    }, [guidedGroups, guidedGroupIndex, playCurrentGroup, guidedComplete, guidedRetrying]);

    // UI Rendering
    if (guidedComplete) {
        return html`
            <div className="tool-card echo-trainer">
                <div className="tool-header">
                    <h3>Echo Trainer ✓ Complete!</h3>
                </div>
                <div style=${{ padding: '2rem', textAlign: 'center' }}>
                    <p style=${{ color: 'var(--green)', fontSize: '1.2rem', fontWeight: 'bold' }}>Drill Finished!</p>
                    <button className="primary-btn" style=${{ marginTop: '2rem' }} onClick=${() => setGuidedComplete(false)}>Restart</button>
                </div>
            </div>
        `;
    }

    const currentGroup = guidedGroups[guidedGroupIndex] || '';
    const letters = currentGroup.split('');

    return html`
        <div className="tool-card echo-trainer">
            <div className="tool-header">
                <h3>Echo Trainer</h3>
                <p className="tool-subtitle">Listen to the Morse, then echo it back with your key.</p>
            </div>

            <div className="control-group" style=${{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style=${{ minWidth: '100%' }}>
                    <label className="control-label">
                        Practice Set:
                        <select 
                            value=${practiceMode} 
                            onChange=${e => setPracticeMode(e.target.value)}
                            className="mode-select"
                            style=${{ padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', width: '100%' }}
                        >
                            ${Object.entries(practiceTexts).map(([key, val]) => html`<option key=${key} value=${key}>${val.label}</option>`)}
                        </select>
                    </label>
                </div>
                <div style=${{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style=${{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>Randomize</span>
                    <label className="switch">
                        <input type="checkbox" checked=${randomize} onChange=${e => setRandomize(e.target.checked)} />
                        <span className="slider-toggle"></span>
                    </label>
                </div>
            </div>

            <div className="output-area" style=${{ minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style=${{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button className="primary-btn" style=${{ width: '100%' }} onClick=${playCurrentGroup}>
                        🔊 Play
                    </button>
                    <button className="primary-btn" style=${{ width: '100%', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} onClick=${() => setRevealed(!revealed)}>
                        ${revealed ? 'Hide' : 'Reveal'}
                    </button>
                </div>

                <div style=${{ fontFamily: 'var(--font-mono)', fontSize: '2rem', letterSpacing: '4px', display: 'flex', justifyContent: 'center', gap: '4px', minHeight: '40px' }}>
                    ${letters.map((ch, idx) => {
        let displayChar = revealed || idx < guidedCharIndex ? ch : '_';
        let color = 'var(--text-secondary)';
        if (idx < guidedCharIndex) {
            color = guidedResults[idx] ? 'var(--green)' : 'var(--red)';
        } else if (idx === guidedCharIndex && !guidedRetrying) {
            color = 'var(--accent-color)';
        }
        return html`<span key=${idx} style=${{ color }}>${displayChar}</span>`;
    })}
                </div>

                ${guidedRetrying && html`<div style=${{ textAlign: 'center', color: 'var(--yellow)', fontWeight: 'bold' }}>✗ Try again...</div>`}
            </div>
            
            <div style=${{ marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Target: ${guidedGroupIndex + 1} / ${guidedGroups.length}
            </div>
        </div>
    `;
}
