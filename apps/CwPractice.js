import React, { useState, useEffect, useRef, useCallback } from 'react';
import htm from 'htm';
import { useSettings } from './Settings.js';
import { Decoder, morseToAlphabet } from '../lib/decoder.js';
import { Keyer } from '../lib/keyer.js';
import { Sounder } from '../lib/sounder.js';

window.restartAudioNeeded = () => false;
window.restartAudio = () => { };

const html = htm.bind(React.createElement);

// Practice text definitions for guided CW Practice modes.
const practiceTexts = {
    aazz: {
        label: 'AAZZ - Letter Pairs',
        groups: [
            'AAABAC', 'ADAEAF', 'AGAHAI', 'AJAKAL', 'AMANAO', 'APAQAR', 'ASATAU', 'AVAWAX', 'AYAZ',
            'BBBCBD', 'BEBFBG', 'BHBIBJ', 'BKBLBM', 'BNBOBP', 'BQBRBS', 'BTBUBV', 'BWBXBY', 'BZ',
            'CCCDCE', 'CFCGCH', 'CICJCK', 'CLCMCN', 'COCPCQ', 'CRCSCT', 'CUCVCW', 'CXCYVZ',
            'DDDEDF', 'DGDHDI', 'DJDKDL', 'DMDNDO', 'DPDQDR', 'DSDTDU', 'DVDWDX', 'DYDZ',
            'EEEFEG', 'EHEIEJ', 'EKELEM', 'ENEOEP', 'EQERES', 'ETEUEV', 'EWEXEY', 'EZ',
            'FFFGFH', 'FIFJFK', 'FLFMFN', 'FOFPFQ', 'FRFSFT', 'FUFVFW', 'FXFYFZ',
            'GGGHGI', 'GJGKGL', 'GMGNGO', 'GPGQGR', 'GSGTGU', 'GVGWGX', 'GYGZ',
            'HHHIHJ', 'HKHLHM', 'HNHOHP', 'HQHRHS', 'HTHUHV', 'HWHXHY', 'HZ',
            'IIIJIK', 'ILIMIN', 'IOIPIQ', 'IRISIT', 'IUIVIW', 'IXIYIZ',
            'JJJKJL', 'JMJNJO', 'JPJQJR', 'JSJTJU', 'JVJWJX', 'JYJZ',
            'KKKLKM', 'KNKOKP', 'KQKRKS', 'KTKUKV', 'KWKXKY', 'KZ',
            'LLLMLN', 'LOLPLQ', 'LRLSLT', 'LULVLW', 'LXLYLZ',
            'MMMNMO', 'MPMQMR', 'MSMTMU', 'MVMWMX', 'MYMZ',
            'NNNONP', 'NQNRNS', 'NTNUNV', 'NWNXNY', 'NZ',
            'OOOPOQ', 'OROSOT', 'OUOVOW', 'OXOYOZ',
            'PPPQPR', 'PSPTPU', 'PVPWPX', 'PYPZ',
            'QQQRQS', 'QTQUQV', 'QWQXQY', 'QZ',
            'RRRRRT', 'RURVRW', 'RXRYRZ',
            'SSSTSU', 'SVSWSX', 'SYSZ',
            'TTTUTV', 'TWTVTY', 'TZ',
            'UUUVUW', 'UXUYUZ',
            'VVVWVX', 'VYVZ',
            'WWWXWY', 'WZ',
            'XXXYXZ',
            'YYYZ',
            'ZZ'
        ]
    },
    bensbest: {
        label: "Ben's Best",
        groups: ['BENS BEST BENT WIRE']
    },
    cwa_warmup: {
        label: 'CWA - Warm Up',
        groups: [
            'EEEEE', 'TTTTT', 'IIIII', 'MMMMM', 'SSSSS', 'OOOOO', 'HHHHH', '00000', '55555',
            'AAAAA', 'NNNNN', 'UUUUU', 'DDDDD', 'VVVVV', 'BBBBB', '44444', '66666',
            'ABCDEF', 'GHIJK', 'LMNOP', 'QRSTU', 'VWXYZ', '12345', '67890',
            'THE', 'QUICK', 'BROWN', 'FOX', 'JUMPED', 'OVER', 'THE', 'LAZY', 'DOGS', 'BACK', '70364', '51289'
        ]
    },
    cwa_exercise: {
        label: 'CWA - Exercise',
        groups: [
            'AAAAA', 'BBBBB', 'CCCCC', 'DDDDD', 'EEEEE', 'FFFFF', 'GGGGG', 'HHHHH', 'IIIII', 'JJJJJ',
            'KKKKK', 'LLLLL', 'MMMMM', 'NNNNN', 'OOOOO', 'PPPPP', 'QQQQQ', 'RRRRR',
            'SSSSS', 'TTTTT', 'UUUUU', 'VVVVV', 'WWWWW', 'XXXXX', 'YYYYY', 'ZZZZZ',
            '11111', '22222', '33333', '44444', '55555', '66666', '77777', '88888', '99999', '00000'
        ]
    },
    cwa_drill: {
        label: 'CWA - Drill',
        groups: [
            'THE', 'QUICK', 'BROWN', 'FOX', 'JUMPED', 'OVER', 'THE', 'LAZY', 'DOGS', 'BACK', '70364', '51289',
            'THE', 'QUICK', 'BROWN', 'FOX', 'JUMPED', 'OVER', 'THE', 'LAZY', 'DOGS', 'BACK', '70364', '51289',
            'BENS', 'BEST', 'BENT', 'WIRE/5', 'BENS', 'BEST', 'BENT', 'WIRE/5', 'BENS', 'BEST', 'BENT', 'WIRE/5'
        ]
    }
};

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

    return html`
        <div style=${{ display: 'flex', height: '24px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', overflow: 'hidden', width: '100%', borderRadius: '4px' }}>
            ${timings.map((t, idx) => {
        const duration = Math.max(t.duration, 0);
        const percentage = (duration / ownTotalDuration) * 100;
        const isMark = t.type === 'mark';

        // Enforce a minimum width so thin elements (especially gaps) remain visible
        const minWidth = percentage > 0 ? (isMark ? '1px' : '3px') : '0';

        return html`
                    <div key=${idx} style=${{
                flex: `0 0 ${percentage}%`,
                width: percentage + '%',
                minWidth: minWidth,
                height: '100%',
                backgroundColor: isMark ? 'var(--blue)' : 'var(--bg-color)',
                opacity: isMark ? 0.9 : 1
            }}></div>
                `;
    })}
        </div>
    `;
};

