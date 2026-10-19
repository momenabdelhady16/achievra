# Achievra

Achievra is a browser-based to-do application. It stores tasks in the browser's LocalStorage and separates the user interface, task workflows, and storage adapter so another repository can replace LocalStorage later.

## Run locally

The app uses native JavaScript modules, so serve the project directory over HTTP instead of opening `index.html` as a `file:` URL.

1. Open this folder in Visual Studio Code and start it with the Live Server extension, or run `python3 -m http.server 8000` from this directory.
2. Open the local address shown by the server (for Python's server, `http://localhost:8000`).

No build step or runtime package installation is required. The interface uses English and is designed for desktop and mobile browsers.

## Project layout

- `index.html` and `css/` define the semantic page and responsive design system.
- `js/models/` and `js/utils/` contain task rules and pure helpers.
- `js/repositories/` defines the asynchronous repository contract and LocalStorage adapter.
- `js/services/` implements storage-independent task workflows.
- `js/views/` owns DOM rendering and interaction feedback.
- `js/app.js` composes the application layers and connects UI events to service operations.
- `tests/` contains the isolated service test suite.

## Development checks

Run the isolated service tests with `npm test` from the project directory. The project has no external runtime dependencies.
