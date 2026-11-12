import type { LatLng, RouteData, Waypoint } from '../types/route';
import { locateOnRoute } from './geoMath.ts';

export const REPLAN_START_ID = 'replan-start';

/** So lange abseits der Strecke, bis automatisch neu geplant wird */
export const REPLAN_AFTER_MS = 20_000;
/** Nur mit brauchbarem GPS neu planen, sonst springt die Strecke umher */
export const REPLAN_MAX_ACCURACY_M = 30;

/**
 * Punkte, die noch vor einem liegen: alle Zwischenpunkte hinter `passedMeters` und immer das Ziel.
 * Die Punkte werden der Reihe nach auf der Strecke gesucht, damit Rundkurse (Start = Ziel) und
 * Hin-und-zurück-Strecken richtig zugeordnet werden.
 */
export function remainingWaypoints(route: RouteData, waypoints: Waypoint[], passedMeters: number): Waypoint[] {
  if (waypoints.length < 2) return waypoints.slice(-1);
  const rest: Waypoint[] = [];
  let hint = 0;
  waypoints.forEach((w, i) => {
    if (i === 0) return;
    const along = locateOnRoute(route.coordinates, route.cumulative, w, hint).alongMeters;
    hint = along;
    if (i === waypoints.length - 1 || along > passedMeters + 15) rest.push(w);
  });
  return rest;
}

/** Neue Punkte ab der eigenen Position */
export function replanWaypoints(route: RouteData, waypoints: Waypoint[], passedMeters: number, here: LatLng): Waypoint[] {
  return [
    { id: REPLAN_START_ID, name: 'Neu ab hier', lat: here.lat, lng: here.lng },
    ...remainingWaypoints(route, waypoints, passedMeters),
  ];
}
