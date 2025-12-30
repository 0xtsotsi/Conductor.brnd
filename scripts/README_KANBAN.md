# Vibe-Kanban Access Scripts

This directory contains tools for accessing and querying the Vibe-Kanban board data.

## Quick Start

```bash
# Get all in-review tasks for Conductor-brnd project
./get_inreview_tasks.sh

# Run full demonstration
./demo_kanban_access.sh
```

## Available Scripts

### 1. kanban_query.py
**Full-featured Python query tool with CLI and API**

Features:
- List all projects
- Find project by name
- List tasks with filters (project, status, limit)
- Get specific task details
- Get workspace sessions
- JSON output and file export

Usage:
```bash
python3 kanban_query.py --help
python3 kanban_query.py --list-projects
python3 kanban_query.py --list-tasks --project-name "Conductor-brnd" --status inreview
python3 kanban_query.py --get-task <task-id> --output task.json
```

### 2. get_inreview_tasks.sh
**Convenience wrapper for quick access to in-review tasks**

Features:
- Pre-configured for Conductor-brnd project
- JSON output option
- File export

Usage:
```bash
./get_inreview_tasks.sh
./get_inreview_tasks.sh --json
./get_inreview_tasks.sh --output inreview.json
./get_inreview_tasks.sh --project-name "My Project"
```

### 3. demo_kanban_access.sh
**Comprehensive demonstration of all access methods**

Demonstrates:
- Bash wrapper usage
- Python CLI tool
- Python API
- Direct SQL queries
- MCP tools

Usage:
```bash
./demo_kanban_access.sh
```

## Documentation

- **VIBE_KANBAN_ACCESS.md** - Comprehensive guide with examples
- **kanban_quickref.md** - Quick reference card
- **KANBAN_ACCESS_SUMMARY.md** - Investigation summary and solution

## Common Tasks

### List All Projects
```bash
python3 kanban_query.py --list-projects
```

### Get In-Review Tasks
```bash
./get_inreview_tasks.sh
```

### Get All Tasks for a Project
```bash
python3 kanban_query.py --list-tasks --project-name "Conductor-brnd"
```

### Filter by Status
```bash
# In-progress
python3 kanban_query.py --list-tasks --project-name "Conductor-brnd" --status inprogress

# Done
python3 kanban_query.py --list-tasks --project-name "Conductor-brnd" --status done
```

### Get Specific Task
```bash
python3 kanban_query.py --get-task cf927c55-84a7-48f7-a92f-3b206521ba8a
```

### Export to JSON
```bash
python3 kanban_query.py --list-tasks --project-name "Conductor-brnd" --status inreview --output tasks.json
```

## Python API Example

```python
from scripts.kanban_query import KanbanQuery

# Initialize
kq = KanbanQuery()

# Find project
project = kq.find_project_by_name("Conductor-brnd")

# Get in-review tasks
tasks = kq.list_tasks(
    project_id=project['id'],
    status='inreview'
)

# Process tasks
for task in tasks:
    print(f"Task: {task['title']}")
    print(f"Status: {task['status']}")
    print(f"Description: {task['description']}")
```

## Database Schema

### Tasks Table
- `id` - UUID (primary key)
- `project_id` - UUID (foreign key)
- `title` - Task title
- `description` - Task description
- `status` - todo, inprogress, inreview, done, cancelled
- `created_at` - Timestamp
- `updated_at` - Timestamp

### Projects Table
- `id` - UUID (primary key)
- `name` - Project name
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Status Values

- `todo` - Not started
- `inprogress` - Actively working
- `inreview` - Awaiting review
- `done` - Completed
- `cancelled` - Cancelled

## Database Location

```
~/.local/share/vibe-kanban/db.sqlite
```

## Current Projects

- **Conductor-brnd** (bc2b4968-d4fc-4a7b-b3ca-8dc8e062400a)
- **Calndrbrnd.com** (2f89fe1b-6695-4816-8da9-ad8d93faba70)
- **DevFlow** (b1dce003-a326-4994-bc0b-04b628cf1434)

## Requirements

- Python 3.x (with sqlite3 module - standard library)
- Bash 4.x
- jq (optional, for JSON formatting)

## Troubleshooting

### Database Not Found
```bash
ls -la ~/.local/share/vibe-kanban/
```

### Permission Denied
```bash
chmod +x kanban_query.py
chmod +x get_inreview_tasks.sh
chmod +x demo_kanban_access.sh
```

### Python Not Found
```bash
python3 --version
```

## Additional Resources

- Vibe-kanban GitHub: https://github.com/vibe-kanban
- Vibe-kanban Web UI: http://localhost:39861
- MCP Tools: Available in Claude Code environment

## Support

For issues or questions:
1. Check VIBE_KANBAN_ACCESS.md for detailed documentation
2. Run `python3 kanban_query.py --help` for CLI help
3. Review demo_kanban_access.sh for usage examples
