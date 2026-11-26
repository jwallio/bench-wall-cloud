#!/usr/bin/env bash
# Build the site into dist/: static files from site/, fresh data from the pipeline.
#   CACHE (default .cache) keeps the observation years and the compiled kernel between runs.
set -euo pipefail
cd "$(dirname "$0")/.."
CACHE="${CACHE:-.cache}"
export NUMBA_CACHE_DIR="$CACHE/numba"
rm -rf dist
mkdir -p dist
cp -R site/. dist/
python pipeline/bench.py all --out dist/data --cache "$CACHE"
# sanity checks before anything gets deployed
python - <<'EOF'
import json, pathlib, datetime as dt
d = pathlib.Path('dist/data')
meta = json.loads((d / 'meta.json').read_text())
states = json.loads((d / 'states.json').read_text())
age = (dt.date.today() - dt.date.fromisoformat(meta['period_end'])).days
assert age <= 4, f'scores are {age} days old'
assert 'NOAA GFS' in states['NC'] and 'Climatology' in states['NC'], 'NC scores incomplete'
n = len(list((d / 'st').glob('*.json')))
assert n >= 45, f'only {n} state files'
print(f'OK: verified through {meta["period_end"]}, {len(meta["stations"])} stations, {n} state files')
EOF
du -sh dist
