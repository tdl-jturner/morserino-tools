// Morse Code Audio Generation Component
let audioCtx = null;
let sounderGlobalVolume = 0.5;

function setSounderGlobalVolume(volume) {
    sounderGlobalVolume = volume;
}

function restartAudioNeeded() {
    if (audioCtx) {
        return audioCtx.state != 'running';
    }
    return false;
}

function restartAudio() {
    audioCtx?.resume();
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

        if (audioCtx == null) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext || window.audioContext)();
        }

        this.oscillator = audioCtx.createOscillator();
        this.gainNode = audioCtx.createGain();
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(audioCtx.destination);
        this.oscillator.frequency.value = this.tone;
        this.oscillator.type = 'sine';
        this.gainNode.gain.value = 0.00001;
        this.oscillator.start();
        this.isInitialized = true;
    }

    setTone(freq) {
        this.tone = freq;
        if (this.isInitialized) {
            this.oscillator.frequency.value = freq;
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
        if (audioCtx.state !== 'running') {
            audioCtx.resume();
        }
        this.gainNode.gain.setTargetAtTime(sounderGlobalVolume, audioCtx.currentTime, 0.001);
    }

    off() {
        if (!this.isInitialized) return;
        this.gainNode.gain.setTargetAtTime(0.00001, audioCtx.currentTime, 0.001);
    }
}

export { Sounder };