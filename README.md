# Morserino Tools

A suite of tools for learning and operating Morse code, specifically designed to run as a fast, mobile-friendly Single Page Application (SPA).

## Architecture

This project uses a **zero-build-step** React architecture. This means:
- No `npm install`, no `webpack`, no `vite`, and no complex build processes are required.
- It uses [React](https://reactjs.org/) and [HTM](https://github.com/developit/htm) (which provides a JSX-like syntax natively in the browser without compilation) loaded dynamically via modern ES modules.
- The UI features a beautiful, responsive Solarized Dark color palette out-of-the-box.

## How to Run Locally

Since this app uses native ES Modules, you cannot simply double-click `index.html` to open it due to browser CORS policies. You must serve it from a local web server.

If you have Python installed, you can easily start a server from the root of this project:

```bash
# Using Python 3
python -m http.server 8000
```

Then, open your web browser and navigate to:
[http://localhost:8000](http://localhost:8000)

As you edit files (like adding new apps), simply refresh the page in your browser to see your changes applied instantly.

## Hosting (GitHub Pages)

Because this app requires no build step, you can host it directly from GitHub Pages immediately!

1. Push your code to your GitHub repository (e.g., the `main` or `gh-pages` branch).
2. Go to your repository **Settings** -> **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` branch (or `gh-pages`) and the `/ (root)` folder, then save.
5. In a few minutes, your Morserino tools will be live!

## Adding a New Tool

1. Create a new Javascript component in the `apps/` directory (e.g., `apps/MyNewTool.js`).
2. Your component should be built using React and HTM.
3. Open `App.js` and import your new component at the top.
4. Add an entry to the `apps` registry object in `App.js` with its name, description, icon, and component reference. It will automatically populate in the main menu!
