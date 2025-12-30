# Vibe-Kanban Access Guide

This guide explains how to access the vibe-kanban board data programmatically to query tasks, filter by status, and extract information for automation.

## Overview

The vibe-kanban application stores all its data in a SQLite database at:
```
~/.local/share/vibe-kanban/db.sqlite
```

This database contains:
- **Projects** - Kanban projects
- **Tasks** - Task cards with titles, descriptions, and status
- **Workspaces** - Active workspace sessions
- **Repositories** - Linked Git repositories
- **Execution processes** - Agent execution logs

## Quick Start

### 1. Get All Tasks In Review

```bash
# Using the wrapper script (easiest)
./scripts/get_inreview_tasks.sh

# Output as JSON
./scripts/get_inreview_tasks.sh --json

# Save to file
./scripts/get_inreview_tasks.sh --output inreview_tasks.json
```

### 2. Get All Projects

```bash
python3 scripts/kanban_query.py --list-projects
```

### 3. Get All Tasks for a Project

```bash
# By project name
python3 scripts/kanban_query.py --list-tasks --project-name "Conductor-brnd"

# By project ID
python3 scripts/kanban_query.py --list-tasks --project-id bc2b4968-d4fc-4a7b-b3ca-8dc8e062400a
```

### 4. Filter Tasks by Status

```bash
# Get in-review tasks
python3 scripts/kanban_query.py --list-tasks --project-name "Conductor-brnd" --status inreview

# Get in-progress tasks
python3 scripts/kanban_query.py --list-tasks --project-name "Conductor-brnd" --status inprogress

# Get completed tasks
python3 scripts/kanban_query.py --list-tasks --project-name "Conductor-brnd" --status done
```

### 5. Get Specific Task Details

```bash
python3 scripts/kanban_query.py --get-task cf927c55-84a7-48f7-a92f-3b206521ba8a
```

## Database Schema

### Projects Table

| Column | Type | Description |
|--------|------|-------------|
| id | BLOB | UUID (primary key) |
| name | TEXT | Project name |
| dev_script | TEXT | Development script |
| remote_project_id | BLOB | Remote project ID |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

### Tasks Table

| Column | Type | Description |
|--------|------|-------------|
| id | BLOB | UUID (primary key) |
| project_id | BLOB | Foreign key to projects |
| title | TEXT | Task title |
| description | TEXT | Task description |
| status | TEXT | todo, inprogress, inreview, done, cancelled |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |
| parent_workspace_id | BLOB | Associated workspace (optional) |
| shared_task_id | BLOB | Shared task ID (optional) |

### Task Status Values

- **todo** - Task not started
- **inprogress** - Task actively being worked on
- **inreview** - Task completed, awaiting review
- **done** - Task completed and approved
- **cancelled** - Task cancelled

## Script Usage

### kanban_query.py

The main query tool with full functionality:

```bash
# List all projects
python3 scripts/kanban_query.py --list-projects

# List tasks with filters
python3 scripts/kanban_query.py --list-tasks \
    --project-name "Conductor-brnd" \
    --status inreview \
    --limit 10

# Get specific task
python3 scripts/kanban_query.py --get-task <task-uuid>

# Export to JSON
python3 scripts/kanban_query.py \
    --list-tasks \
    --project-name "Conductor-brnd" \
    --status inreview \
    --output tasks.json

# Get workspace sessions
python3 scripts/kanban_query.py --get-workspaces --project-name "Conductor-brnd"
```

### get_inreview_tasks.sh

Convenience wrapper for getting in-review tasks:

```bash
# Default project (Conductor-brnd)
./scripts/get_inreview_tasks.sh

# Custom project
./scripts/get_inreview_tasks.sh --project-name "My Project"

# JSON output
./scripts/get_inreview_tasks.sh --json

# Save to file
./scripts/get_inreview_tasks.sh --output inreview.json
```

## Python API

You can also use the KanbanQuery class directly in Python:

```python
from scripts.kanban_query import KanbanQuery

# Initialize
kq = KanbanQuery()

# List projects
projects = kq.list_projects()
for project in projects:
    print(f"{project['name']}: {project['id']}")

# Find project by name
project = kq.find_project_by_name("Conductor-brnd")
print(f"Found: {project['id']}")

# Get tasks with filters
tasks = kq.list_tasks(
    project_id=project['id'],
    status='inreview',
    limit=10
)

for task in tasks:
    print(f"Task: {task['title']}")
    print(f"Status: {task['status']}")
    print(f"Description: {task['description'][:100]}...")

# Get specific task
task = kq.get_task('cf927c55-84a7-48f7-a92f-3b206521ba8a')
print(task['description'])
```

