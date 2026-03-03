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

class Sounder {
    constructor() {
        this.oscillator = null;
        this.gainNode = null;
        this.isInitialized = false;
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
        this.oscillator.frequency.value = 550;
        this.oscillator.type = 'sine';
        this.gainNode.gain.value = 0.00001;
        this.oscillator.start();
        this.isInitialized = true;
    }

    setTone(freq) {
        if (!this.isInitialized) this.initialize();
        this.oscillator.frequency.value = freq;
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