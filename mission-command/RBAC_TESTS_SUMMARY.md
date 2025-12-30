# RBAC E2E Tests - Implementation Summary

## Overview

Comprehensive Role-Based Access Control (RBAC) End-to-End tests have been implemented for the Mission Command Centre. The test suite covers all aspects of permission verification across UI routes, API endpoints, and user actions.

**Test File:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/e2e/tests/rbac.spec.ts`

## Test Statistics

- **Total Test Suites:** 10
- **Estimated Test Count:** 50-60 tests
- **Test Categories:** 10 major categories

## Role Hierarchy

```
admin > operator > viewer
```

### Role Definitions

- **Viewer**: Read-only access to workflows, missions, and runs
- **Operator**: All viewer permissions + ability to approve/decline workflows
- **Admin**: All operator permissions + user management, audit logs, and workflow creation

## Test Categories

### 1. Role-Based Route Access (8 tests)

Tests verify that each role can only access permitted UI routes:

**Viewer Routes:**
- ✅ `/` - Catalog
- ✅ `/workflow/:id` - Workflow detail
- ✅ `/runs` - Mission runs
- ✅ `/profile` - User profile
- ❌ `/workflow/new` - Create workflow (admin only)
- ❌ `/approvals` - Approval queue (operator+)
- ❌ `/audit` - Audit logs (admin only)
- ❌ `/admin/users` - User management (admin only)

**Operator Routes:**
- ✅ All viewer routes
- ✅ `/approvals` - Approval queue
- ❌ Admin-only routes

**Admin Routes:**
- ✅ All routes

**Unauthenticated:**
- Redirected to `/auth/login` for all protected routes

### 2. API Endpoint Permissions (14 tests)

Tests verify API access controls:

**User Management:**
- `GET /api/users` - Admin only (403 for operator/viewer)
- `GET /api/users/:id` - Admin or self
- `PUT /api/users/:id` - Admin or self (limited fields for self)
- `DELETE /api/users/:id` - Admin only

**Approval Endpoints:**
- `GET /api/approvals` - Viewer+ (read-only for viewer)
- `POST /api/approvals/:runId/approve` - Operator+ only
- `POST /api/approvals/:runId/decline` - Operator+ only

**Mission Endpoints:**
- `GET /api/missions/active` - Viewer+ only
- `GET /api/missions/recent` - Viewer+ only

**Audit Logs:**
- `GET /api/audit/logs` - Admin only (403 for operator/viewer)

### 3. UI Element Visibility (5 tests)

Tests verify that UI elements are shown/hidden based on role:

**Navigation Items:**
- Viewer: Catalog, Workflows, Runs, Profile
- Operator: + Approvals
- Admin: + Create Workflow, Audit Logs, User Management

**Action Buttons:**
- "Create Workflow" button - Admin only
- "Approve"/"Reject" buttons - Operator+ only
- Disabled elements are non-functional

### 4. Action Permissions (8 tests)

Tests verify actual actions can/cannot be performed:

**Viewer Cannot:**
- Approve workflows (403)
- Reject workflows (403)
- Create workflows (403)

**Operator Can:**
- Approve workflows (200/202)
- Reject workflows (200/202)

**Operator Cannot:**
- Create workflows (403)
- Manage users (403)

**Admin Can:**
- Everything

### 5. Role Escalation Prevention (4 tests)

Tests prevent privilege escalation:

- ❌ Operator cannot promote themselves to admin
- ❌ Viewer cannot promote themselves to operator
- ✅ Role changes require admin privilege
- ✅ Role changes are logged in audit log

### 6. Cross-Role Data Access (5 tests)

Tests prevent unauthorized data access:

- ❌ Viewer cannot see audit logs (403)
- ❌ Viewer cannot see other users' data (403)
- ❌ Operator cannot see audit logs (403)
- ❌ Operator cannot manage users (403)
- ✅ Admin can see all data

### 7. Session Role Persistence (4 tests)

Tests verify role consistency:

- ✅ User role persists across sessions
- ✅ Role is correctly loaded from JWT on refresh
- ✅ Role change requires re-login to take effect
- ✅ Multiple sessions with same user have same role

### 8. Permission Inheritance (3 tests)

Tests verify role hierarchy:

- ✅ Admin has all operator and viewer permissions
- ✅ Operator has all viewer permissions
- ✅ Viewer has minimum permissions only

### 9. JWT Token Verification (5 tests)

Tests verify JWT security:

- ✅ JWT contains correct role claim
- ✅ JWT role is verified on each API request
- ✅ Expired JWT with valid role is rejected (401)
- ✅ Invalid JWT signature is rejected (401/403)
- ✅ Tampered JWT role is rejected (401/403)

### 10. Edge Cases (5 tests)

Tests handle boundary conditions:

- Invalid role in JWT
- Missing role in JWT
- Role change while logged in
- Concurrent requests with different roles
- User with multiple roles (highest privilege)

## Test Utilities Used

The tests leverage existing E2E test utilities:

- **`createTestClient(role)`** - Create authenticated API client
- **`createMultipleTestClients(roles)`** - Create multiple clients
- **`assertUserHasRole(page, role)`** - Verify user role
- **`assertPageAccessible(page, path, role)`** - Verify page access
- **`assertPageForbidden(page, path, role)`** - Verify page forbidden
- **`assertNavigationItems(page, role, expected, forbidden)`** - Verify navigation
- **`dbHelper.assertAuditLogExists()`** - Verify audit logs

## Running the Tests

```bash
# Run all RBAC tests
cd mission-command
pnpm test rbac.spec.ts

