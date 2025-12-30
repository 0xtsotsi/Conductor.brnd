# Vibe-Kanban Access Investigation - Summary

## Problem Statement

The vibe-kanban web UI (running on port 39861) returns HTML (SPA), making it difficult to access Kanban board data programmatically via HTTP requests. We needed a way to:
1. List all tasks in project "bc2b4968-d4fc-4a7b-b3ca-8dc8e062400a"
2. Filter tasks by "inreview" status
3. Get task details including title, description, and linked artifacts

## Investigation Results

### 1. Database Discovery ✅

**Location Found:** `~/.local/share/vibe-kanban/db.sqlite`

- **Type:** SQLite 3 database
- **Size:** 56.1 MB
- **Tables:** 18 tables including tasks, projects, workspaces, repos, etc.

**Key Tables:**
- `projects` - Kanban projects
- `tasks` - Task cards with status, title, description
- `workspaces` - Active working sessions
- `repos` - Linked Git repositories

### 2. Vibe-Kanban Process ✅

**Running Process:**
- Binary: `/home/oxtsotsi/.vibe-kanban/bin/v0.0.142-20251221174744/linux-x64/vibe-kanban`
- Web Server: Listening on port 39861
- Multiple MCP server instances running

### 3. Data Access Methods

#### Method A: Direct Database Access (Recommended) ✅

**Created Tools:**
1. `/home/oxtsotsi/Webrnds/Conductor-brnd/scripts/kanban_query.py` - Full-featured query tool
2. `/home/oxtsotsi/Webrnds/Conductor-brnd/scripts/get_inreview_tasks.sh` - Convenience wrapper

**Usage:**
```bash
# Get all in-review tasks
./scripts/get_inreview_tasks.sh

# Get tasks as JSON
./scripts/get_inreview_tasks.sh --json

# Save to file
./scripts/get_inreview_tasks.sh --output inreview.json

# Advanced filtering
python3 scripts/kanban_query.py \
    --list-tasks \
    --project-name "Conductor-brnd" \
    --status inreview \
    --limit 10
```

#### Method B: MCP Tools (Already Available) ✅

**Available MCP Functions:**
- `mcp__vibe_kanban__list_projects` - List all projects
- `mcp__vibe_kanban__list_tasks` - List tasks with status filter
- `mcp__vibe_kanban__get_task` - Get detailed task information
- `mcp__vibe_kanban__create_task` - Create new task
- `mcp__vibe_kanban__update_task` - Update task status/details
- `mcp__vibe_kanban__delete_task` - Delete a task
- `mcp__vibe_kanban__start_workspace_session` - Start working on a task

#### Method C: Browser Automation (Possible but Not Recommended)

The Chrome MCP automation tools could be used to:
1. Navigate to http://localhost:39861
2. Scrape the page content
3. Extract task data from DOM

**Why Not Recommended:**
- Requires browser to be running
- Slower than direct database access
- More fragile (depends on UI structure)
- Unnecessary when database is accessible locally

#### Method D: Direct SQL (Requires sqlite3 CLI)

```bash
sqlite3 ~/.local/share/vibe-kanban/db.sqlite \
  "SELECT title, description FROM tasks WHERE status='inreview'"
```

**Limitation:** sqlite3 CLI not installed on system.

## Current In-Review Tasks

Successfully retrieved **3 tasks** in "inreview" status for the Conductor-brnd project:

### 1. [PHASE-5.5] Implement Audit Logging System
- **Task ID:** `cf927c55-84a7-48f7-a92f-3b206521ba8a`
- **Status:** inreview
- **Pull Request:** https://github.com/0xtsotsi/Conductor.brnd/pull/8
- **Created:** 2025-12-30 07:11:52
- **Updated:** 2025-12-30 07:25:30
- **Description:** Implement comprehensive audit logging system with event tracking, middleware, API endpoints, 577-line test suite, and PostgreSQL integration.

### 2. [PHASE-5.3] Implement JWT Refresh Token Mechanism
- **Task ID:** `0b405617-64d2-42ec-91a4-b351597c6bd1`
- **Status:** inreview
- **Pull Request:** https://github.com/0xtsotsi/Conductor.brnd/pull/8
- **Created:** 2025-12-30 07:11:03
- **Updated:** 2025-12-30 07:22:45
- **Description:** Implement JWT refresh token mechanism with token rotation, refresh/logout endpoints, SHA-256 hashing, and 30-day expiration.

