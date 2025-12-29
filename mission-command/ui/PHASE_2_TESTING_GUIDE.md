# Phase 2 Testing Guide

## Quick Start

### 1. Install Dependencies
```bash
cd /var/tmp/vibe-kanban/worktrees/30de-phase-2-ui-integ/Conductor-brnd
pnpm install
```

### 2. Build Core Packages
```bash
pnpm build:core
pnpm build:packages
```

### 3. Start UI Dev Server
```bash
cd mission-command/ui
pnpm dev
```

The UI will be available at `http://localhost:3000`

## Test Scenarios

### Scenario 1: Login Flow
1. Visit `http://localhost:3000`
2. **Expected**: Redirected to `/login` page
3. Click "admin" button (quick login)
4. **Expected**: Redirected to home page (`/`)
5. **Verify**:
   - Role badge shows "admin"
   - Email displayed in header
   - Logout button visible

### Scenario 2: Role-Based Access Control

#### Admin Role
1. Login as "admin"
2. **Expected Access**:
   - ✅ Catalog (`/`)
   - ✅ Mission Runs (`/runs`)
   - ✅ Approvals (`/approvals`)
   - ✅ Create Workflow (`/workflow/new`)

#### Operator Role
1. Logout
2. Login as "operator"
3. **Expected Access**:
   - ✅ Catalog (`/`)
   - ✅ Mission Runs (`/runs`)
   - ✅ Approvals (`/approvals`)
   - ✅ Create Workflow (`/workflow/new`)

#### Viewer Role
1. Logout
2. Login as "viewer"
3. **Expected Access**:
   - ✅ Catalog (`/`)
   - ✅ Mission Runs (`/runs`)
   - ❌ Approvals - shows "Insufficient Permissions" page
   - ❌ Create Workflow - shows "Insufficient Permissions" page

### Scenario 3: Protected Routes
1. Logout
2. Try to access `http://localhost:3000/approvals` directly
3. **Expected**: Redirected to `/login` with redirect state
4. Login as "viewer"
5. **Expected**: Shows "Insufficient Permissions" page
6. Click back button or login as "operator"
7. **Expected**: Approvals page loads successfully

### Scenario 4: Navigation Filtering
1. Login as "viewer"
2. **Expected**: Navigation shows only "Catalog" and "Mission Runs"
3. Logout
4. Login as "operator"
5. **Expected**: Navigation shows "Catalog", "Mission Runs", and "Approvals"

### Scenario 5: Logout
1. Login as any role
2. Click "Logout" button
3. **Expected**: Returns to login page
4. Token cleared from localStorage
5. Try to access protected route
6. **Expected**: Redirected to login again

## Manual JWT Testing

If you want to test with a custom JWT:

1. Generate a JWT at https://jwt.io/
2. Payload should include:
   ```json
   {
     "sub": "user-123",
     "email": "test@example.com",
     "name": "Test User",
     "role": "admin",
     "exp": 1234567890
   }
   ```
3. Open browser console
4. Run:
   ```javascript
   localStorage.setItem('mastra_auth_token', 'your.jwt.token');
   location.reload();
   ```
5. **Expected**: User logged in with provided role

## Troubleshooting

### Issue: "useAuth must be used within an AuthProvider"
**Cause**: Component using `useAuth()` outside of `AuthProvider`
**Fix**: Ensure `AuthProvider` wraps all routes using `useAuth()`

### Issue: Routes not redirecting to login
**Cause**: Missing `ProtectedRoute` wrapper
**Fix**: Wrap protected routes with `<ProtectedRoute>` component

### Issue: Role badge not showing
**Cause**: JWT missing `role` claim or token expired
**Fix**: Check JWT payload includes `role` field and `exp` is in the future

### Issue: Navigation items not filtering
**Cause**: `Navigation` component not using auth context
**Fix**: Ensure `Navigation` is inside `AuthProvider` and calls `useAuth()`

### Issue: CORS errors when calling API
**Cause**: Mastra Server not running or wrong CORS config
**Fix**:
1. Ensure Mastra Server is running on port 4111
2. Check server CORS settings allow localhost:3000

## Debugging

### Enable React DevTools
```bash
# Install React DevTools browser extension
# Check component state in DevTools
```

### Check Auth State
Open browser console:
```javascript
// Check if token exists
localStorage.getItem('mastra_auth_token');

// Check token contents
const token = localStorage.getItem('mastra_auth_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);

// Check cookies
document.cookie;
```

### Monitor Network Requests
Open DevTools Network tab:
1. Filter by "XHR" and "Fetch"
2. Check API calls to Mastra Server
3. Verify headers include auth token

## Next Steps

Once all tests pass:
1. ✅ Phase 2 complete - proceed to Phase 3
2. Implement OAuth callback endpoints
3. Add missing API endpoints
4. Write integration tests
5. Deploy to staging environment

## Success Criteria

Phase 2 is complete when:
- [x] All test scenarios pass
- [x] No console errors
- [x] TypeScript compilation succeeds
- [x] All roles can login/logout
- [x] RBAC correctly restricts access
- [x] Navigation filters based on role
