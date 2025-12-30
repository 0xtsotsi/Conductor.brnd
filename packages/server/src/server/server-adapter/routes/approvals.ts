import type { ServerRoute } from './index';
import {
  LIST_APPROVALS_ROUTE,
  APPROVE_RUN_ROUTE,
  DECLINE_RUN_ROUTE,
  GET_APPROVAL_ROUTE,
} from '../../handlers/approvals';

export const APPROVALS_ROUTES: ServerRoute[] = [
  LIST_APPROVALS_ROUTE,
  APPROVE_RUN_ROUTE,
  DECLINE_RUN_ROUTE,
  GET_APPROVAL_ROUTE,
];
