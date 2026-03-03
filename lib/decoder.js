const morseToAlphabet = new Map([
	["12", "A"],
	["2111", "B"],
	["2121", "C"],
	["211", "D"],
	["1", "E"],
	["1121", "F"],
	["221", "G"],
	["1111", "H"],
	["11", "I"],
	["1222", "J"],
	["212", "K"],
	["1211", "L"],
	["22", "M"],
	["21", "N"],
	["222", "O"],
	["1221", "P"],
	["2212", "Q"],
	["121", "R"],
	["111", "S"],
	["2", "T"],
	["112", "U"],
	["1112", "V"],
	["122", "W"],
	["2112", "X"],
	["2122", "Y"],
	["2211", "Z"],
	["12222", "1"],
	["11222", "2"],
	["11122", "3"],
	["11112", "4"],
	["11111", "5"],
	["21111", "6"],
	["22111", "7"],
	["22211", "8"],
	["22221", "9"],
	["22222", "0"],
	["121212", "."],
	["221122", ","],
	["21121", "/"],
	["112211", "?"],
	["212122", "!"],
	["211112", "-"],
	["21221", "("],
	["212212", ")"],
	["222111", ":"],
]);

class Decoder {
	static FIXED_SPEED = 1; // User sets speed, decoder uses it strictly
	static SPEED_TRACKING = 2; // Decoder adjusts speed based on user input

	// --- Calculation Methods --- Moved Up ---
	calculateUnit(wpm) {
		if (wpm <= 0) return 80; // Default to ~15 WPM if invalid
		return 1200 / wpm; // Standard PARIS method unit length
	}

	calculateWpm() {
		if (this.unit <= 0) return 15; // Default to 15 if unit is invalid
		return 1200 / this.unit;
	}

	// --- Constructor ---
	constructor(onLetterDecoded, options = {}) {
		this.onLetterDecoded = onLetterDecoded; // Store the callback function
		this.lastLetter = '';
		this.decodeArray = ''; // Stores '1' for dit, '2' for dah
		this.unitAverageWeight = options.unitAverageWeight || 5; // How much history to average for unit estimation
		this.mode = options.mode !== undefined ? options.mode : Decoder.SPEED_TRACKING;
		this.wpm = options.wpm || 15;
		this.farnsworth = options.farnsworth !== undefined ? options.farnsworth : 1; // Multiplier, 1 = standard
		this.unit = this.calculateUnit(this.wpm); // Initial unit length in ms
		this.keyStartTime = null; // Timestamp when key went down
		this.keyEndTime = null;   // Timestamp when key went up
		this.spaceTimer = null;
		this.wordTimer = null; // Timer for word boundaries
		this.wordTimeout = 0; // Will be set by #updateTimeouts

		// Store recent classified timings for stats
		this.maxHistory = 20;
		this.recentDits = [];
		this.recentDahs = [];
		this.recentIntraCharSpaces = [];
		this.recentInterCharSpaces = []; // Note: Inter-char space is trickier, depends on Farnsworth

		// For visual timing bar
		this.currentLetterTimings = []; // Stores { type: 'mark'/'space', duration: ms } for the letter being keyed
		this.lastLetterTimings = null; // Stores timings for the most recently completed letter
		this.#updateTimeouts();
	}

	keyOn() {
		clearTimeout(this.spaceTimer);
		clearTimeout(this.wordTimer); // Clear the wordTimer as well since we are receiving input

		const now = Date.now();

		// Classify and record space duration if applicable
		if (this.keyEndTime) { // Check if there was a previous keyOff
			const spaceDuration = now - this.keyEndTime;
			// Simple classification (can be refined): > 2 units = inter-char, otherwise intra-char
			// TODO: Refine space classification using Farnsworth setting
			if (spaceDuration > this.unit * 2) { // Arbitrary threshold for now
				this.#addTimingStat(this.recentInterCharSpaces, spaceDuration);
			} else if (spaceDuration >= 10) { // Filter out tiny spaces/bounces < 10ms
				this.#addTimingStat(this.recentIntraCharSpaces, spaceDuration);
				// Also store for visual bar
				this.currentLetterTimings.push({ type: 'space', duration: spaceDuration });
			}
		}
		this.keyStartTime = now; // Record start time of the mark
	}

	keyOff() {
		this.keyEndTime = Date.now();
		var keyDuration = (this.keyStartTime) ? this.keyEndTime - this.keyStartTime : 0;

		// Record the mark duration
		const MIN_MARK_DURATION = 10; // ms - Filter out key bounce/noise
		if (keyDuration < MIN_MARK_DURATION) {
			console.log(`Ignoring mark duration ${keyDuration}ms (too short)`);
			this.keyStartTime = null; // Prevent space calculation based on this noisy keyOff
			return; // Ignore this key press entirely
		}

		// Classify and record mark duration
		if (keyDuration > 0) {
			// Classify based on comparison to unit length (e.g., midpoint)
			const ditDahThreshold = this.unit * 2; // ~ midpoint between dit (1) and dah (3)
			if (keyDuration < ditDahThreshold) {
				this.#addTimingStat(this.recentDits, keyDuration); // Store duration
				this.registerDit(keyDuration); // Pass duration for potential unit adjustment
			} else {
				this.#addTimingStat(this.recentDahs, keyDuration); // Store duration
				this.registerDah(keyDuration); // Pass duration for potential unit adjustment
			}
			// Also store for visual bar
			this.currentLetterTimings.push({ type: 'mark', duration: keyDuration });
		}

		// The registerDit/Dah calls below handle the unit adjustment and building decodeArray

		let spaceTime = this.unit * 2; // Fixed 2-unit gap for robust letter end detection
		this.spaceTimer = setTimeout(() => { // end sequence and decode letter
			console.log(`Decoding: '${this.decodeArray}'`);
			this.updateLastLetter(this.morseToLetter(this.decodeArray));
			this.decodeArray = ''; // Clear pattern *after* decoding
			this.startWordTimer(); // Start the word timer after finishing a letter
		}, spaceTime, "keyOff");
	}

