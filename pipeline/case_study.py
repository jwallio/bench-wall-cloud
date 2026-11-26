"""Storm case studies: gridded MRMS vs model precipitation totals, from dynamical.org Zarr stores.

Events are listed in pipeline/cases.json. For each: MRMS hourly analysis summed over the window (up to 3
missing hours allowed), each model's run issued before the window summed over the lead steps that fall
inside it (rates are averages since the previous step, kg m-2 s-1 = mm/s), ensembles as member means plus
the chance of at least 1 inch. MRMS is shown at 0.05 deg and averaged to the models' 0.25 deg grid for scoring.
A gauge check compares MRMS with the hourly ASOS precipitation in the observation cache.
Writes <out>/case/<id>.json and updates <out>/case/index.json.
"""
from __future__ import annotations
import datetime as dt, json, sys, time
from pathlib import Path
import numpy as np
import zarr

BASE = 'https://data.source.coop/dynamical'
MRMS = 'noaa-mrms-conus-analysis-hourly/v0.3.0.zarr'


def _ts(s): return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))


def _open(store): return zarr.open_group(f'{BASE}/{store}', mode='r')


def _sel(arr, ranges):
    dims = list(arr.metadata.dimension_names)
    sl = tuple(slice(*ranges[d]) if d in ranges else slice(None) for d in dims)
    return arr[sl], dims


def mrms_total(w0, w1, bb):
    g = _open(MRMS); t = g['time'][:]
    k0 = int(np.flatnonzero(t == int((w0 + dt.timedelta(hours=1)).timestamp()))[0]); k1 = int(np.flatnonzero(t == int(w1.timestamp()))[0]) + 1
    lat = g['latitude'][:]; lon = g['longitude'][:]
    i = np.flatnonzero((lat <= bb['north'] + 0.125) & (lat >= bb['south'] - 0.125)); j = np.flatnonzero((lon >= bb['west'] - 0.125) & (lon <= bb['east'] + 0.125))
    r, dims = _sel(g['precipitation_surface'], {'time': (k0, k1), 'latitude': (i[0], i[-1] + 1), 'longitude': (j[0], j[-1] + 1)})
    r = np.transpose(r, [dims.index(d) for d in ('time', 'latitude', 'longitude')])
    miss = np.isnan(r).sum(0); tot = np.nansum(r, axis=0) * 3600.0; tot[miss > 3] = np.nan
    return tot, lat[i[0]:i[-1] + 1], lon[j[0]:j[-1] + 1], k1 - k0


def model_total(m, w0, w1, bb):
    g = _open(m['store']); init = _ts(m['init'])
    it = g['init_time'][:]; lt = g['lead_time'][:].astype(np.int64)
    if lt.max() > 10**12: lt = lt // 10**9  # timedelta in ns -> s
    ii = int(np.flatnonzero(it == int(init.timestamp()))[0])
    steps = [(k, float(lt[k] - lt[k - 1])) for k in range(1, len(lt))
             if init + dt.timedelta(seconds=int(lt[k - 1])) >= w0 and init + dt.timedelta(seconds=int(lt[k])) <= w1]
    lat = g['latitude'][:]; lon = g['longitude'][:]
    lonw = lon if lon.min() < 0 else np.where(lon > 180, lon - 360, lon)
    i = np.flatnonzero((lat <= bb['north'] + 1e-6) & (lat >= bb['south'] - 1e-6)); j = np.flatnonzero((lonw >= bb['west'] - 1e-6) & (lonw <= bb['east'] + 1e-6))
    r, dims = _sel(g['precipitation_surface'], {'init_time': (ii, ii + 1), 'lead_time': (steps[0][0], steps[-1][0] + 1),
                                                'latitude': (i[0], i[-1] + 1), 'longitude': (j[0], j[-1] + 1)})
    order = ['init_time', 'lead_time'] + (['ensemble_member'] if m.get('ensemble') else []) + ['latitude', 'longitude']
    r = np.transpose(r, [dims.index(d) for d in order])[0]
    tot = np.tensordot(np.array([d for _, d in steps]), r, axes=([0], [0]))
    hours = sum(d for _, d in steps) / 3600
    if m.get('ensemble'):
        return np.nanmean(tot, 0), np.nanmean(tot >= 25.4, 0) * 100, hours, tot.shape[0], float(lat[i[0]]), float(lonw[j[0]])
    return tot, None, hours, 1, float(lat[i[0]]), float(lonw[j[0]])


def block(tot, lat, lon, d, lat_n, lon_w, nlat, nlon):
    gi = np.round((lat_n - lat) / d).astype(int); gj = np.round((lon - lon_w) / d).astype(int)
    GI, GJ = np.meshgrid(gi, gj, indexing='ij'); ok = (GI >= 0) & (GI < nlat) & (GJ >= 0) & (GJ < nlon) & np.isfinite(tot)
    key = GI[ok] * nlon + GJ[ok]
    s = np.bincount(key, tot[ok], nlat * nlon); c = np.bincount(key, minlength=nlat * nlon)
    with np.errstate(invalid='ignore'): out = s / c
    out[c < 0.5 * (d / 0.01) ** 2] = np.nan
    return out.reshape(nlat, nlon)


def pack(a, lat_n, lon_w, d):
    v = np.where(np.isfinite(a), np.round(a * 10), -1).astype(int)
    return {'lat_n': round(lat_n, 4), 'lon_w': round(lon_w, 4), 'd': d, 'nlat': a.shape[0], 'nlon': a.shape[1], 'v': ','.join(map(str, v.ravel().tolist()))}


