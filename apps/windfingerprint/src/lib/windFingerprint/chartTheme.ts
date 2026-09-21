import type { Config } from 'vega-lite';

/** Shared look for both polar charts -- station-log palette, no default Vega color schemes. */
export const CHART_CONFIG: Config = {
  background: 'transparent',
  font: 'IBM Plex Sans',
  legend: {
    titleFont: 'IBM Plex Sans',
    titleFontSize: 11,
    titleColor: '#55636e',
    labelFont: 'IBM Plex Mono',
    labelFontSize: 10,
    labelColor: '#17212b',
    symbolType: 'square',
    gradientLength: 100,
  },
  view: { stroke: null },
};

export const CHART_SIZE = 380;
