#!/bin/bash

echo "========================================"
echo "Missions API Implementation Verification"
echo "========================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if handler file exists
if [ -f "src/server/handlers/missions.ts" ]; then
    echo -e "${GREEN}✓${NC} Handler file exists: src/server/handlers/missions.ts"
else
    echo -e "${RED}✗${NC} Handler file missing: src/server/handlers/missions.ts"
    exit 1
fi

# Check if exports are in index.ts
if grep -q "createMissionsAPI" src/server/index.ts; then
    echo -e "${GREEN}✓${NC} Export added to index.ts: createMissionsAPI"
else
    echo -e "${RED}✗${NC} Export missing in index.ts: createMissionsAPI"
fi

if grep -q "MissionRun" src/server/index.ts; then
    echo -e "${GREEN}✓${NC} Type export added: MissionRun"
else
    echo -e "${RED}✗${NC} Type export missing: MissionRun"
fi

if grep -q "TimelineStep" src/server/index.ts; then
    echo -e "${GREEN}✓${NC} Type export added: TimelineStep"
else
    echo -e "${RED}✗${NC} Type export missing: TimelineStep"
fi

# Check handler implementation
echo ""
echo "Checking handler implementation..."

ENDPOINTS=(
  "GET /api/missions/active"
  "GET /api/missions/recent"
  "GET /api/missions/:runId/timeline"
)

for endpoint in "${ENDPOINTS[@]}"; do
    if grep -q "$endpoint" src/server/handlers/missions.ts; then
        echo -e "${GREEN}✓${NC} Endpoint implemented: $endpoint"
    else
        echo -e "${RED}✗${NC} Endpoint missing: $endpoint"
    fi
done

# Check RBAC
echo ""
echo "Checking RBAC implementation..."
if grep -q "requireRole('viewer')" src/server/handlers/missions.ts; then
    VIEWER_COUNT=$(grep -o "requireRole('viewer')" src/server/handlers/missions.ts | wc -l)
    echo -e "${GREEN}✓${NC} RBAC middleware applied: $VIEWER_COUNT endpoints require 'viewer' role"
else
    echo -e "${RED}✗${NC} RBAC middleware not found"
fi

# Check helper functions
echo ""
echo "Checking helper functions..."
if grep -q "function formatMissionRun" src/server/handlers/missions.ts; then
    echo -e "${GREEN}✓${NC} Helper function: formatMissionRun"
else
    echo -e "${RED}✗${NC} Helper function missing: formatMissionRun"
fi

if grep -q "function buildTimeline" src/server/handlers/missions.ts; then
    echo -e "${GREEN}✓${NC} Helper function: buildTimeline"
else
    echo -e "${RED}✗${NC} Helper function missing: buildTimeline"
fi

# Check type definitions
echo ""
echo "Checking type definitions..."
if grep -q "interface MissionRun" src/server/handlers/missions.ts; then
    echo -e "${GREEN}✓${NC} Type definition: MissionRun"
else
    echo -e "${RED}✗${NC} Type definition missing: MissionRun"
fi

if grep -q "interface TimelineStep" src/server/handlers/missions.ts; then
    echo -e "${GREEN}✓${NC} Type definition: TimelineStep"
else
    echo -e "${RED}✗${NC} Type definition missing: TimelineStep"
fi

# Check error handling
echo ""
echo "Checking error handling..."
if grep -q "return c.json" src/server/handlers/missions.ts | grep -q "400"; then
    echo -e "${GREEN}✓${NC} Error handling: 400 Bad Request"
else
    echo -e "${YELLOW}⚠${NC} Warning: 400 error handling may be missing"
fi

if grep -q "return c.json" src/server/handlers/missions.ts | grep -q "404"; then
    echo -e "${GREEN}✓${NC} Error handling: 404 Not Found"
else
    echo -e "${YELLOW}⚠${NC} Warning: 404 error handling may be missing"
fi

if grep -q "return c.json" src/server/handlers/missions.ts | grep -q "500"; then
    echo -e "${GREEN}✓${NC} Error handling: 500 Internal Server Error"
else
    echo -e "${YELLOW}⚠${NC} Warning: 500 error handling may be missing"
fi

# Check documentation
echo ""
echo "Checking documentation..."
if [ -f "MISSIONS_API_IMPLEMENTATION.md" ]; then
    echo -e "${GREEN}✓${NC} Documentation: MISSIONS_API_IMPLEMENTATION.md"
else
    echo -e "${YELLOW}⚠${NC} Documentation missing: MISSIONS_API_IMPLEMENTATION.md"
fi

if [ -f "MISSIONS_API_TESTING.md" ]; then
    echo -e "${GREEN}✓${NC} Documentation: MISSIONS_API_TESTING.md"
else
    echo -e "${YELLOW}⚠${NC} Documentation missing: MISSIONS_API_TESTING.md"
fi

if [ -f "src/server/example-missions-integration.ts" ]; then
    echo -e "${GREEN}✓${NC} Example integration: src/server/example-missions-integration.ts"
else
    echo -e "${YELLOW}⚠${NC} Example integration missing"
fi

# Summary
echo ""
echo "========================================"
echo "Verification Complete"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Test the endpoints with real workflow runs"
echo "2. Wire up MissionRunsView UI component"
echo "3. Add unit and integration tests"
echo "4. Deploy and verify in production"