## Current Project Configuration

The Conductor-brnd project ID is:
```
bc2b4968-d4fc-4a7b-b3ca-8dc8e062400a
```

This is set as the default in `get_inreview_tasks.sh`.

## Examples

### Example 1: Find All In-Review Tasks

```bash
# Get all in-review tasks as JSON
./scripts/get_inreview_tasks.sh --json > inreview.json

# Parse with jq
./scripts/get_inreview_tasks.sh --json | jq '.[] | {title, status}'
```

### Example 2: Get Task Count by Status

```bash
python3 << 'EOF'
from scripts.kanban_query import KanbanQuery
from collections import Counter

kq = KanbanQuery()
project = kq.find_project_by_name("Conductor-brnd")
tasks = kq.list_tasks(project_id=project['id'])

status_counts = Counter(t['status'] for t in tasks)
for status, count in status_counts.items():
    print(f"{status}: {count}")
EOF
```

### Example 3: Get Tasks Modified Today

```bash
python3 << 'EOF'
from scripts.kanban_query import KanbanQuery
from datetime import date

kq = KanbanQuery()
project = kq.find_project_by_name("Conductor-brnd")
tasks = kq.list_tasks(project_id=project['id'])

today = date.today().isoformat()
today_tasks = [t for t in tasks if t['updated_at'].startswith(today)]

print(f"Tasks updated today ({today}): {len(today_tasks)}")
for task in today_tasks:
    print(f"  - {task['title']}")
EOF
```

### Example 4: Export Tasks for Review

```bash
# Get all in-review tasks with full details
python3 scripts/kanban_query.py \
    --list-tasks \
    --project-name "Conductor-brnd" \
    --status inreview \
    --output inreview_tasks.json

# Create a formatted report
python3 << 'EOF'
import json
from pathlib import Path

tasks = json.loads(Path('inreview_tasks.json').read_text())

print("# In-Review Tasks Report\n")
print(f"Total: {len(tasks)} tasks\n")

for i, task in enumerate(tasks, 1):
    print(f"## {i}. {task['title']}")
    print(f"**ID:** {task['id']}")
    print(f"**Status:** {task['status']}")
    print(f"**Updated:** {task['updated_at']}")
    print()
    print(task['description'])
    print("\n---\n")
EOF
```

## Vibe-Kanban Web Interface

The web UI runs on port 39861 by default:

```
http://localhost:39861
```

However, the web interface returns HTML (SPA) and doesn't provide direct API access. Use the scripts above to access the data programmatically.

## MCP Integration

Vibe-kanban also provides an MCP (Model Context Protocol) server. The MCP tools available include:

- `mcp__vibe_kanban__list_projects` - List all projects
- `mcp__vibe_kanban__list_tasks` - List tasks in a project
- `mcp__vibe_kanban__get_task` - Get task details
- `mcp__vibe_kanban__create_task` - Create a new task
- `mcp__vibe_kanban__update_task` - Update task status/title/description
- `mcp__vibe_kanban__delete_task` - Delete a task
- `mcp__vibe_kanban__start_workspace_session` - Start working on a task
- `mcp__vibe_kanban__list_repos` - List repositories in a project

## Troubleshooting

### Database Not Found

If you get "Database not found", check the path:

```bash
ls -la ~/.local/share/vibe-kanban/
```

If the directory doesn't exist, vibe-kanban might be installed in a different location or not running.

### Permission Denied

Make sure scripts are executable:

```bash
chmod +x scripts/kanban_query.py
chmod +x scripts/get_inreview_tasks.sh
```

### Python Not Found

The script requires Python 3 with sqlite3 support (standard library). Ensure Python 3 is installed:

```bash
python3 --version
```

## Related Files

- `/home/oxtsotsi/.local/share/vibe-kanban/db.sqlite` - Main database
- `/home/oxtsotsi/.local/share/vibe-kanban/config.json` - Vibe-kanban configuration
- `/home/oxtsotsi/Webrnds/Conductor-brnd/scripts/kanban_query.py` - Query tool
- `/home/oxtsotsi/Webrnds/Conductor-brnd/scripts/get_inreview_tasks.sh` - Convenience wrapper

## Additional Resources

- Vibe-kanban GitHub: https://github.com/vibe-kanban
- SQLite Documentation: https://www.sqlite.org/docs.html
