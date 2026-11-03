# Earth Climate Dashboard

A static website that pulls monthly data from the [NASA POWER API](https://power.larc.nasa.gov/) and shows:

- Temperature, rainfall, humidity and wind speed charts
- A comparison of the first and last 10 years of data
- A two-year trend estimate (seasonal average + straight-line trend)
- Links to El Niño (ENSO) sources
- Chennai by default, or any latitude/longitude

## Run locally
Open `index.html` in a browser, or run `python -m http.server` in this folder.

## Publish on GitHub Pages
1. Create a public repository, e.g. `earth-climate-dashboard`.
2. Upload `index.html`, `styles.css`, `app.js` and `README.md` to the main folder.
3. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
4. Your site appears at `https://YOUR-USERNAME.github.io/earth-climate-dashboard/`.

## Notes
- NASA POWER data has a reporting delay, so the latest months may be missing.
- The two-year graph is a simple statistical estimate, not an official NASA or scientifically validated climate forecast.
- Rainfall totals are NASA's mm/day values multiplied by days in the month.
