// Morse Code Audio Generation Component
let audioCtx = null;
let sounderGlobalVolume = 0.5;

export function setSounderGlobalVolume(volume) {
    sounderGlobalVolume = volume;
}

export function initializeAudio() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext || window.audioContext)();
        }

        if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
            audioCtx.resume();
        }

        // iOS specific: Play a tiny puff of silence to "unlock" the audio hardware
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
    } catch (e) {
        // Silent catch for production cleanup
    }
}

import { morseToAlphabet } from './decoder.js';

const alphabetToMorse = new Map();
morseToAlphabet.forEach((letter, morse) => {
    alphabetToMorse.set(letter, morse);
});

class Sounder {
    constructor() {
        this.oscillator = null;
        this.gainNode = null;
        this.isInitialized = false;

        // Playback state
        this.wpm = 20;
        this.farnsworthMultiplier = 1;
        this.tone = 550;
        this.isPlaying = false;
        this.stopFlag = false;
    }

    initialize() {
        if (this.isInitialized) return;

        if (!audioCtx) {
            initializeAudio();
        }

        try {
            this.oscillator = audioCtx.createOscillator();
            this.gainNode = audioCtx.createGain();
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(audioCtx.destination);

            this.oscillator.type = 'sine';
            this.oscillator.frequency.setValueAtTime(this.tone || 550, audioCtx.currentTime);
            this.gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);

            this.oscillator.start();
            this.isInitialized = true;
        } catch (e) {
            // Error handled by missing audio output
        }
    }

    setTone(freq) {
        const newFreq = parseFloat(freq);
        if (isNaN(newFreq)) return;
        this.tone = newFreq;
        if (this.isInitialized && this.oscillator) {
            this.oscillator.frequency.setTargetAtTime(newFreq, audioCtx.currentTime, 0.001);
        }
    }

    setWpm(wpm, multiplier = 1) {
        this.wpm = wpm;
        this.farnsworthMultiplier = Math.max(1, multiplier || 1);
    }

    async playText(text) {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.stopFlag = false;

        if (!this.isInitialized) this.initialize();
        if (audioCtx && audioCtx.state !== 'running') {
            await audioCtx.resume();
        }

        const unit = 1200 / this.wpm;
        const dah = unit * 3;
        const intraChar = unit;
        const interChar = unit * 3 * this.farnsworthMultiplier;
        const interWord = unit * 7 * this.farnsworthMultiplier;

        const chars = text.toUpperCase().split('');

        for (let i = 0; i < chars.length; i++) {
            if (this.stopFlag) break;

            const char = chars[i];
            if (char === ' ') {
                await this.sleep(interWord - interChar);
                continue;
            }

            const morse = alphabetToMorse.get(char);
            if (morse) {
                for (let j = 0; j < morse.length; j++) {
                    if (this.stopFlag) break;

                    const element = morse[j];
                    this.on();
                    await this.sleep(element === '1' ? unit : dah);
                    this.off();

                    if (j < morse.length - 1) {
                        await this.sleep(intraChar);
                    }
                }
            }

            if (i < chars.length - 1) {
                await this.sleep(interChar);
            }
        }

        this.isPlaying = false;
    }

    stop() {
        this.stopFlag = true;
        this.off();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    on() {
        if (!this.isInitialized) this.initialize();
        if (audioCtx && audioCtx.state !== 'running') {
            audioCtx.resume();
        }
        if (this.gainNode) {
            const now = audioCtx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.exponentialRampToValueAtTime(sounderGlobalVolume || 0.5, now + 0.005);
        }
    }

    off() {
        if (!this.isInitialized || !this.gainNode) return;
        const now = audioCtx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.005);
    }
}

export { Sounder };