def gauge_check(case, fine, out: Path, cache: Path):
    meta = json.load(open(out / 'meta.json'))
    w0, w1 = _ts(case['window_utc'][0]), _ts(case['window_utc'][1])
    f = cache / 'obs' / f'{w0.year}.npz'
    if not f.exists(): return None, []
    z = np.load(f); h0 = int(z['h0']); pos = {s: i for i, s in enumerate(z['ids'])}
    a0 = int(w0.timestamp() // 3600) + 1 - h0; a1 = int(w1.timestamp() // 3600) + 1 - h0
    v = fine['a']; g = []
    for s in meta['stations']:
        if s['state'] != case['state'] or s['id'] not in pos: continue
        p = z['p'][pos[s['id']], a0:a1]; ok = p != -32768
        if ok.sum() < 50: continue
        i = int(round((fine['lat_n'] - s['lat']) / fine['d'])); j = int(round((s['lon'] - fine['lon_w']) / fine['d']))
        if 0 <= i < fine['nlat'] and 0 <= j < fine['nlon'] and np.isfinite(v[i, j]):
            g.append([s['id'], round(float(p[ok].sum()) / 10, 1), round(float(v[i, j]), 1)])
    if len(g) < 5: return None, g
    arr = np.array([[x[1], x[2]] for x in g])
    return {'n': len(g), 'r': round(float(np.corrcoef(arr[:, 0], arr[:, 1])[0, 1]), 2),
            'mean_gauge': round(float(arr[:, 0].mean()), 1), 'mean_mrms': round(float(arr[:, 1].mean()), 1)}, g


def build(case_id: str, out: Path, cache: Path = Path('.cache')):
    cases = {c['id']: c for c in json.load(open(Path(__file__).parent / 'cases.json'))}
    c = cases[case_id]; bb = c['bbox']; w0, w1 = _ts(c['window_utc'][0]), _ts(c['window_utc'][1])
    t0 = time.time()
    mt, mlat, mlon, nh = mrms_total(w0, w1, bb)
    I0 = int(round((90 - bb['north']) / 0.25)); I1 = int(round((90 - bb['south']) / 0.25)) + 1
    J0 = int(round((bb['west'] + 180) / 0.25)); J1 = int(round((bb['east'] + 180) / 0.25)) + 1
    lat_n, lon_w, nlat, nlon = 90 - 0.25 * I0, -180 + 0.25 * J0, I1 - I0, J1 - J0
    m025 = block(mt, mlat, mlon, 0.25, lat_n, lon_w, nlat, nlon)
    fd = 0.05; nfl = int(round((bb['north'] - bb['south']) / fd)) + 1; nfo = int(round((bb['east'] - bb['west']) / fd)) + 1
    m005 = block(mt, mlat, mlon, fd, bb['north'], bb['west'], nfl, nfo)
    res = {k: c[k] for k in ('id', 'name', 'state', 'window_utc', 'window_local')}
    res['fields'] = [{'id': 'MRMS', 'label': 'Observed · NOAA MRMS', 'kind': 'obs', 'hours': nh,
                      'fine': pack(m005, bb['north'], bb['west'], fd), 'grid': pack(m025, lat_n, lon_w, 0.25)}]
    print(f'MRMS {nh} h, max {np.nanmax(mt):.0f} mm', flush=True)
    for m in c['models']:
        tot, p1, hrs, nm, la0, lo0 = model_total(m, w0, w1, bb)
        assert abs(la0 - lat_n) < 1e-6 and abs(lo0 - lon_w) < 1e-6, (m['id'], la0, lo0, lat_n, lon_w)
        f = {'id': m['id'], 'label': m['label'], 'kind': 'model', 'init': _ts(m['init']).strftime('%HZ %b %-d'), 'hours': hrs, 'members': nm,
             'grid': pack(tot, lat_n, lon_w, 0.25)}
        if p1 is not None: f['p1in'] = pack(p1, lat_n, lon_w, 0.25)
        res['fields'].append(f)
        print(f"{m['id']}: {hrs:.0f} h, {nm} member(s), max {np.nanmax(tot):.0f} mm", flush=True)
    res['gauge_check'], res['gauges'] = gauge_check(c, {'a': m005, 'lat_n': bb['north'], 'lon_w': bb['west'], 'd': fd, 'nlat': nfl, 'nlon': nfo}, out, cache)
    (out / 'case').mkdir(parents=True, exist_ok=True)
    (out / 'case' / f'{case_id}.json').write_text(json.dumps(res, separators=(',', ':')))
    idx_path = out / 'case' / 'index.json'
    idx = json.loads(idx_path.read_text()) if idx_path.exists() else []
    idx = [e for e in idx if e['id'] != case_id] + [{k: c[k] for k in ('id', 'name', 'state', 'window_local')}]
    idx_path.write_text(json.dumps(sorted(idx, key=lambda e: e['id']), separators=(',', ':')))
    print(f'case {case_id} written in {time.time() - t0:.0f}s; gauge check {res["gauge_check"]}', flush=True)


if __name__ == '__main__':
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('dist/data')
    cache = Path(sys.argv[3]) if len(sys.argv) > 3 else Path('.cache')
    build(sys.argv[1], out, cache)
