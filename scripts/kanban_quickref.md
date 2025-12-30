# Vibe-Kanban Quick Reference Card

## Database Location
```
~/.local/share/vibe-kanban/db.sqlite
```

## Current In-Review Tasks (Conductor-brnd)

### 1. [PHASE-5.5] Implement Audit Logging System
- **ID**: `cf927c55-84a7-48f7-a92f-3b206521ba8a`
- **Status**: inreview
- **PR**: https://github.com/0xtsotsi/Conductor.brnd/pull/8
- **Updated**: 2025-12-30 07:25:30

### 2. [PHASE-5.3] Implement JWT Refresh Token Mechanism
- **ID**: `0b405617-64d2-42ec-91a4-b351597c6bd1`
- **Status**: inreview
- **PR**: https://github.com/0xtsotsi/Conductor.brnd/pull/8
- **Updated**: 2025-12-30 07:22:45

### 3. [PHASE-5.2] Build User Management CRUD API
- **ID**: `6c0d6867-1a58-4cbc-b96e-2fbed2a8243c`
- **Status**: inreview
- **PR**: https://github.com/0xtsotsi/Conductor.brnd/pull/8
- **Updated**: 2025-12-30 07:21:37

## Quick Commands

### Get In-Review Tasks
```bash
# Easiest
./scripts/get_inreview_tasks.sh

# JSON output
./scripts/get_inreview_tasks.sh --json

# Save to file
./scripts/get_inreview_tasks.sh --output inreview.json
```

### Get All Projects
```bash
python3 scripts/kanban_query.py --list-projects
```

### Get All Tasks (Conductor-brnd)
```bash
python3 scripts/kanban_query.py --list-tasks --project-name "Conductor-brnd"
```

### Get Specific Task
```bash
python3 scripts/kanban_query.py --get-task cf927c55-84a7-48f7-a92f-3b206521ba8a
```

### Filter by Status
```bash
# In-progress
python3 scripts/kanban_query.py --list-tasks --project-name "Conductor-brnd" --status inprogress

# Done
python3 scripts/kanban_query.py --list-tasks --project-name "Conductor-brnd" --status done

# Cancelled
python3 scripts/kanban_query.py --list-tasks --project-name "Conductor-brnd" --status cancelled
```

## Project IDs

- **Conductor-brnd**: `bc2b4968-d4fc-4a7b-b3ca-8dc8e062400a`
- **Calndrbrnd.com**: `2f89fe1b-6695-4816-8da9-ad8d93faba70`
- **DevFlow**: `b1dce003-a326-4994-bc0b-04b628cf1434`

## Task Status Values

- `todo` - Not started
- `inprogress` - Actively working
- `inreview` - Awaiting review
- `done` - Completed
- `cancelled` - Cancelled

## MCP Tools (Already Available)

- `mcp__vibe_kanban__list_projects` - List all projects
- `mcp__vibe_kanban__list_tasks` - List tasks (with status filter)
- `mcp__vibe_kanban__get_task` - Get task details
- `mcp__vibe_kanban__create_task` - Create new task
- `mcp__vibe_kanban__update_task` - Update task
- `mcp__vibe_kanban__delete_task` - Delete task
- `mcp__vibe_kanban__start_workspace_session` - Start working on task

## Web Interface

```
http://localhost:39861
```

## Direct Database Query (if sqlite3 is installed)

```bash
sqlite3 ~/.local/share/vibe-kanban/db.sqlite \
  "SELECT title, status FROM tasks WHERE status='inreview'"
```

## Python Example

```python
from scripts.kanban_query import KanbanQuery

kq = KanbanQuery()

# Get in-review tasks
tasks = kq.list_tasks(
    project_id='bc2b4968-d4fc-4a7b-b3ca-8dc8e062400a',
    status='inreview'
)

for task in tasks:
    print(f"Task: {task['title']}")
    print(f"Description: {task['description']}")
    print()
```
