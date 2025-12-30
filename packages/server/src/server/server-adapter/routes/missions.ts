import type { ServerRoute } from '.';
import {
  LIST_ACTIVE_MISSIONS_ROUTE,
  LIST_RECENT_MISSIONS_ROUTE,
  GET_MISSION_TIMELINE_ROUTE,
} from '../../handlers/missions';

/**
 * Mission monitoring routes
 * These endpoints provide the Mission Command Centre with visibility
 * into active and recent workflow runs (missions)
 */
export const MISSIONS_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_ACTIVE_MISSIONS_ROUTE,
  LIST_RECENT_MISSIONS_ROUTE,
  GET_MISSION_TIMELINE_ROUTE,
];
