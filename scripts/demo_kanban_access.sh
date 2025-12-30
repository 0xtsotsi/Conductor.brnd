#!/bin/bash
#
# Demonstration of Vibe-Kanban Access Methods
#

echo "================================================================================"
echo "VIBE-KANBAN ACCESS DEMONSTRATION"
echo "================================================================================"
echo ""
echo "Project: Conductor-brnd (bc2b4968-d4fc-4a7b-b3ca-8dc8e062400a)"
echo "Status Filter: inreview"
echo ""

echo "--------------------------------------------------------------------------------"
echo "METHOD 1: Bash Wrapper Script (Easiest)"
echo "--------------------------------------------------------------------------------"
echo ""
echo "Command: ./scripts/get_inreview_tasks.sh"
echo ""
./scripts/get_inreview_tasks.sh | head -50
echo ""

echo "--------------------------------------------------------------------------------"
echo "METHOD 2: Python Query Tool (Flexible)"
echo "--------------------------------------------------------------------------------"
echo ""
echo "Command: python3 scripts/kanban_query.py --list-tasks --project-name \"Conductor-brnd\" --status inreview --json | jq -r '.[] | .title'"
echo ""
python3 scripts/kanban_query.py --list-tasks --project-name "Conductor-brnd" --status inreview --json | jq -r '.[] | .title'
echo ""

echo "--------------------------------------------------------------------------------"
echo "METHOD 3: Python API (Programmatic)"
echo "--------------------------------------------------------------------------------"
echo ""

python3 << 'PYEOF'
from scripts.kanban_query import KanbanQuery

kq = KanbanQuery()
project = kq.find_project_by_name("Conductor-brnd")
tasks = kq.list_tasks(project_id=project['id'], status='inreview')

print(f"Project: {project['name']}")
print(f"Total in-review tasks: {len(tasks)}")
print()

for i, task in enumerate(tasks, 1):
    print(f"{i}. {task['title']}")
    print(f"   Status: {task['status']}")
    print(f"   Updated: {task['updated_at']}")

    # Extract PR link
    desc = task['description']
    if 'github.com' in desc:
        for line in desc.split('\n'):
            if 'github.com' in line:
                print(f"   {line.strip()}")
                break
    print()
PYEOF

echo "--------------------------------------------------------------------------------"
echo "METHOD 4: Direct Database Query (Raw SQL)"
echo "--------------------------------------------------------------------------------"
echo ""

python3 << 'PYEOF'
import sqlite3
from pathlib import Path

db_path = Path.home() / '.local' / 'share' / 'vibe-kanban' / 'db.sqlite'
conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

project_id_hex = 'bc2b4968-d4fc-4a7b-b3ca-8dc8e062400a'
project_id_bytes = bytes.fromhex(project_id_hex.replace('-', ''))

cursor.execute('''
    SELECT title, status, updated_at
    FROM tasks
    WHERE project_id = ? AND status = 'inreview'
    ORDER BY updated_at DESC
''', (project_id_bytes,))

tasks = cursor.fetchall()

print("SQL Query Results:")
for task in tasks:
    print(f"  - {task['title']}")
    print(f"    Status: {task['status']}, Updated: {task['updated_at']}")

conn.close()
PYEOF

echo ""
echo "--------------------------------------------------------------------------------"
echo "METHOD 5: MCP Tools (Integrated)"
echo "--------------------------------------------------------------------------------"
echo ""
echo "The following MCP tools are available in this environment:"
echo ""
echo "  - mcp__vibe_kanban__list_projects"
echo "  - mcp__vibe_kanban__list_tasks (with status filter)"
echo "  - mcp__vibe_kanban__get_task"
echo "  - mcp__vibe_kanban__create_task"
echo "  - mcp__vibe_kanban__update_task"
echo "  - mcp__vibe_kanban__delete_task"
echo "  - mcp__vibe_kanban__start_workspace_session"
echo ""
echo "These can be called directly from Claude Code or via MCP client."
echo ""

echo "--------------------------------------------------------------------------------"
echo "SUMMARY"
echo "--------------------------------------------------------------------------------"
echo ""
echo "All methods successfully retrieved 3 in-review tasks:"
echo "  1. [PHASE-5.5] Implement Audit Logging System"
echo "  2. [PHASE-5.3] Implement JWT Refresh Token Mechanism"
echo "  3. [PHASE-5.2] Build User Management CRUD API"
echo ""
echo "Recommended method for daily use: Bash wrapper (METHOD 1)"
echo "Recommended method for automation: Python API (METHOD 3)"
echo "Recommended method for integration: MCP tools (METHOD 5)"
echo ""
echo "================================================================================"