# Run with UI mode for debugging
pnpm test:ui rbac.spec.ts

# Run specific test suite
pnpm test rbac.spec.ts --grep "Role-Based Route Access"

# Run with verbose output
pnpm test rbac.spec.ts --reporter=verbose
```

## Test Data

Tests use mock users defined in `/mission-command/e2e/utils/oauth-mocks.ts`:

```typescript
{
  admin: {
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'admin'
  },
  operator: {
    email: 'operator@test.com',
    name: 'Operator User',
    role: 'operator'
  },
  viewer: {
    email: 'viewer@test.com',
    name: 'Viewer User',
    role: 'viewer'
  }
}
```

## Key Assertions

### Status Code Assertions
- **2xx (200, 201, 202, 204)** - Success
- **400** - Bad Request
- **401** - Unauthorized (auth required, expired token)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found (resource doesn't exist)

### UI Assertions
- **Navigation visibility** - Elements present/absent based on role
- **Button visibility** - Action buttons shown/hidden appropriately
- **Redirects** - Unauthenticated users redirected to login
- **Disabled elements** - Non-functional when disabled

### Security Assertions
- **No privilege escalation** - Users cannot promote themselves
- **Audit logging** - Admin actions are logged
- **JWT validation** - Tokens verified on every request
- **Role persistence** - Roles consistent across sessions

## Coverage Matrix

| Feature | Viewer | Operator | Admin |
|---------|--------|----------|-------|
| View Catalog | ✅ | ✅ | ✅ |
| View Workflow Details | ✅ | ✅ | ✅ |
| View Runs | ✅ | ✅ | ✅ |
| View Profile | ✅ | ✅ | ✅ |
| View Approvals | ✅ | ✅ | ✅ |
| Approve Workflows | ❌ | ✅ | ✅ |
| Reject Workflows | ❌ | ✅ | ✅ |
| Create Workflows | ❌ | ❌ | ✅ |
| View Audit Logs | ❌ | ❌ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |

## Integration with Auth System

Tests integrate with the existing authentication system defined in:
- `/packages/server/src/server/auth/defaults.ts` - Auth rules
- `/packages/server/src/server/handlers/approvals.ts` - Approval endpoints
- `/packages/server/src/server/handlers/missions.ts` - Mission endpoints

## Notes

1. **Test Isolation**: Each test is independent and can run in any order
2. **Mock Data**: Uses mock OAuth and JWT for testing
3. **Database Tests**: Some tests use test database for audit log verification
4. **Parallel Execution**: Tests support parallel execution where safe
5. **CI/CD Ready**: Tests can run in CI/CD pipelines

## Future Enhancements

Potential additions:
- Performance tests for permission checks
- Tests for custom roles (if implemented)
- Tests for permission-based feature flags
- Tests for IP-based access control
- Tests for time-based access control
- Tests for rate limiting by role

## Maintenance

To keep tests updated:
1. Add new routes to `protectedRoutes` object
2. Update role permissions when auth rules change
3. Add new API endpoints to test suites
4. Update UI element selectors when UI changes
5. Refresh test data when user model changes

---

**Test Count:** 50-60 tests
**Execution Time:** ~5-10 minutes (estimated)
**Coverage:** Comprehensive RBAC verification
