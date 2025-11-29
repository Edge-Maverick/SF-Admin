import { loadScript } from 'lightning/platformResourceLoader';
import ObservablePlotJS from '@salesforce/resourceUrl/ObservablePlotD3';
// https://observablehq.com/@observablehq/plot-gallery

let _plotLibraryLoaded = false;
let _plotLoadPromise;

/**
 * Loads D3 and Observable Plot from a static resource once.
 * Must be called with an LWC component context.
 * Usage: await getObservablePlotJS(this);
 * Returns: Promise<boolean>
 */
const getObservablePlotJS = (cmp) => {
    if (_plotLibraryLoaded) {
        return Promise.resolve(true);
    }
    if (_plotLoadPromise) {
        return _plotLoadPromise;
    }
    if (!cmp) {
        // Defensive: ensure a component context is provided for loadScript
        return Promise.reject(new Error('getObservablePlotJS requires a component context (this)'));
    }

    _plotLoadPromise = loadScript(cmp, `${ObservablePlotJS}/d3.js`)
        .then(() => loadScript(cmp, `${ObservablePlotJS}/plot.js`))
        .then(() => {
            _plotLibraryLoaded = true;
            // Expose to window safely for child components that might rely on globals
            try {
                // Locker-safe access (will be scoped), but children in same component tree can reuse
                if (!window.d3 || !window.Plot) {
                    // eslint-disable-next-line no-undef
                    window.d3 = window.d3 || d3;
                    // eslint-disable-next-line no-undef
                    window.Plot = window.Plot || Plot;
                }
            } catch (e) {
                // Ignore if Locker disallows; components should import via globals if available
            }
            // eslint-disable-next-line no-console
            console.log('lPlotUtils/getObservablePlotJS loaded');
            return true;
        })
        .catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Error loading Observable Plot/D3', JSON.stringify(error));
            _plotLibraryLoaded = false;
            _plotLoadPromise = undefined;
            throw error;
        });

    return _plotLoadPromise;
};

/**
 * Generic number formatter helpers for charts
 */
const formatNumber = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '';
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return `${val}`;
};

const formatDate = (date) => {
    try {
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleString();
    } catch (e) {
        return `${date}`;
    }
};

/**
 * Data shaping utilities for Plot.js-based charts
 * These helpers expect an array of row objects and return datasets
 * usable by bar/line/area/heatmap components.
 */
const groupByAggregate = (rows, { groupKey, metricKey, topN, stackKey } = {}) => {
    if (!Array.isArray(rows)) return [];
    const map = new Map();
    rows.forEach((r) => {
        const g = r[groupKey];
        const s = stackKey ? r[stackKey] : '_';
        const key = `${g}||${s}`;
        const cur = map.get(key) || { group: g, stack: s, value: 0 };
        const add = Number(r[metricKey]) || 0;
        cur.value += add;
        map.set(key, cur);
    });
    let arr = Array.from(map.values());
    // reduce to topN by value when provided (across all stacks)
    if (topN && topN > 0) {
        const totals = {};
        arr.forEach((r) => {
            totals[r.group] = (totals[r.group] || 0) + r.value;
        });
        const topGroups = Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([g]) => g);
        arr = arr.filter((r) => topGroups.includes(r.group));
    }
    return arr;
};

const toTimeseries = (rows, { timeKey, seriesKey, metricKey } = {}) => {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
        t: r[timeKey] instanceof Date ? r[timeKey] : new Date(r[timeKey]),
        s: seriesKey ? r[seriesKey] : 'series',
        v: Number(r[metricKey]) || 0
    }));
};

const toHeatmapMatrix = (rows, { xKey, yKey, metricKey } = {}) => {
    if (!Array.isArray(rows)) return { x: [], y: [], z: [] };
    const xVals = Array.from(new Set(rows.map((r) => r[xKey]))).sort();
    const yVals = Array.from(new Set(rows.map((r) => r[yKey]))).sort();
    const z = yVals.map(() => xVals.map(() => 0));
    const xIdx = new Map(xVals.map((v, i) => [v, i]));
    const yIdx = new Map(yVals.map((v, i) => [v, i]));
    rows.forEach((r) => {
        const xi = xIdx.get(r[xKey]);
        const yi = yIdx.get(r[yKey]);
        const add = Number(r[metricKey]) || 0;
        if (xi !== undefined && yi !== undefined) {
            z[yi][xi] += add;
        }
    });
    return { x: xVals, y: yVals, z };
};

/**
 * Generic pivot supporting multiple index keys and optional aggregation.
 *
 * @param {Array<Object>} data - array of row objects
 * @param {string|string[]} index - index column name or array of column names
 * @param {string} columns - column name to pivot into new columns
 * @param {string} values - column name that contains cell values
 * @param {Object} options - optional settings:
 *    {Function} agg - aggregator function to combine multiple values (receives array)
 *    {any} fillValue - value to use for missing cells (default: null)
 * @returns {Array<Object>} pivoted (wide) array
 *
 * Example: pivot(data, ['time','region'], 'type', 'value', { agg: arr => arr.reduce((a,b)=>a+b,0), fillValue: 0 })
 */
const pivotData = (data, index, columns, values, options = {}) => {
  const { agg = null, fillValue = null } = options;

  // Normalize index to array of keys
  const indexKeys = Array.isArray(index) ? index : [index];

  // Map to store rows keyed by composite index
  const map = new Map();
  // Keep set of discovered pivot column names
  const pivotCols = new Set();

  // Helper to make a stable composite key
  const makeKey = idxValues => idxValues.map(v => String(v)).join('\x1F'); // unit-sep unlikely to appear in normal data

  for (const row of data) {
    const idxVals = indexKeys.map(k => row[k]);
    const key = makeKey(idxVals);
    const colName = row[columns];
    const val = row[values];

    pivotCols.add(colName);

    if (!map.has(key)) {
      // initialize storage object
      // If aggregator provided, store arrays; else store single values
      const obj = { __idxVals: idxVals, __cells: new Map() };
      map.set(key, obj);
    }

    const entry = map.get(key);

    if (agg) {
      // push into array for this cell
      if (!entry.__cells.has(colName)) entry.__cells.set(colName, []);
      entry.__cells.get(colName).push(val);
    } else {
      // no aggregator: error on duplicate
      if (entry.__cells.has(colName)) {
        throw new Error(`Duplicate entry for index (${indexKeys.join(',')}) = (${idxVals.join(',')}) and column "${colName}". Provide an agg function to aggregate duplicates.`);
      }
      entry.__cells.set(colName, val);
    }
  }

  // Build final objects
  const result = [];
  for (const [key, entry] of map) {
    const obj = {};

    // set index fields back to values
    indexKeys.forEach((k, i) => {
      obj[k] = entry.__idxVals[i];
    });

    // fill each pivot column
    for (const col of pivotCols) {
      if (entry.__cells.has(col)) {
        if (agg) {
          const arr = entry.__cells.get(col);
          obj[col] = agg(arr);
        } else {
          obj[col] = entry.__cells.get(col);
        }
      } else {
        obj[col] = fillValue;
      }
    }

    result.push(obj);
  }

  return result;
}



export {
    getObservablePlotJS,
    formatNumber,
    formatDate,
    groupByAggregate,
    toTimeseries,
    toHeatmapMatrix,
    pivotData
};