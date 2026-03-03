# Morserino Tools

A suite of tools for learning and operating Morse code, specifically designed to run as a fast, mobile-friendly Single Page Application (SPA).

This is primarily intended for my own usage and borrows from many other CW practice tools and apps.

## Features

- **CW Practice**: Guided drills and freestyle practice with live adaptive statistics.
- **Adaptive Decoder**: Real-time Morse decoding that adjusts to your keying speed.
- **Timing Analysis**: Visual "Ideal vs. Actual" timing bars for every character to help improve your rhythm.
- **Guided Practice Sets**: Predefined drills including AAZZ Letter Pairs, CWA Warmups, Exercises, and more.
- **Solarized Dark Aesthetics**: A premium, responsive design that feels great on both desktop and mobile.

## Architecture

This project uses a **zero-build-step** React architecture.
- **No Build Required**: No `npm install`, no `webpack`, no `vite`. Just vanilla JavaScript modules.
- **Web Audio API**: Real-time sound generation for authentic keying feedback.
- **HTM & React**: Modern component-based UI without the complexity of a transpiler.

## How to Run Locally

Since this app uses native ES Modules, you must serve it from a local web server (simple `file://` access is restricted by browsers).

If you have Python installed, run this command from the project root:

```bash
python -m http.server 8000
```

Then, navigate to: [http://localhost:8000](http://localhost:8000)

## Adding a New Tool

1. Create a new component in the `apps/` directory (e.g., `apps/MyNewTool.js`).
2. Open `App.js` and import your new component.
3. Add an entry to the `apps` registry object in `App.js`. It will automatically appear in the main navigation.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
