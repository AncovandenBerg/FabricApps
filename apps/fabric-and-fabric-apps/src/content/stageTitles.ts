import type { Stage } from '../../rayfin/data/Session';

// Human-readable, numbered labels for the same stages presenters pick from
// in /control and attendees see mirrored on /join while waiting.
export const STAGE_TITLES: Record<Stage, string> = {
  lobby: '1 · Lobby',
  fabric_overview: '2 · Fabric overview',
  workload_zoom: '3 · Workload zoom',
  fabric_apps_intro: '4 · Fabric Apps',
  fabric_apps_background: '5 · Why now',
  fabric_apps_value: '6 · What you stop doing',
  fabric_apps_benefits_tech: '7 · Why developers care',
  fabric_apps_data_app: '8 · Data Apps',
  fabric_apps_preview_status: '9 · Preview means preview',
  reveal: '10 · Reveal',
  wrapup: '11 · Wrap-up',
};
