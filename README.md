# Model Verification Bench · bench.wall.cloud

A daily scorecard of weather models against U.S. airport (ASOS) observations, with climatology and
persistence baselines, station maps for every state, and gridded storm case studies.

- **Model scores**: the [dynamical.org forecast scorecard](https://dynamical.org/scorecard/) (GFS, GEFS, HRRR,
  RRFS, RRFS ENS, REFS, ECMWF IFS ENS, AIFS Single, AIFS ENS, WeatherNext 2, HRDPS) at about 2,650 stations.
- **Baselines** this project scores itself from dynamical.org's ASOS archive: climatology (last 10 complete
  years) and persistence, processed the same way as the scorecard.
- **Case studies**: MRMS vs model precipitation read from dynamical.org's Zarr stores.

The site is static files on Cloudflare (Workers static assets). A GitHub Actions job rebuilds the data every
morning and deploys it.

## How it works

```
GitHub Actions (daily, ~3 min)                       Cloudflare
 ├─ pipeline/bench.py scores    scorecard Parquet ─┐
 ├─ pipeline/bench.py obs       ASOS Parquet (HTTP │  wrangler deploy
 │                              range reads)       ├─────────────────► bench.wall.cloud
 ├─ pipeline/bench.py baselines climatology/persist│                  (dist/: site + data)
 └─ site/ copied to dist/  ────────────────────────┘
```

- `site/`: the page (`index.html`, `app.js`), self-hosted d3-geo/topojson (`vendor/`), U.S. Census county
  boundaries (`geo/`), committed case-study data (`data/case/`), `_headers` (caching, CSP).
- `pipeline/bench.py`: the data pipeline. Polars (a Rust query engine) reads only the needed Parquet columns
  over HTTP, so a year of hourly observations (~54 million rows) takes about 8 seconds. The climatology CRPS
  kernel is compiled with Numba. Peak memory is about 2 GB.
- `.cache/` (kept by GitHub Actions): the last 11 years of hourly observations as compact 16-bit arrays
  (~200 MB) and the compiled kernel. Daily runs re-read only the current year.
- `dist/`: build output, deployed as-is. About 66 MB in 60 files; Cloudflare compresses JSON on the way out.

## One-time setup

1. **wall.cloud on Cloudflare.** The domain must be an active zone in your Cloudflare account. Remove any
   existing DNS record for `bench.wall.cloud` (a custom domain can't replace an existing CNAME).
2. **GitHub repository.** Create an empty repository and push this folder:
   ```bash
   git remote add origin git@github.com:<you>/bench-wall-cloud.git
   git push -u origin main
   ```
3. **Cloudflare API token.** Cloudflare dashboard → My Profile → API Tokens → Create Token → template
   **Edit Cloudflare Workers**. Limit it to your account and the `wall.cloud` zone.
4. **GitHub secrets.** Repository → Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN`: the token from step 3
   - `CLOUDFLARE_ACCOUNT_ID`: shown on the Cloudflare dashboard's account home page
5. **First deploy.** Repository → Actions → *Build and deploy* → Run workflow. The first run takes about
   5 minutes (it builds the observation cache); later runs about 3.
6. Open https://bench.wall.cloud. If the custom domain isn't attached yet, the site is also at
   `https://bench-wall-cloud.<your-subdomain>.workers.dev`; add the domain under Workers & Pages →
   bench-wall-cloud → Settings → Domains & Routes, then set `"workers_dev": false` in `wrangler.jsonc`.

After that it updates itself every day at 11:40 UTC, and on every push to `main`.

## Local development

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
bash scripts/build.sh                 # builds dist/ (first run ~4 min)
python -m http.server -d dist 8000    # http://localhost:8000
npx wrangler deploy                   # optional: deploy from your machine (after `npx wrangler login`)
```

Front-end changes only: edit `site/`, then copy it over an existing `dist/` (`cp -R site/. dist/`).

## Adding a storm case study

Add an entry to `pipeline/cases.json` (window, bounding box, model runs), then:

```bash
python pipeline/case_study.py <case-id> site/data .cache
git add site/data/case && git commit -m "Add case study <case-id>"
```

The page shows a case on any state whose `state` matches, with a picker when there are several.

## Data and licenses

- dynamical.org scorecard and ASOS archive: **CC BY-NC-SA 4.0** (non-commercial, share-alike). Scores derived
  from them on this site carry the same license. Commercial use needs permission from dynamical.org.
- NOAA MRMS, GFS, GEFS, HRRR, RRFS: U.S. government, public domain. ECMWF IFS and AIFS open data: CC BY 4.0.
- County and state boundaries: U.S. Census Bureau cartographic boundary files via
  [us-atlas](https://github.com/topojson/us-atlas) (ISC). d3-array, d3-geo, topojson-client: ISC.
