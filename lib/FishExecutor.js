"use strict";

/**************************
 * Import important stuff *
 **************************/

const FishProgram = require("./FishProgram");

/**************************
 * The FishExecutor class *
 **************************/

/**
 * Executes a ><> program
 */
class FishExecutor {
	/**
	 * Creates a new FishExecutor
	 *
	 * @param {String} source	Source code for the program to execute
	 * @param {Number[]} [initialStack]	Initial stack for the program. Defaults to an empty list
	 */
	constructor(source, initialStack) {
		/**
		 * The program itself
		 *
		 * @type FishProgram
		 *
		 * @private
		 */
		this._program = new FishProgram(source, initialStack);

		/**
		 * Output string generated by the program
		 *
		 * @type String
		 *
		 * @private
		 */
		this._output = "";

		/**
		 * Whether or not the program is paused
		 *
		 * @type Boolean
		 *
		 * @private
		 */
		this._isPaused = false;

		/**
		 * Whether or not the program has started
		 *
		 * @type Boolean
		 *
		 * @private
		 */
		this._hasStarted = false;

		/**
		 * Interval (ms) between two advances when running at intervals
		 *
		 * @type Integer
		 *
		 * @private
		 */
		this._intervalTime = 100;

		/**
		 * The timeout for the next run
		 *
		 * @type {Identifier}
		 *
		 * @private
		 */
		this._timeout = null;

		/**
		 * Listeners for advances
		 *
		 * @type Function[]
		 *
		 * @private
		 */
		this._advanceListeners = [];
	}

	/**
	 * Sets a listener for program advances
	 *
	 * @param {Function} func	Function which is called on every advance. Gets this executor as its parameter
	 */
	onAdvance(func) {
		this._advanceListeners.push(func);
	}

	/**
	 * Removes a listener for program advances
	 *
	 * @param {Function} func	The listener to remove
	 */
	offAdvance(func) {
		// Find its index
		const i = this._advanceListeners.indexOf(func);

		// If it is there, splice it out
		if (i >= 0) {
			this._advanceListeners.splice(i, 1);
		}
	}

	/**
	 * The program's instruction pointer. Don't mess with it
	 *
	 * @type InstructionPointer
	 */
	get instructionPointer() {
		return this._program.instructionPointer;
	}

	/**
	 * Characters waiting to be read in the input stream
	 *
	 * @type String[]
	 *
	 * @readonly
	 */
	get inputBuffer() {
		return this._program.inputBuffer;
	}

	/**
	 * Gives a character as input to the program
	 *
	 * @param {String} c	The character to give
	 *
	 * @throws {Error}	If c is not a string or is not exactly one character
	 */
	giveInput(c) {
		this._program.giveInput(c);
	}

	/**
	 * The program's current stack
	 *
	 * @type Number[]
	 *
	 * @readonly
	 */
	get stackSnapshot() {
		return this._program.stack.snapshot;
	}

	/**
	 * Interval (ms) between two advances when running at intervals
	 *
	 * @type Integer
	 */
	get intervalTime() {
		return this._intervalTime;
	}
	set intervalTime(newTime) {
		// Verify that it is a number
		if (Number(newTime) === newTime) {
			// Set it, but no lower than 0
			this._intervalTime = Math.max(newTime, 0);

			// Clear the run timeout
			this._clearTimeout();

			// Run it again if it has started
			if (this._hasStarted) {
				this.run();
			}
		}
	}

	/**
	 * Whether or not the program has started
	 *
	 * @type Boolean
	 *
	 * @readonly
	 */
	get hasStarted() {
		return this._hasStarted;
	}

	/**
	 * Pauses the program execution
	 */
	pause() {
		this._isPaused = true;
	}

	/**
	 * Resumes program execution
	 */
	resume() {
		// Set the flag to false
		this._isPaused = false;

		// Do a run
		this.run();
	}

	/**
	 * Sets a new run timeout
	 *
	 * @param {Integer} ms	Millisecons to wait before next run
	 *
	 * @private
	 */
	_setTimeout(ms) {
		this._timeout = setTimeout(() => {
			// Clear the timeout, so `run` wil actually run
			this._clearTimeout();

			// Do another step
			this.run();
		}, ms);
	}

	/**
	 * Clears the run timeout
	 *
	 * @private
	 */
	_clearTimeout() {
		// Clear and reset it
		clearTimeout(this._timeout);
		this._timeout = null;
	}

	/**
	 * Whether or not the execution is paused
	 *
	 * @type Boolean
	 *
	 * @readonly
	 */
	get isPaused() {
		return this._isPaused;
	}

	/**
	 * Whether or not the program has terminated
	 *
	 * @type Boolean
	 *
	 * @readonly
	 */
	get hasTerminated() {
		return this._program.hasTerminated;
	}

	/**
	 * Starts running the program
	 */
	run() {
		// Set the started flag
		this._hasStarted = true;

		// Don't do anything if the execution is paused, or if a run has been scheduled
		if (this.isPaused || this.hasTerminated || this._timeout !== null) {
			return;
		}

		// Check if it should run as fast as possible or at an interval
		if (this._intervalTime === 0) {
			this._runAtFullSpeed();
		} else {
			this._runAtInterval();
		}

		// Call all advance listeners
		this._advanceListeners.forEach((func) => func(this));
	}

	/**
	 * Runs the program, yielding after every step and resuming after a timeout
	 *
	 * @private
	 */
	_runAtInterval() {
		// Do one step
		this._advance();

		// Schedule next run
		this._setTimeout(this._intervalTime);
	}

	/**
	 * Runs the program at full speed. Yields after a number of advances to allow other things to run
	 *
	 * @private
	 */
	_runAtFullSpeed() {
		// Keep track of how many advances has been made since start, so pauses can be enforced at regular intervals
		let advances = 0;

		// Run a predefined number of advances or until the program terminates
		while (!this.hasTerminated && advances < FishExecutor._FULL_SPEED_ADVANCES) {
			this._advance();

			// Count the advance
			advances++;
		}

		// Schedule next run
		this._setTimeout(0);
	}

	/**
	 * Advances the program one step
	 *
	 * @private
	 */
	_advance() {
		// Advance it
		this._program.advance();

		try {
			// Read the output
			const o = this._program.readOutput();
			this._output += o;
		} catch (err) {
			// Nothing could be read. Don't do anything
		}
	}

	/**
	 * The program itself
	 *
	 * @type FishProgram
	 *
	 * @readonly
	 */
	get program() {
		return this._program;
	}

	/**
	 * Output from the program
	 *
	 * @type String
	 *
	 * @readonly
	 */
	get output() {
		return this._output;
	}

	/**
	 * Number of advances to do before yielding when running at full speed
	 *
	 * @type Integer
	 *
	 * @private
	 *
	 * @constant
	 */
	static get _FULL_SPEED_ADVANCES() {
		return 10000;
	}
}

/*************
 * Export it *
 *************/

module.exports = FishExecutor;