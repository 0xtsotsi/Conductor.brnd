import type { ServerRoute } from './index';
import {
  LIST_ACTIVE_MISSIONS_ROUTE,
  LIST_RECENT_MISSIONS_ROUTE,
  GET_MISSION_TIMELINE_ROUTE,
} from '../../handlers/missions';

export const MISSIONS_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_ACTIVE_MISSIONS_ROUTE,
  LIST_RECENT_MISSIONS_ROUTE,
  GET_MISSION_TIMELINE_ROUTE,
];