### 3. [PHASE-5.2] Build User Management CRUD API
- **Task ID:** `6c0d6867-1a58-4cbc-b96e-2fbed2a8243c`
- **Status:** inreview
- **Pull Request:** https://github.com/0xtsotsi/Conductor.brnd/pull/8
- **Created:** 2025-12-30 07:11:03
- **Updated:** 2025-12-30 07:21:37
- **Description:** Implement User Management CRUD API with Create, Read, Update, Delete operations, role-based access control, user listing with filters, and PostgreSQL integration.

## Database Schema

### Tasks Table Structure
```sql
CREATE TABLE tasks (
    id BLOB PRIMARY KEY,              -- UUID
    project_id BLOB NOT NULL,         -- Foreign key to projects
    title TEXT NOT NULL,              -- Task title
    description TEXT,                 -- Task description (nullable)
    status TEXT NOT NULL,             -- todo, inprogress, inreview, done, cancelled
    created_at TEXT NOT NULL,         -- Timestamp
    updated_at TEXT NOT NULL,         -- Timestamp
    parent_workspace_id BLOB,         -- Optional workspace reference
    shared_task_id BLOB               -- Optional shared task reference
);
```

### Status Values
- `todo` - Task not started
- `inprogress` - Task actively being worked on
- `inreview` - Task completed, awaiting review
- `done` - Task completed and approved
- `cancelled` - Task cancelled

## Solution Provided

### 1. Python Query Tool (`kanban_query.py`)
**Features:**
- List all projects
- Find project by name
- List tasks with filters (project, status, limit)
- Get specific task details
- Get workspace sessions
- JSON output support
- File export capability

**Usage:**
```bash
python3 scripts/kanban_query.py [OPTIONS]
```

### 2. Bash Wrapper Script (`get_inreview_tasks.sh`)
**Features:**
- Quick access to in-review tasks
- Project name or ID support
- JSON output option
- File export
- Pre-configured for Conductor-brnd project

**Usage:**
```bash
./scripts/get_inreview_tasks.sh [OPTIONS]
```

### 3. Documentation
- **VIBE_KANBAN_ACCESS.md** - Comprehensive guide with examples
- **kanban_quickref.md** - Quick reference card with common commands
- **kanban_query.py** - Self-documenting with --help

## Recommendations

### For Daily Use
1. **Use the bash wrapper** for quick access to in-review tasks:
   ```bash
   ./scripts/get_inreview_tasks.sh --json
   ```

2. **Use the Python tool** for advanced filtering:
   ```bash
   python3 scripts/kanban_query.py --list-tasks --status done --limit 5
   ```

3. **Use MCP tools** when already in Claude Code environment:
   - Already integrated
   - No additional setup needed
   - Can modify tasks directly

### For Automation/CI/CD
1. **Use Python script** with JSON output:
   ```bash
   python3 scripts/kanban_query.py --list-tasks --status inreview --output tasks.json
   ```

2. **Parse JSON** for downstream processing:
   ```python
   import json
   tasks = json.loads(Path('tasks.json').read_text())
   ```

### For Integration
1. **Import KanbanQuery class** directly in Python code
2. **Use MCP tools** for task manipulation
3. **Query database** directly if needed (using sqlite3 module)

## Files Created

1. **scripts/kanban_query.py** (447 lines)
   - Full-featured query tool
   - Python API
   - CLI interface
   - JSON export

2. **scripts/get_inreview_tasks.sh** (56 lines)
   - Bash wrapper
   - Pre-configured for Conductor-brnd
   - Quick access to in-review tasks

3. **scripts/VIBE_KANBAN_ACCESS.md** (334 lines)
   - Comprehensive guide
   - Usage examples
   - Database schema
   - Troubleshooting

4. **scripts/kanban_quickref.md** (116 lines)
   - Quick reference card
   - Common commands
   - Current in-review tasks
   - Project IDs

## Summary

✅ **Problem Solved:** Full access to vibe-kanban data achieved through SQLite database

✅ **Tools Created:** Python query tool + Bash wrapper + Documentation

✅ **In-Review Tasks Retrieved:** 3 tasks successfully extracted with all details

✅ **Multiple Access Methods:** Database, MCP tools, Python API, CLI

✅ **Production Ready:** Error handling, documentation, examples provided

## Next Steps

1. **Integrate into workflow:**
   - Add to CI/CD pipeline for task tracking
   - Create automated reports
   - Monitor task status changes

2. **Extend functionality:**
   - Add task creation from CLI
   - Bulk task updates
   - Task dependency tracking

3. **Enhance automation:**
   - Status change notifications
   - PR integration
   - Time tracking

## Contact

For questions or issues with the Kanban access tools, refer to:
- `scripts/VIBE_KANBAN_ACCESS.md` - Full documentation
- `scripts/kanban_query.py --help` - CLI help
- Vibe-kanban repository - https://github.com/vibe-kanban
