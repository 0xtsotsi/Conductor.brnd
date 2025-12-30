import type { ServerRoute } from '.';
import {
  LIST_APPROVALS_ROUTE,
  APPROVE_RUN_ROUTE,
  DECLINE_RUN_ROUTE,
  GET_APPROVAL_DETAILS_ROUTE,
} from '../../handlers/approvals';

/**
 * Approval queue routes
 * These endpoints provide the Mission Command Centre with access to
 * workflow runs that are suspended and awaiting human approval
 */
export const APPROVALS_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_APPROVALS_ROUTE,
  APPROVE_RUN_ROUTE,
  DECLINE_RUN_ROUTE,
  GET_APPROVAL_DETAILS_ROUTE,
];
