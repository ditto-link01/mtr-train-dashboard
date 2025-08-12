# MTR Train Dashboard

A simple, static dashboard for visualizing Hong Kong MTR train information. Built to be lightweight, fast to load, and easy to deploy as a single HTML page.

---

## Overview

- **Purpose:** Provide a clean, glanceable view of MTR train statuses, lines, and timing in one place.
- **Scope:** Single-page app centered around `index.html`, suitable for GitHub Pages or any static hosting.
- **Audience:** Hobbyists, transit enthusiasts, and anyone who wants a quick MTR snapshot without heavy tooling.
- **Status:** Early-stage project with room for feature expansion and data integration.

---

## Features

- **Minimal setup:** Open `index.html` directly in a browser—no build step required.
- **Fast load:** Pure HTML with optional inline CSS and JavaScript keeps it snappy.
- **Mobile friendly:** Designed with responsive layout principles for phones and tablets.
- **Easy deploy:** Works out of the box on GitHub Pages or any static server.

> Tip: If you plan to hook into live data, keep a fallback view and clearly display the last updated time.

---

## Project structure

- **Root files:**  
  - `index.html` — Main dashboard UI and logic.  
- **Optional additions:**  
  - `assets/` — Images, icons, or static JSON if added later.  
  - `styles/` — External CSS if you split styles out.  
  - `scripts/` — External JS if you modularize logic.

> Keep the HTML semantic and accessible. Use roles and ARIA labels for controls and live regions.

---

## Getting started

- **Open locally:**
  1. **Clone:** `git clone https://github.com/ditto-link01/mtr-train-dashboard.git`
  2. **Run:** Double-click `index.html` or serve with a simple server (e.g., `python -m http.server 8080`).
  3. **View:** Navigate to `http://localhost:8080` if using a local server.

- **Deploy to GitHub Pages:**
  1. **Push:** Ensure `index.html` is on the `main` branch root.
  2. **Enable:** In repository Settings → Pages → Source = `Deploy from a branch`, Branch = `main` and `/root`.
  3. **Share:** Use the generated Pages URL.

- **Configure data:**
  - **Static data:** Start with embedded sample data in `index.html` for layout and styling.
  - **Live data:** If you integrate APIs, document endpoints, rate limits, and update intervals in this README.

- **Development tips:**
  - **Accessibility:** Provide color contrast, keyboard navigation, and descriptive labels.
  - **Performance:** Minify assets, prefer system fonts, and avoid blocking scripts.
  - **Reliability:** Show loading, empty, and error states distinctly.

---

## Contributing and license

- **Issues:** Open a clear issue describing the change, context, and screenshots if UI-related.
- **Pull requests:** Keep PRs focused; add before and after screenshots for UI tweaks.
- **Coding style:** Favor semantic HTML, simple CSS, and plain JavaScript before adding dependencies.
- **License:** Add a `LICENSE` file to clarify usage. Until then, usage is undefined—please open an issue to discuss.

---

## AI generated content disclosure

- **Scope:** Parts of this repository may include AI-generated content, including this README and any boilerplate snippets.
- **Attribution:** Content was generated or assisted by Microsoft Copilot and curated by a human maintainer.
- **Review:** AI-generated text and code should be reviewed for accuracy, security, licensing, and suitability before production use.
- **Contribution policy:** If you contribute AI-generated changes, clearly note it in your PR description and verify that outputs do not include proprietary or license-restricted material.

> Transparency matters. If you later add datasets or external UI elements, document their sources and licenses here.

