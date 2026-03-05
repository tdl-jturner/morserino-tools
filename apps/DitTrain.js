import React, { useState, useEffect, useRef, useCallback } from 'react';
import htm from 'htm';
import { useSettings } from './Settings.js';
import { Sounder } from '../lib/sounder.js';
import { Decoder, morseToAlphabet } from '../lib/decoder.js';
import { Keyer } from '../lib/keyer.js';
import { practiceTexts } from '../lib/practiceSets.js';

const html = htm.bind(React.createElement);

// Reverse map for encoded letters to morse
const alphabetToMorse = {};
for (const [morse, char] of morseToAlphabet) {
    alphabetToMorse[char] = morse;
}

// ---- Dit Train Component ----
export default function DitTrain() {
    const [settings] = useSettings();
    const [practiceMode, setPracticeMode] = useState(Object.keys(practiceTexts)[0]);
    const [randomize, setRandomize] = useState(false);

    // Practice state
    const [guidedGroups, setGuidedGroups] = useState([]);
    const [groupIndex, setGroupIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [complete, setComplete] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [results, setResults] = useState([]);
    const [lastScore, setLastScore] = useState(null);

    const canvasRef = useRef(null);
    const sounderRef = useRef(null);
    const decoderRef = useRef(null);
    const keyerRef = useRef(null);
    const requestRef = useRef(null);

    const startTimeRef = useRef(performance.now());
    const groupAnchorTimeRef = useRef(null); // Locked starting time for the ENTIRE group
    const userBlocksRef = useRef([]); // {start, end} in units relative to startTime
    const currentDownRef = useRef(null); // start time in units
    const idealBlocksRef = useRef([]); // Pre-calculated ideal blocks for the WHOLE group
    const totalGroupUnitsRef = useRef(0);
    const frozenUnitsRef = useRef(null); // Used to "freeze" the visualizer on group end

    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    const stateRef = useRef({});
    useEffect(() => {
        stateRef.current = {
            groups: guidedGroups,
            groupIndex,
            charIndex,
            complete,
            results,
            retrying,
            idealBlocks: idealBlocksRef.current
        };
    }, [guidedGroups, groupIndex, charIndex, complete, results, retrying]);

    const failGroup = useCallback((reason = "Incorrect sequence.") => {
        if (stateRef.current.retrying) return;

        // Capture final position before freezing
        const unitMs = 1200 / settingsRef.current.wpm;
        frozenUnitsRef.current = (performance.now() - startTimeRef.current) / unitMs;

        setRetrying(true);
        setResults(prev => [...prev, false]);
        setTimeout(() => {
            setCharIndex(0);
            setResults([]);
            setRetrying(false);
            userBlocksRef.current = [];
            groupAnchorTimeRef.current = null;
            frozenUnitsRef.current = null;
        }, 2000);
    }, []);

    // Calculate timing score (0-100)
    const calculateTimingScore = (userBlocks, idealBlocks, groupStartTime) => {
        if (!userBlocks.length || !idealBlocks.length) return 0;
        if (!groupStartTime) return 0;

        let totalError = 0;
        let totalWeight = 0;

        const count = Math.min(userBlocks.length, idealBlocks.length);
        for (let i = 0; i < count; i++) {
            const idealStart = groupStartTime + idealBlocks[i].start;
            const idealEnd = idealStart + idealBlocks[i].units;

            const startError = Math.abs(userBlocks[i].start - idealStart);
            const endError = Math.abs(userBlocks[i].end - idealEnd);

            totalError += (startError + endError);
            totalWeight += idealBlocks[i].units;
        }

        const countDiff = Math.abs(idealBlocks.length - userBlocks.length);
        totalError += countDiff * 2;

        if (totalWeight === 0) return 0;
        const score = Math.max(0, 100 * (1 - (totalError / 2) / totalWeight));
        return Math.floor(score);
    };

    // Handle incoming decoded letter
    const handleDecodedLetter = useCallback((letter) => {
        const gs = stateRef.current;
        if (gs.complete || gs.retrying || !gs.groups.length) return;

        const currentGroup = gs.groups[gs.groupIndex];
        if (!currentGroup) return;

        const expectedChar = currentGroup[gs.charIndex];
        if ((letter === ' ' || !letter.trim()) && expectedChar !== ' ') return;

        const isCorrect = letter.toUpperCase() === expectedChar.toUpperCase();

        if (!isCorrect) {
            failGroup();
            return;
        }

        const newResults = [...gs.results, isCorrect];
        setResults(newResults);

        const nextCharIdx = gs.charIndex + 1;

        if (nextCharIdx >= currentGroup.length) {
            const score = calculateTimingScore(userBlocksRef.current, gs.idealBlocks, groupAnchorTimeRef.current);
            setLastScore(score);

            const unitMs = 1200 / settingsRef.current.wpm;
            frozenUnitsRef.current = (performance.now() - startTimeRef.current) / unitMs;

            if (score < 80) {
                failGroup("Timing failure.");
            } else {
                setTimeout(() => {
                    const nextGroupIdx = gs.groupIndex + 1;
                    if (nextGroupIdx >= gs.groups.length) {
                        setComplete(true);
                    } else {
                        setGroupIndex(nextGroupIdx);
                        setCharIndex(0);
                        setResults([]);
                        userBlocksRef.current = [];
                        groupAnchorTimeRef.current = null;
                        frozenUnitsRef.current = null;
                        setLastScore(null);
                    }
                }, 1500);
            }
        } else {
            setCharIndex(nextCharIdx);
        }
    }, [failGroup]);

    // Tool initialization
    useEffect(() => {
        const sounder = new Sounder();
        sounderRef.current = sounder;
        const decoder = new Decoder(handleDecodedLetter);
        decoder.setMode(1);
        decoderRef.current = decoder;
        const keyer = new Keyer(sounder, decoder);
        keyerRef.current = keyer;

        const originalPress = keyer.press.bind(keyer);
        keyer.press = (e, isDown) => {
            if (frozenUnitsRef.current !== null) return; // Prevent keying while frozen

            const unitMs = 1200 / settingsRef.current.wpm;
            const nowUnits = (performance.now() - startTimeRef.current) / unitMs;

            if (isDown && !currentDownRef.current) {
                currentDownRef.current = nowUnits;
                if (groupAnchorTimeRef.current === null) {
                    groupAnchorTimeRef.current = nowUnits;
                }
            } else if (!isDown && currentDownRef.current) {
                userBlocksRef.current.push({
                    start: currentDownRef.current,
                    end: nowUnits
                });
                if (userBlocksRef.current.length > 200) userBlocksRef.current.shift();
                currentDownRef.current = null;
            }
            originalPress(e, isDown);
        };

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
            if (sounderRef.current) sounderRef.current.stop();
        };
    }, [handleDecodedLetter]);

    useEffect(() => {
        if (!keyerRef.current || !decoderRef.current) return;
        keyerRef.current.setWpm(settings.wpm);
        keyerRef.current.setMode(settings.mode);
        keyerRef.current.setTone(settings.tone);
        decoderRef.current.setMode(1);
        decoderRef.current.setWpm(settings.wpm);
    }, [settings]);

    // Load practice sets
    useEffect(() => {
        if (practiceTexts[practiceMode]) {
            let pts = [...practiceTexts[practiceMode].groups];
            if (randomize) {
                for (let i = pts.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [pts[i], pts[j]] = [pts[j], pts[i]];
                }
            }
            setGuidedGroups(pts);
            setGroupIndex(0);
            setCharIndex(0);
            setResults([]);
            setComplete(false);
            setLastScore(null);
            userBlocksRef.current = [];
            groupAnchorTimeRef.current = null;
            frozenUnitsRef.current = null;
            startTimeRef.current = performance.now();
        }
    }, [practiceMode, randomize]);

    // Pre-calculate ideal blocks for the WHOLE group
    useEffect(() => {
        const group = guidedGroups[groupIndex] || '';
        if (!group) {
            idealBlocksRef.current = [];
            totalGroupUnitsRef.current = 0;
            return;
        }
        const blocks = [];
        let pos = 0;
        const chars = group.toUpperCase().split('');
        chars.forEach((char, idx) => {
            if (char === ' ') {
                pos += 7;
                return;
            }
            const morse = alphabetToMorse[char];
            if (morse) {
                for (let i = 0; i < morse.length; i++) {
                    const units = morse[i] === '1' ? 1 : 3;
                    blocks.push({ type: 'on', units, start: pos });
                    pos += units;
                    if (i < morse.length - 1) pos += 1; // intra
                }
                if (idx < chars.length - 1 && chars[idx + 1] !== ' ') {
                    pos += 3; // inter
                }
            }
        });
        idealBlocksRef.current = blocks;
        totalGroupUnitsRef.current = pos;
    }, [guidedGroups, groupIndex]);

    const animate = useCallback(() => {
        const unitMs = 1200 / settings.wpm;
        const realTimeUnits = (performance.now() - startTimeRef.current) / unitMs;

        // Use frozen units if available, otherwise follow real time
        const nowUnits = frozenUnitsRef.current !== null ? frozenUnitsRef.current : realTimeUnits;

        // Timeout Logic: Fail after 2x the expected group length
        if (groupAnchorTimeRef.current !== null && frozenUnitsRef.current === null && !stateRef.current.retrying && !stateRef.current.complete) {
            const elapsed = nowUnits - groupAnchorTimeRef.current;
            if (elapsed > (totalGroupUnitsRef.current * 2) + 20) {
                failGroup("Timeout: Rhythmic flow lost.");
            }
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        const unitWidth = 40;
        const playHeadX = width - 80;

        ctx.fillStyle = '#001e26';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#073642';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const gridOffset = (nowUnits % 1) * unitWidth;
        for (let x = playHeadX - gridOffset; x > 0; x -= unitWidth) {
            ctx.moveTo(x, 0); ctx.lineTo(x, height);
        }
        ctx.stroke();

        const currentGroup = guidedGroups[groupIndex] || '';
        if (currentGroup) {
            ctx.fillStyle = 'rgba(38, 139, 210, 0.25)';
            const scrollOffset = groupAnchorTimeRef.current !== null ? (nowUnits - groupAnchorTimeRef.current) : 0;

            idealBlocksRef.current.forEach(block => {
                const x = playHeadX + (block.start - scrollOffset) * unitWidth;
                const blockWidth = block.units * unitWidth;

                // Only drawn in the past (to the left of playhead)
                if (x < playHeadX) {
                    const visibleWidth = Math.min(blockWidth, playHeadX - x);
                    if (x + visibleWidth > 0) {
                        ctx.fillRect(x, 15, Math.max(0, visibleWidth - 2), height - 30);
                    }
                }
            });
        }

        ctx.fillStyle = '#859900';
        userBlocksRef.current.forEach(block => {
            const x = playHeadX + (block.start - nowUnits) * unitWidth;
            const w = (block.end - block.start) * unitWidth;
            if (x + w > 0 && x < width) {
                ctx.fillRect(x, 22, Math.min(w, playHeadX - x), 56);
            }
        });

        if (currentDownRef.current !== null && frozenUnitsRef.current === null) {
            const w = (nowUnits - currentDownRef.current) * unitWidth;
            ctx.fillRect(playHeadX - w, 22, w, 56);
        }

        ctx.strokeStyle = '#cb4b16';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(playHeadX, 0); ctx.lineTo(playHeadX, height);
        ctx.stroke();

        requestRef.current = requestAnimationFrame(animate);
    }, [settings.wpm, guidedGroups, groupIndex, failGroup]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [animate]);

    if (complete) {
        return html`
            <div className="tool-card dit-train">
                <div className="tool-header"><h3>Dit Train ✓ Successful</h3></div>
                <div style=${{ padding: '2rem', textAlign: 'center' }}>
                    <p style=${{ color: 'var(--green)', fontSize: '1.2rem', fontWeight: 'bold' }}>All Groups Mastered!</p>
                    <button className="primary-btn" style=${{ marginTop: '2rem' }} onClick=${() => setComplete(false)}>Restart</button>
                </div>
            </div>
        `;
    }

    return html`
        <div className="tool-card dit-train">
            <div className="tool-header">
                <h3>Dit Train</h3>
                <p className="tool-subtitle">Strict Rhythmic Mode. Maintain the flow of the entire group.</p>
            </div>

            <div className="control-group" style=${{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style=${{ minWidth: '100%' }}>
                    <label className="control-label">
                        Practice Set:
                        <select value=${practiceMode} onChange=${e => setPracticeMode(e.target.value)} className="mode-select"
                            style=${{ padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', width: '100%' }}>
                            ${Object.entries(practiceTexts).map(([key, val]) => html`<option key=${key} value=${key}>${val.label}</option>`)}
                        </select>
                    </label>
                </div>
            </div>

            <div className="visualizer-container" style=${{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', margin: '1rem 0' }}>
                 <canvas ref=${canvasRef} width="600" height="100" style=${{ width: '100%', height: '100px', display: 'block' }} />
            </div>

            <div className="output-area" style=${{ minHeight: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', fontWeight: 'bold' }}>
                ${(guidedGroups[groupIndex] || '').split('').map((ch, idx) => {
        let color = 'var(--text-secondary)';
        if (idx < charIndex) color = results[idx] ? 'var(--green)' : 'var(--red)';
        else if (idx === charIndex) color = 'var(--accent-color)';
        return html`<span key=${idx} style=${{ color, borderBottom: idx === charIndex ? '3px solid var(--accent-color)' : 'none', margin: '0 6px' }}>${ch}</span>`;
    })}
            </div>

            <div style=${{ marginTop: '1rem', textAlign: 'center', fontSize: '1rem', color: 'var(--text-primary)' }}>
                ${lastScore !== null && html`
                    <div style=${{ color: lastScore >= 80 ? 'var(--green)' : 'var(--red)', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                        Timing Accuracy: ${lastScore}% ${lastScore >= 80 ? '✓' : '✗'}
                    </div>
                `}
                Progress: ${groupIndex + 1} / ${guidedGroups.length}
                ${retrying && !lastScore && html`<div style=${{ color: 'var(--red)', fontWeight: 'bold', marginTop: '0.5rem' }}>Incorrect sequence. Try again...</div>`}
                ${retrying && lastScore && lastScore < 80 && html`<div style=${{ color: 'var(--red)', fontWeight: 'bold', marginTop: '0.5rem' }}>Timing failure (below 80%). Maintain the flow!</div>`}
            </div>
            
            <div style=${{ marginTop: '1.5rem', textAlign: 'center' }}>
                <button className="primary-btn" style=${{ width: 'auto' }} onClick=${() => {
            setGroupIndex(0); setCharIndex(0); setResults([]); userBlocksRef.current = []; groupAnchorTimeRef.current = null; setLastScore(null); frozenUnitsRef.current = null;
        }}>Reset Drill</button>
            </div>
        </div>
    `;
}