// ---- Guided Mode Sub-component ----
function formatElapsed(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
        return minutes + 'm ' + seconds + 's';
    }
    return seconds + 's';
}

function GuidedDisplay({ groups, groupIndex, charIndex, results, retrying, elapsedMs, drillLabel, complete }) {
    if (!groups || groups.length === 0) return null;

    if (complete) {
        // All done!
        return html`
            <div style=${{ padding: '2rem', textAlign: 'center' }}>
                <h3 style=${{ color: 'var(--green)', marginBottom: '1rem' }}>✓ Complete!</h3>
                <p style=${{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>You've completed <strong>${drillLabel}</strong> in <strong>${formatElapsed(elapsedMs)}</strong>.</p>
            </div>
        `;
    }

    const currentGroup = groups[groupIndex];
    if (!currentGroup) return null;

    // Build the display for the current group
    const letters = currentGroup.split('');

    return html`
        <div style=${{ fontFamily: 'var(--font-mono)', fontSize: '2rem', letterSpacing: '4px', minHeight: '80px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px' }}>
            ${letters.map((ch, idx) => {
        let color = 'var(--base01)'; // Upcoming: dim
        if (idx < charIndex) {
            // Already answered
            color = results[idx] ? 'var(--green)' : 'var(--red)';
        } else if (idx === charIndex && !retrying) {
            color = 'var(--accent-color)'; // Current: highlighted
        }
        return html`<span key=${idx} style=${{ color, fontWeight: idx === charIndex && !retrying ? 'bold' : 'normal', textDecoration: idx === charIndex && !retrying ? 'underline' : 'none' }}>${ch}</span>`;
    })}
        </div>
        ${retrying ? html`
            <div style=${{ marginTop: '0.75rem', fontSize: '1rem', color: 'var(--yellow)', fontWeight: 'bold' }}>
                ✗ Try again...
            </div>
        ` : html`
            <div style=${{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Group ${groupIndex + 1} of ${groups.length}
            </div>
        `}
    `;
}

export default function CwPractice() {
    const [settings] = useSettings();
    const [practiceMode, setPracticeMode] = useState('open');
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

    // --- Guided mode state ---
    const [guidedGroups, setGuidedGroups] = useState([]);
    const [guidedGroupIndex, setGuidedGroupIndex] = useState(0);
    const [guidedCharIndex, setGuidedCharIndex] = useState(0);
    const [guidedResults, setGuidedResults] = useState([]); // array of booleans per char in current group
    const [guidedComplete, setGuidedComplete] = useState(false);
    const [guidedRetrying, setGuidedRetrying] = useState(false);
    const guidedStartTimeRef = useRef(null);
    const [guidedElapsedMs, setGuidedElapsedMs] = useState(0);
    const [guidedRunningTime, setGuidedRunningTime] = useState(0);
    const guidedTimerRef = useRef(null);

    // Start/stop the running timer interval
    const startRunningTimer = () => {
        if (guidedTimerRef.current) return; // already running
        guidedTimerRef.current = setInterval(() => {
            if (guidedStartTimeRef.current) {
                setGuidedRunningTime(Date.now() - guidedStartTimeRef.current);
            }
        }, 1000);
    };
    const stopRunningTimer = () => {
        if (guidedTimerRef.current) {
            clearInterval(guidedTimerRef.current);
            guidedTimerRef.current = null;
        }
    };

    // Ref so the decoder callback can always read the latest guided state
    const guidedStateRef = useRef({
        mode: 'open',
        groups: [],
        groupIndex: 0,
        charIndex: 0,
        results: [],
        complete: false,
        retrying: false
    });

    // Keep ref in sync
    useEffect(() => {
        guidedStateRef.current = {
            mode: practiceMode,
            groups: guidedGroups,
            groupIndex: guidedGroupIndex,
            charIndex: guidedCharIndex,
            results: guidedResults,
            complete: guidedComplete,
            retrying: guidedRetrying
        };
    }, [practiceMode, guidedGroups, guidedGroupIndex, guidedCharIndex, guidedResults, guidedComplete, guidedRetrying]);

    // Refs to hold mutable tool instances
    const decoderRef = useRef(null);
    const keyerRef = useRef(null);
    const sounderRef = useRef(null);
    const settingsRef = useRef(settings);

    // Always keep settingsRef current so event listeners have access to latest state
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // Handle incoming decoded letter (called from decoder callback)
    const handleDecodedLetter = useCallback((letter, decoder) => {
        updateStats(decoder);

        if (letter && letter.trim()) {
            const wpmToUse = settingsRef.current.wpm;
            const ideal = getIdealTiming(letter, wpmToUse);
            const actual = typeof decoder.getLastLetterTimings === 'function' ? decoder.getLastLetterTimings() : [];
            setLastTimings({ ideal, actual });
        }

        const gs = guidedStateRef.current;

        if (gs.mode === 'open') {
            // Freestyle: just append
            setInput(prev => prev + letter);
        } else {
            // Guided mode
            if (gs.complete || gs.retrying || !gs.groups.length) return;
            if (!letter || !letter.trim()) return; // Ignore spaces from word timer

            // Start the timer on the very first keypress
            if (!guidedStartTimeRef.current) {
                guidedStartTimeRef.current = Date.now();
                startRunningTimer();
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
                    // Show "try again" message, then reset after a delay
                    setGuidedRetrying(true);
                    setTimeout(() => {
                        setGuidedCharIndex(0);
                        setGuidedResults([]);
                        setGuidedRetrying(false);
                    }, 1500);
                } else {
                    // Advance to next group
                    const nextGroup = gs.groupIndex + 1;
                    if (nextGroup >= gs.groups.length) {
                        const elapsed = guidedStartTimeRef.current ? Date.now() - guidedStartTimeRef.current : 0;
                        setGuidedElapsedMs(elapsed);
                        setGuidedRunningTime(elapsed);
                        stopRunningTimer();
                        setGuidedComplete(true);
                    } else {
                        setGuidedGroupIndex(nextGroup);
                        setGuidedCharIndex(0);
                        setGuidedResults([]);
                    }
                }
            } else {
                setGuidedCharIndex(nextCharIdx);
            }
        }
    }, []);

    // Initialize keyer tools on first render
    useEffect(() => {
        const sounder = new Sounder();
        sounderRef.current = sounder;

        const decoder = new Decoder((letter) => {
            handleDecodedLetter(letter, decoder);
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
            clearInterval(keyer.oscillatorTimer);
        };
    }, [handleDecodedLetter]);

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

    // When practice mode changes, set up the guided text
    useEffect(() => {
        guidedStartTimeRef.current = null;
        setGuidedElapsedMs(0);
        setGuidedRunningTime(0);
        stopRunningTimer();
        if (practiceMode === 'open') {
            setGuidedGroups([]);
            setGuidedGroupIndex(0);
            setGuidedCharIndex(0);
            setGuidedResults([]);
            setGuidedComplete(false);
        } else if (practiceTexts[practiceMode]) {
            setGuidedGroups(practiceTexts[practiceMode].groups);
            setGuidedGroupIndex(0);
            setGuidedCharIndex(0);
            setGuidedResults([]);
            setGuidedComplete(false);
        }
        // Clear freestyle input when switching
        setInput('');
        setLastTimings({ actual: [], ideal: [] });
    }, [practiceMode]);

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
        if (settings.mode === 1) {
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
        // Reset guided state for current mode
        if (practiceMode !== 'open') {
            setGuidedCharIndex(0);
            setGuidedResults([]);
            setGuidedComplete(false);
            setGuidedGroupIndex(0);
            guidedStartTimeRef.current = null;
            setGuidedElapsedMs(0);
            setGuidedRunningTime(0);
            stopRunningTimer();
        }
    };

    // Build practice mode dropdown options
    const modeOptions = [
        html`<option key="open" value="open">Open (Freestyle)</option>`
    ];
    for (const [key, val] of Object.entries(practiceTexts)) {
        modeOptions.push(html`<option key=${key} value=${key}>${val.label}</option>`);
    }

    return html`
        <div className="tool-card cw-practice">
            <div className="tool-header">
                <h3>CW Practice</h3>
                <p className="tool-subtitle">${practiceMode === 'open' ? 'Freestyle practice mode to key characters with live adaptive stats.' : 'Key the highlighted character. Green = correct, red = miss. Repeat failed groups.'}</p>
            </div>

            <div className="control-group">
                <label className="control-label">
                    Practice Sets:
                    <select 
                        value=${practiceMode} 
                        onChange=${e => setPracticeMode(e.target.value)}
                        className="mode-select"
                        style=${{ padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                    >
                        ${modeOptions}
                    </select>
                </label>
            </div>

            ${practiceMode === 'open' ? html`
                <div className="output-area" style=${{ fontSize: '2rem', minHeight: '150px', letterSpacing: '2px', wordBreak: 'break-all', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', fontFamily: 'var(--font-mono)' }}>
                    ${input || html`<span style=${{ color: 'var(--text-secondary)' }}>Start keying...</span>`}
                </div>
            ` : html`
                <div className="output-area" style=${{ minHeight: '150px', padding: '1rem', position: 'relative' }}>
                    ${guidedStartTimeRef.current && html`
                        <div style=${{ position: 'absolute', top: '0.5rem', right: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            ${formatElapsed(guidedComplete ? guidedElapsedMs : guidedRunningTime)}
                        </div>
                    `}
                    <${GuidedDisplay}
                        groups=${guidedGroups}
                        groupIndex=${guidedGroupIndex}
                        charIndex=${guidedCharIndex}
                        results=${guidedResults}
                        retrying=${guidedRetrying}
                        elapsedMs=${guidedElapsedMs}
                        drillLabel=${practiceTexts[practiceMode] ? practiceTexts[practiceMode].label : practiceMode}
                        complete=${guidedComplete}
                    />
                </div>
            `}

            <div style=${{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
                <button className="primary-btn" style=${{ padding: '0.5rem 1rem', width: 'auto' }} onClick=${handleClear}>${practiceMode === 'open' ? 'Clear' : 'Restart'}</button>
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
