"""Forecast Verification Bench data pipeline.

Builds the static data behind bench.wall.cloud from dynamical.org sources:
  * model scores: dynamical.org forecast scorecard (statistics.parquet, stations.csv)
  * reference forecasts we score ourselves: climatology and persistence, from dynamical.org's
    ASOS archive (asos-parquet on Source Cooperative), processed the same way as the scorecard
  * storm case studies: gridded MRMS vs model precipitation from dynamical.org Zarr stores

Usage:
  python pipeline/bench.py all   --out dist/data --cache .cache
  python pipeline/bench.py scores|obs|baselines --out ... --cache ...
  python pipeline/bench.py case nov2026-nc --out ...

Heavy lifting runs in Polars (a Rust query engine): Parquet is read over HTTP with range requests,
selecting only the needed columns, so one year of hourly observations (about 54 million rows)
takes seconds instead of minutes.
"""
from __future__ import annotations
import argparse, csv, datetime as dt, io, json, os, re, sys, time, urllib.request
from pathlib import Path
import numpy as np
import polars as pl

SCORECARD = 'https://assets.dynamical.org/scorecard'
ASOS = 'https://data.source.coop/dynamical/asos-parquet/year={year}/data.parquet'
TEMP = ['RMSE', 'RMSE_bc', 'MAE', 'MAE_bc', 'Bias', 'CRPS', 'CRPS_bc']
PREC = ['ETS', 'HSS', 'FSS', 'FrequencyBias', 'MAE', 'Bias', 'CRPS']
VM = [('temperature_2m', m) for m in TEMP] + [('precipitation_surface', m) for m in PREC]
PREC_AMOUNT = {'MAE', 'Bias', 'CRPS'}  # mm/s in source -> mm/day here
NS_DAY = 86_400_000_000_000
REFS = ['Climatology', 'Persistence']
CLIM_YEARS_N = 10
WET = 0.1  # mm/h, dynamical.org's wet threshold for 6-hour mean rates


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def rnd(x):
    return None if x is None or not np.isfinite(x) else (0 if x == 0 else float(f'{x:.3g}'))


def download(url: str, path: Path) -> bool:
    """Download if changed (ETag/Last-Modified kept next to the file). Returns True if new content."""
    if os.environ.get('BENCH_OFFLINE') and path.exists():
        return False
    meta = path.with_suffix(path.suffix + '.etag')
    req = urllib.request.Request(url)
    if path.exists() and meta.exists():
        et = meta.read_text().strip()
        if et: req.add_header('If-None-Match', et)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = r.read(); et = r.headers.get('ETag') or ''
    except urllib.error.HTTPError as e:
        if e.code == 304: return False
        raise
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.part'); tmp.write_bytes(data); tmp.replace(path)
    meta.write_text(et)
    return True


def clean_name(n: str) -> str:
    """'ASHEVILLE_MUNICIPAL_(ASOS)' -> 'Asheville Municipal'; leaves mixed-case names alone."""
    s = re.sub(r'_?\((ASOS|AWOS)\)', '', n).replace('_', ' ').strip()
    if s.upper() == s:
        s = re.sub(r'[A-Za-z]+', lambda m: m.group(0).capitalize(), s.lower())
    return re.sub(r'\s+', ' ', s)


# ---------------------------------------------------------------- scores (dynamical.org scorecard)
def load_stations(cache: Path) -> dict:
    st = {}
    for r in csv.DictReader(open(cache / 'stations.csv')):
        if r.get('country') != 'US': continue
        try: lat, lon = float(r['latitude']), float(r['longitude'])
        except ValueError: continue
        try: elev = round(float(r['elevation']))
        except (ValueError, KeyError): elev = None
        st[r['station_id']] = dict(id=r['station_id'], name=clean_name(r['name']), lat=round(lat, 4), lon=round(lon, 4),
                                   state=r['state'], county=r['county'] or '', elev=elev)
    return st


