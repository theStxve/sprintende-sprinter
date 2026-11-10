import type { RouteData } from '../types/route';

/** Hinweis zur Herkunft einer Strecke, null wenn alles normal ist */
export function routeNotice(route: RouteData | null): { tone: 'neutral' | 'warn'; text: string } | null {
  if (!route) return null;
  if (route.fallback) return { tone: 'warn', text: 'Wegführung gerade nicht erreichbar. Die Strecke wird vorläufig als Luftlinie berechnet.' };
  if (route.source === 'blocks-ignored')
    return { tone: 'warn', text: 'Sperr-Dienst gerade nicht erreichbar. Die Strecke kann durch gesperrte Straßen führen.' };
  if (route.source === 'avoided') return { tone: 'neutral', text: 'Sperr-Dienst offline. Es wird eine Ausweichroute genutzt, die deine Sperren meidet.' };
  if (route.source === 'cache') return { tone: 'neutral', text: 'Wegführung offline. Es wird die zuletzt berechnete Strecke genutzt.' };
  return null;
}