	registerDit(duration) {
		this.decodeArray += '1';
		if (this.mode === Decoder.SPEED_TRACKING && duration > 0) {
			// Update unit based on this dit (simple weighted average)
			// Give more weight to history to avoid wild swings
			this.unit = (this.unit * (this.unitAverageWeight - 1) + duration) / this.unitAverageWeight;
			this.unit = Math.max(20, this.unit); // Prevent unit from becoming too small (e.g. > 60 WPM)
			this.wpm = this.calculateWpm(); // Update WPM based on new unit
			this.#updateTimeouts(); // Recalculate space timeouts
			// console.log("Unit updated by Dit:", this.unit.toFixed(1));
		}
	}

	registerDah(duration) {
		this.decodeArray += '2';
		if (this.mode === Decoder.SPEED_TRACKING && duration > 0) {
			// Update unit based on this dah (dah is 3 units, so estimate unit as duration/3)
			const estimatedUnit = duration / 3;
			this.unit = (this.unit * (this.unitAverageWeight - 1) + estimatedUnit) / this.unitAverageWeight;
			this.unit = Math.max(20, this.unit); // Prevent unit from becoming too small
			this.wpm = this.calculateWpm(); // Update WPM based on new unit
			this.#updateTimeouts(); // Recalculate space timeouts
			// console.log("Unit updated by Dah:", this.unit.toFixed(1));
		}
	}

	updateLastLetter(letter) {
		//updateCurrentLetter(letter);
		this.lastLetter = letter;

		// Store the timings for the completed letter (for visual bar) and reset for the next one
		this.lastLetterTimings = [...this.currentLetterTimings];
		this.currentLetterTimings = [];

		// Notify the callback function that a new letter is decoded
		if (this.onLetterDecoded) {
			this.onLetterDecoded(letter);
		}
	}

	morseToLetter(sequence) {
		var letter = morseToAlphabet.get(sequence);
		if (letter) {
			return letter;
		} else {
			return '*';
		}
	}

	startWordTimer() {
		// Set up the word timer to add a space after a word boundary
		this.wordTimer = setTimeout(() => {
			// Update with a space to indicate a word boundary
			if (this.onLetterDecoded) {
				this.onLetterDecoded(' ');
			}
		}, this.wordTimeout);
	}

	setFarnsworth(farnsworth) {
		this.farnsworth = farnsworth;
		this.#updateTimeouts();
	}

	getLastLetterTimings() {
		return this.lastLetterTimings;
	}

	#addTimingStat(array, duration) { // Make private helper
		// Convert duration to integer ms before storing
		const durationMs = Math.round(duration);
		array.push(durationMs);
		if (array.length > this.maxHistory) {
			array.shift(); // Remove oldest
		}
	}

	#calculateStats(arr) {
		if (!arr || arr.length === 0) {
			return { avg: NaN, min: NaN, max: NaN };
		}
		const sum = arr.reduce((a, b) => a + b, 0);
		const avg = Math.round(sum / arr.length);
		const min = Math.round(Math.min(...arr));
		const max = Math.round(Math.max(...arr));
		return { avg, min, max };
	}

	getStats(type) {
		let dataArray;
		switch (type) {
			case 'dit':
				dataArray = this.recentDits;
				break;
			case 'dah':
				dataArray = this.recentDahs;
				break;
			case 'intraCharSpace':
				dataArray = this.recentIntraCharSpaces;
				break;
			case 'interCharSpace':
				dataArray = this.recentInterCharSpaces;
				break;
			default:
				dataArray = [];
		}
		return this.#calculateStats(dataArray);
	}

	setMode(mode) {
		this.mode = mode;
		console.log("Decoder mode set to:", mode === Decoder.SPEED_TRACKING ? "Adaptive" : "Fixed");
	}

	setWpm(wpm) {
		if (this.mode === Decoder.FIXED_SPEED) {
			this.wpm = wpm;
			this.unit = this.calculateUnit(this.wpm);
			this.#updateTimeouts();
		}
	}

	clearStats() {
		this.recentDits = [];
		this.recentDahs = [];
		this.recentIntraCharSpaces = [];
		this.recentInterCharSpaces = [];
	}

	#updateTimeouts() {
		// Calculate word timeout based on unit length and Farnsworth multiplier
		// Standard word gap is 7 units. Farnsworth multiplier scales this.
		// Ensure Farnsworth is at least 1 to avoid zero/negative timeout.
		const effectiveFarnsworth = Math.max(1, this.farnsworth || 1);
		this.wordTimeout = this.unit * 7 * effectiveFarnsworth;

		// Recalculate any other timeouts if needed here
		// console.log(`Updated Timeouts: Unit=${this.unit.toFixed(1)}, FarnsMult=${effectiveFarnsworth}, WordGap=${this.wordTimeout.toFixed(1)}`);
	}
}

export { Decoder, morseToAlphabet };