def build_scores(out: Path, cache: Path):
    t0 = time.time()
    download(f'{SCORECARD}/stations.csv', cache / 'stations.csv')
    download(f'{SCORECARD}/statistics.parquet', cache / 'statistics.parquet')
    stations = load_stations(cache)
    df = pl.read_parquet(cache / 'statistics.parquet', columns=['station_id', 'model', 'variable', 'metric', 'lead_time', 'window', 'value', 'min_valid', 'max_valid'])
    log('scorecard rows', df.height)
    vm_df = pl.DataFrame({'variable': [v for v, _ in VM], 'metric': [m for _, m in VM], 'vm': list(range(len(VM)))}, schema={'variable': pl.Utf8, 'metric': pl.Utf8, 'vm': pl.Int32})
    df = df.with_columns(pl.col('variable').cast(pl.Utf8), pl.col('metric').cast(pl.Utf8), pl.col('model').cast(pl.Utf8), pl.col('station_id').cast(pl.Utf8))
    unknown = df.join(vm_df, on=['variable', 'metric'], how='anti').select('variable', 'metric').unique()
    if unknown.height: log('WARNING: unknown variable/metric pairs ignored:', unknown.rows())
    df = (df.join(vm_df, on=['variable', 'metric'])
            .with_columns((pl.col('lead_time').cast(pl.Int64) // NS_DAY).cast(pl.Int32).alias('lead'),
                          (pl.col('window').cast(pl.Int64) / NS_DAY).round().cast(pl.Int32).alias('wd'))
            .with_columns(pl.when(pl.col('variable').eq('precipitation_surface') & pl.col('metric').is_in(list(PREC_AMOUNT)))
                            .then(pl.col('value') * 86400.0).otherwise(pl.col('value')).alias('value'))
            .filter(pl.col('value').is_not_null() & pl.col('value').is_not_nan()))
    windows = sorted(df['wd'].unique().to_list()); leads = list(range(int(df['lead'].max()) + 1))
    W, L = len(windows), len(leads)
    st_state = pl.DataFrame({'station_id': list(stations), 'state': [s['state'] for s in stations.values()]})
    df = df.join(st_state, on='station_id', how='left').with_columns(
        ((pl.col('vm') * W + pl.col('wd').replace_strict(windows, list(range(W)))) * L + pl.col('lead')).alias('cell'))
    NV = len(VM) * W * L
    models = sorted(df['model'].unique().to_list())

    def flat(frame: pl.DataFrame, key: str) -> dict:
        """{key value: {model: [NV floats]}} averaging over stations (NaN-free mean)."""
        g = frame.group_by(key, 'model', 'cell').agg(pl.col('value').mean())
        res = {}
        for (k, m), part in g.group_by([key, 'model']):
            arr = np.full(NV, np.nan); arr[part['cell'].to_numpy()] = part['value'].to_numpy()
            res.setdefault(k, {})[m] = arr
        return res
    has_state = df.filter(pl.col('state').is_not_null() & (pl.col('state') != ''))
    states = flat(has_state, 'state')
    states['US'] = flat(has_state.with_columns(pl.lit('US').alias('us')), 'us')['US']
    states_out = {k: {m: [rnd(x) for x in a] for m, a in v.items()} for k, v in sorted(states.items())}

    # per-station files, one per state: scaled integers, empty = missing
    scale = [100 if v == 'temperature_2m' else 1000 for v, _ in VM]
    scale_cell = np.repeat(np.array(scale, float), W * L)
    (out / 'st').mkdir(parents=True, exist_ok=True)
    per = {}
    for (sid, m), part in has_state.group_by(['station_id', 'model']):
        arr = np.full(NV, np.nan); arr[part['cell'].to_numpy()] = part['value'].to_numpy()
        per.setdefault(stations.get(sid, {}).get('state'), {}).setdefault(sid, {})[m] = arr
    period_end = df['max_valid'].max(); w_max = max(windows)
    pstart = df.filter(pl.col('wd') == w_max)['min_valid'].min()
    fmt_d = lambda v: (v if isinstance(v, dt.datetime) else dt.datetime.fromtimestamp(v / 1e9, dt.UTC)).strftime('%Y-%m-%d')
    scored = set(df['station_id'].unique().to_list())
    meta = dict(source='dynamical.org forecast scorecard (statistics.parquet, stations.csv), CC BY-NC-SA 4.0',
                built=dt.datetime.now(dt.UTC).strftime('%Y-%m-%dT%H:%MZ'),
                models=models, vm=[list(x) for x in VM], windows=windows, leads=leads,
                period_end=fmt_d(period_end), period_start_max=fmt_d(pstart), period_start_180=fmt_d(pstart),
                units={'temperature_2m': 'degC', 'precipitation_amount': 'mm/day'},
                stations=[stations[s] for s in sorted(stations) if s in scored])
    # keep arrays for the baseline merge
    np.savez_compressed(cache / 'scores_arrays.npz', windows=np.array(windows), leads=np.array(leads))
    write_json(out / 'meta.json', meta)
    write_json(out / 'states.json', states_out)
    for state, d in per.items():
        if not state: continue
        obj = {'vm': [list(x) for x in VM], 'windows': windows, 'leads': leads, 'scale': scale,
               's': {sid: {m: encode(a, scale_cell) for m, a in sorted(ms.items())} for sid, ms in sorted(d.items())}}
        write_json(out / 'st' / f'{state}.json', obj)
    log(f'scores: {len(states_out) - 1} states, {len(meta["stations"])} stations, period end {meta["period_end"]}, {time.time() - t0:.0f}s')


def encode(arr, scale_cell):
    q = np.round(arr * scale_cell)
    return ','.join('' if not np.isfinite(x) else str(int(x)) for x in q)


def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.part'); tmp.write_text(json.dumps(obj, separators=(',', ':'))); tmp.replace(path)


# ---------------------------------------------------------------- observations cache
def obs_year(year: int, ids: list[str], cache: Path):
    """Hourly-binned ASOS obs for one year, as dense int16 matrices (stations x hours of year).
    Temperature: hourly mean, 0.1 degC. Precipitation: hourly max of p01m, 0.1 mm. Missing = -32768."""
    t0 = time.time()
    lf = (pl.scan_parquet(ASOS.format(year=year))
            .select('station', 'valid', 'tmpc', 'p01m')
            .filter(pl.col('station').is_in(ids))
            .with_columns((pl.col('valid').dt.epoch('s') // 3600).cast(pl.Int64).alias('h'),
                          pl.when(pl.col('p01m') >= 0).then(pl.col('p01m')).alias('p'))
            .group_by('station', 'h').agg(pl.col('tmpc').mean().alias('t'), pl.col('p').max().alias('p')))
    df = lf.collect()
    h0 = int(dt.datetime(year, 1, 1, tzinfo=dt.UTC).timestamp() // 3600)
    nh = int(dt.datetime(year + 1, 1, 1, tzinfo=dt.UTC).timestamp() // 3600) - h0
    sids = sorted(df['station'].unique().to_list()); idx = {s: i for i, s in enumerate(sids)}
    T = np.full((len(sids), nh), -32768, np.int16); P = np.full((len(sids), nh), -32768, np.int16)
    si = df['station'].replace_strict(idx, return_dtype=pl.Int32).to_numpy(); hi = df['h'].to_numpy() - h0
    ok = (hi >= 0) & (hi < nh)
    t = df['t'].to_numpy(); p = df['p'].to_numpy()
    tv = np.where(np.isfinite(t), np.clip(np.round(t * 10), -32000, 32000), -32768).astype(np.int16)
    pv = np.where(np.isfinite(p), np.clip(np.round(p * 10), 0, 32000), -32768).astype(np.int16)
    T[si[ok], hi[ok]] = tv[ok]; P[si[ok], hi[ok]] = pv[ok]
    (cache / 'obs').mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache / 'obs' / f'{year}.npz', ids=np.array(sids), h0=h0, t=T, p=P)
    log(f'obs {year}: {df.height:,} station-hours, {len(sids)} stations, {time.time() - t0:.0f}s, '
        f'{os.path.getsize(cache / "obs" / f"{year}.npz") / 1e6:.0f} MB')


def update_obs(out: Path, cache: Path, refresh_years: list[int] | None = None):
    meta = json.load(open(out / 'meta.json'))
    ids = [s['id'] for s in meta['stations']]
    end = dt.date.fromisoformat(meta['period_end'])
    years = list(range(end.year - CLIM_YEARS_N, end.year + 1))
    # the current year always changes; the previous year only while late reports still arrive
    refresh = set(refresh_years or [end.year] + ([end.year - 1] if end.timetuple().tm_yday <= 31 else []))
    for y in years:
        f = cache / 'obs' / f'{y}.npz'
        if y in refresh or not f.exists():
            for attempt in range(3):
                try: obs_year(y, ids, cache); break
                except Exception as e:
                    log(f'obs {y} attempt {attempt + 1} failed: {e!r}'[:300])
                    if attempt == 2: raise
                    time.sleep(10)
    for f in (cache / 'obs').glob('*.npz'):
        if int(f.stem) not in years: f.unlink(); log('dropped old obs year', f.stem)


# ---------------------------------------------------------------- baselines
def load_obs(cache: Path, ids: list[str], years: list[int]):
    """Stack cached years aligned to `ids`, hourly from Jan 1 of the first year.
    Returns temperature as int16 tenths of a degree (-32768 = missing; about 0.5 GB for 11 years) and
    precipitation already reduced to 6-hour mean rates in mm/h (float32, NaN = fewer than 4 valid hours)."""
    h0 = int(dt.datetime(years[0], 1, 1, tzinfo=dt.UTC).timestamp() // 3600)
    h1 = int(dt.datetime(years[-1] + 1, 1, 1, tzinfo=dt.UTC).timestamp() // 3600)
    T = np.full((len(ids), h1 - h0), -32768, np.int16); P6 = np.full((len(ids), (h1 - h0) // 6), np.nan, np.float32)
    pos = {s: i for i, s in enumerate(ids)}
    for y in years:
        z = np.load(cache / 'obs' / f'{y}.npz')
        rows = np.array([pos.get(s, -1) for s in z['ids']]); keep = rows >= 0
        off = int(z['h0']) - h0; n = z['t'].shape[1]
        T[rows[keep], off:off + n] = z['t'][keep]
        p = z['p'][keep]; nb = n // 6
        blk = p[:, :nb * 6].reshape(p.shape[0], nb, 6); ok = blk != -32768
        cnt = ok.sum(-1); sm = np.where(ok, blk, 0).sum(-1, dtype=np.float64)
        with np.errstate(invalid='ignore', divide='ignore'):
            P6[rows[keep], off // 6:off // 6 + nb] = np.where(cnt >= 4, sm / np.maximum(cnt, 1) / 10, np.nan)
    return T, P6, h0


def t16(a):
    """int16 tenths -> float32 degrees with NaN."""
    f = a.astype(np.float32) / 10
    f[a == -32768] = np.nan
    return f


try:
    import numba

    @numba.njit(parallel=True, cache=True)
    def _clim_kernel(V, idx, scale, missing, y, out_mean, out_crps):
        """For each station s and target j: climatological sample V[s, idx[j, :]] (values == missing skipped,
        divided by scale). Writes the sample mean and the CRPS of the sample as an ensemble against y[s, j]."""
        NS, NT = y.shape; K = idx.shape[1]
        for s in numba.prange(NS):
            buf = np.empty(K, np.float64)
            for j in range(NT):
                n = 0
                for k in range(K):
                    v = V[s, idx[j, k]]
                    if v != missing and v == v:
                        buf[n] = v / scale; n += 1
                if n < 10:
                    out_mean[s, j] = np.nan; out_crps[s, j] = np.nan; continue
                b = np.sort(buf[:n]); yy = y[s, j]
                m = 0.0; exy = 0.0; exx = 0.0
                for i in range(n):
                    m += b[i]; exy += abs(b[i] - yy); exx += (2 * (i + 1) - n - 1) * b[i]
                out_mean[s, j] = m / n
                out_crps[s, j] = (exy / n - exx / (n * n)) if yy == yy else np.nan
except ImportError:  # pragma: no cover - numpy fallback
    _clim_kernel = None


def clim_stats(V, idx, scale, missing, y):
    mean = np.full(y.shape, np.nan, np.float64); crps = np.full(y.shape, np.nan, np.float64)
    if _clim_kernel is not None:
        _clim_kernel(V, idx.astype(np.int64), float(scale), V.dtype.type(missing), y.astype(np.float64), mean, crps)
        return mean, crps
    for a in range(0, V.shape[0], 32):
        b = min(V.shape[0], a + 32)
        x = V[a:b][:, idx].astype(np.float64)
        x[x == missing] = np.nan; x /= scale
        with np.errstate(invalid='ignore'): mean[a:b] = np.nanmean(x, axis=-1)
        crps[a:b] = crps_sample(x, y[a:b])
    return mean, crps


def crps_sample(x, y):
    """CRPS of empirical ensembles (..., n) with NaNs against obs y (...)."""
    x = np.sort(x, axis=-1); ok = np.isfinite(x); n = ok.sum(-1).astype(np.float64)
    with np.errstate(invalid='ignore', divide='ignore'):
        e_xy = np.nansum(np.abs(x - y[..., None]), axis=-1) / n
        rank = np.arange(1, x.shape[-1] + 1)
        w = np.where(ok, 2 * rank - n[..., None] - 1, 0)
        e_xx = 2 * np.sum(w * np.where(ok, x, 0), axis=-1) / (n * n)
        out = e_xy - 0.5 * e_xx
    out[(n < 10) | ~np.isfinite(y)] = np.nan
    return out


def build_baselines(out: Path, cache: Path):
    """Score climatology and persistence at every station; merge into states.json and st/*.json.
    Climatology: obs at the same UTC hour (temperature) or 6-h bin (precip) within +/-15 days of the date in the
    last 10 complete years (mean for deterministic scores; the whole sample as an ensemble for CRPS).
    Persistence: obs at the same UTC hour/bin d+1 days earlier for lead day d. Window W, lead d: valid times in
    (END - W days + d days, END]. Temperature gaps <= 2 h filled linearly; precip as 6-h mean rates, wet >= 0.1 mm/h."""
    t0 = time.time()
    meta = json.load(open(out / 'meta.json'))
    ids = [s['id'] for s in meta['stations']]; NS = len(ids)
    W = meta['windows']; L = meta['leads']; vi = {tuple(k): i for i, k in enumerate(meta['vm'])}
    END = dt.datetime.fromisoformat(meta['period_end']).replace(tzinfo=dt.UTC)
    years = list(range(END.year - CLIM_YEARS_N, END.year + 1)); clim_years = years[:-1]
    T, P6, h0 = load_obs(cache, ids, years); NH = T.shape[1]; nb = P6.shape[1]
    hix = lambda d: int(d.timestamp() // 3600) - h0
    MAXW = max(W)
    tv = np.arange(hix(END) - MAXW * 24 + 1, hix(END) + 1)            # hourly valid times
    bv = np.arange(hix(END) - MAXW * 24, hix(END) - 5, 6)             # 6-h bin starts (00/06/12/18 UTC)
    tv_dt = [dt.datetime.fromtimestamp((h + h0) * 3600, dt.UTC) for h in tv]
    bv_dt = [dt.datetime.fromtimestamp((h + h0) * 3600, dt.UTC) for h in bv]

    def clim_hours(times):
        cols = []
        for y in clim_years:
            base = np.array([hix(t.replace(year=y, day=min(t.day, 28) if (t.month == 2 and t.day == 29) else t.day)) for t in times])
            cols.append(base[:, None] + 24 * np.arange(-15, 16)[None, :])
        return np.clip(np.concatenate(cols, axis=1), 0, NH - 1)
    CH_T, CH_P = clim_hours(tv_dt), clim_hours(bv_dt)
    # temperature with <= 2 h gaps filled (linear, interior only)
    # recent temperatures (window + 11 days for persistence) as floats, <= 2 h gaps filled
    r0 = max(0, int(tv[0]) - 24 * (max(L) + 2)); r1 = int(tv[-1]) + 1
    TF = fill_gaps(t16(T[:, r0:r1]), 2)
    tf_at = lambda h: TF[:, np.clip(h - r0, 0, r1 - r0 - 1)]
    pb = lambda h: P6[:, np.clip(h // 6, 0, nb - 1)]
    vals = np.full((NS, 2, len(vi), len(W), len(L)), np.nan, np.float32)
    y_t = tf_at(tv); y_p = pb(bv)
    # climatology forecasts (station chunks keep the sample tensors small)
    clim_t, crps_ct = clim_stats(T, CH_T, 10, -32768, y_t)
    clim_p, crps_cp = clim_stats(P6, np.clip(CH_P // 6, 0, nb - 1), 1, np.nan, y_p)
    log(f'climatology samples done, {time.time() - t0:.0f}s')
    tvh = np.array([(t - END).total_seconds() / 3600 for t in tv_dt]); bvh = np.array([(t - END).total_seconds() / 3600 for t in bv_dt])
    for ri in range(2):
        for d in L:
            if ri == 0:
                ft, fp, cr_t, cr_p = clim_t, clim_p, crps_ct, crps_cp
            else:
                ft = tf_at(tv - 24 * (d + 1)); fp = pb(bv - 24 * (d + 1))
                cr_t = np.abs(ft - y_t); cr_p = np.abs(fp - y_p)
            e_t = ft - y_t; e_p = (fp - y_p) * 24
            with np.errstate(invalid='ignore'):
                b180 = np.nanmean(e_t, axis=1, keepdims=True)
            for wi, w in enumerate(W):
                lo = -24 * w + 24 * d
                mt = (tvh > lo)[None, :] & np.isfinite(e_t); mp = (bvh >= lo)[None, :] & np.isfinite(e_p)
                nt = mt.sum(1); np_ = mp.sum(1)
                with np.errstate(invalid='ignore', divide='ignore'):
                    et = np.where(mt, e_t, 0); ep = np.where(mp, e_p, 0)
                    okt = nt >= 24; okp = np_ >= 8
                    put = lambda key, v, ok: vals.__setitem__((slice(None), ri, vi[key], wi, d), np.where(ok, v, np.nan))
                    put(('temperature_2m', 'RMSE'), np.sqrt((et ** 2).sum(1) / nt), okt)
                    put(('temperature_2m', 'MAE'), np.abs(et).sum(1) / nt, okt)
                    put(('temperature_2m', 'Bias'), et.sum(1) / nt, okt)
                    eb = np.where(mt, e_t - b180, 0)
                    put(('temperature_2m', 'RMSE_bc'), np.sqrt((eb ** 2).sum(1) / nt), okt)
                    put(('temperature_2m', 'MAE_bc'), np.abs(eb).sum(1) / nt, okt)
                    mc = mt & np.isfinite(cr_t); put(('temperature_2m', 'CRPS'), np.where(mc, cr_t, 0).sum(1) / mc.sum(1), okt & (mc.sum(1) > 0))
                    put(('precipitation_surface', 'MAE'), np.abs(ep).sum(1) / np_, okp)
                    put(('precipitation_surface', 'Bias'), ep.sum(1) / np_, okp)
                    mc = mp & np.isfinite(cr_p); put(('precipitation_surface', 'CRPS'), np.where(mc, cr_p * 24, 0).sum(1) / mc.sum(1), okp & (mc.sum(1) > 0))
                    if ri == 1:
                        fa = (fp >= WET) & mp; ob = (y_p >= WET) & mp
                        h = (fa & ob).sum(1).astype(float); m = (~fa & ob & mp).sum(1).astype(float); f_ = (fa & ~ob).sum(1).astype(float)
                        n = np_.astype(float); cn = n - h - m - f_
                        r = (h + m) * (h + f_) / n; den = h + m + f_ - r
                        put(('precipitation_surface', 'ETS'), (h - r) / den, okp & (h + m + f_ > 0) & (den != 0))
                        hd = (h + m) * (m + cn) + (h + f_) * (f_ + cn)
                        put(('precipitation_surface', 'HSS'), 2 * (h * cn - m * f_) / hd, okp & (hd > 0))
                        put(('precipitation_surface', 'FrequencyBias'), (h + f_) / (h + m), okp & (h + m > 0))
                    else:
                        # climatology is the no-skill reference for rain/no-rain scores
                        put(('precipitation_surface', 'ETS'), np.zeros(NS), okp)
                        put(('precipitation_surface', 'HSS'), np.zeros(NS), okp)
    log(f'baselines scored for {int(np.isfinite(vals[:, 0, vi[("temperature_2m", "RMSE")], -1, 1]).sum())} stations, {time.time() - t0:.0f}s')
    merge_baselines(out, meta, ids, vals)
    log(f'baselines merged, {time.time() - t0:.0f}s')


def fill_gaps(T, limit):
    """Linear interpolation across interior NaN runs of length <= limit along axis 1."""
    F = T.copy(); NS, NH = T.shape
    fin = np.isfinite(T)
    for s in range(NS):
        row = T[s]; f = fin[s]
        if f.sum() < 2: continue
        idx = np.flatnonzero(f)
        gaps = np.diff(idx) - 1
        for k in np.flatnonzero((gaps > 0) & (gaps <= limit)):
            i0, i1 = idx[k], idx[k + 1]
            F[s, i0 + 1:i1] = row[i0] + (row[i1] - row[i0]) * (np.arange(1, i1 - i0) / (i1 - i0))
    return F


def merge_baselines(out: Path, meta, ids, vals):
    state = {s['id']: s['state'] for s in meta['stations']}
    S = json.load(open(out / 'states.json'))
    groups = {'US': [i for i, s in enumerate(ids) if state.get(s)]}
    for i, s in enumerate(ids):
        if state.get(s): groups.setdefault(state[s], []).append(i)
    for g, idx in groups.items():
        if g not in S: continue
        with np.errstate(invalid='ignore'):
            mean = np.nanmean(vals[idx], axis=0)
        for r, name in enumerate(REFS):
            flat = mean[r].reshape(-1)
            if np.isfinite(flat).any(): S[g][name] = [rnd(x) for x in flat]
    write_json(out / 'states.json', S)
    pos = {s: i for i, s in enumerate(ids)}
    for f in sorted((out / 'st').glob('*.json')):
        d = json.load(open(f)); fw = d['windows']; W = meta['windows']
        wi = [W.index(w) for w in fw]
        scale_cell = np.repeat(np.array(d['scale'], float), len(fw) * len(d['leads']))
        for sid in d['s']:
            k = pos.get(sid)
            if k is None: continue
            for r, name in enumerate(REFS):
                arr = vals[k, r][:, wi, :].reshape(-1).astype(np.float64)
                if np.isfinite(arr).any(): d['s'][sid][name] = encode(arr, scale_cell)
        write_json(f, d)


# ---------------------------------------------------------------- case studies
def build_case(case_id: str, out: Path):
    import case_study
    case_study.build(case_id, out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('step', choices=['all', 'scores', 'obs', 'baselines', 'case'])
    ap.add_argument('case_id', nargs='?')
    ap.add_argument('--out', type=Path, default=Path('dist/data'))
    ap.add_argument('--cache', type=Path, default=Path('.cache'))
    ap.add_argument('--refresh-years', type=int, nargs='*')
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True); a.cache.mkdir(parents=True, exist_ok=True)
    if a.step in ('all', 'scores'): build_scores(a.out, a.cache)
    if a.step in ('all', 'obs'): update_obs(a.out, a.cache, a.refresh_years)
    if a.step in ('all', 'baselines'): build_baselines(a.out, a.cache)
    if a.step == 'case': build_case(a.case_id, a.out)


if __name__ == '__main__':
    sys.path.insert(0, str(Path(__file__).parent))
    main()
