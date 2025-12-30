#!/usr/bin/env python3
"""
Vibe-Kanban Query Tool

This script provides access to the vibe-kanban SQLite database for querying
tasks, projects, and workspace data.

Usage:
    python kanban_query.py --list-projects
    python kanban_query.py --list-tasks <project-id>
    python kanban_query.py --get-task <task-id>
    python kanban_query.py --filter-status <project-id> <status>
    python kanban_query.py --project-name "Conductor-brnd" --status inreview

Examples:
    # List all projects
    python kanban_query.py --list-projects

    # Get all tasks in "Conductor-brnd" project
    python kanban_query.py --project-name "Conductor-brnd" --list-tasks

    # Get only tasks in "inreview" status
    python kanban_query.py --project-name "Conductor-brnd" --status inreview

    # Get specific task details
    python kanban_query.py --task-id cf927c55-84a7-48f7-a92f-3b206521ba8a

    # Export tasks to JSON
    python kanban_query.py --project-name "Conductor-brnd" --output tasks.json
"""

import sqlite3
import argparse
import json
import sys
from pathlib import Path
from typing import Optional


class KanbanQuery:
    """Query tool for vibe-kanban SQLite database."""

    def __init__(self, db_path: str = None):
        """Initialize the KanbanQuery with database path."""
        if db_path is None:
            # Default vibe-kanban database location
            db_path = Path.home() / '.local' / 'share' / 'vibe-kanban' / 'db.sqlite'

        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found at: {self.db_path}")

        self.conn = None
        self.cursor = None

    def connect(self):
        """Establish database connection."""
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()

    def _blob_to_uuid(self, blob: bytes) -> str:
        """Convert BLOB to UUID string format."""
        if blob is None:
            return None
        hex_str = ''.join(f'{b:02x}' for b in blob)
        return f'{hex_str[0:8]}-{hex_str[8:12]}-{hex_str[12:16]}-{hex_str[16:20]}-{hex_str[20:32]}'

    def _uuid_to_blob(self, uuid_str: str) -> bytes:
        """Convert UUID string to BLOB."""
        return bytes.fromhex(uuid_str.replace('-', ''))

    def list_projects(self) -> list:
        """List all projects in the database."""
        self.connect()
        self.cursor.execute('SELECT * FROM projects ORDER BY created_at DESC')
        projects = self.cursor.fetchall()

        result = []
        for p in projects:
            result.append({
                'id': self._blob_to_uuid(p['id']),
                'name': p['name'],
                'created_at': p['created_at'],
                'updated_at': p['updated_at'],
            })

        self.close()
        return result

    def find_project_by_name(self, name: str) -> Optional[dict]:
        """Find a project by name (case-insensitive partial match)."""
        self.connect()
        self.cursor.execute(
            'SELECT * FROM projects WHERE LOWER(name) LIKE LOWER(?)',
            (f'%{name}%',)
        )
        project = self.cursor.fetchone()

        if project:
            result = {
                'id': self._blob_to_uuid(project['id']),
                'name': project['name'],
                'created_at': project['created_at'],
                'updated_at': project['updated_at'],
            }
            self.close()
            return result

        self.close()
        return None

    def list_tasks(self, project_id: str = None, status: str = None, limit: int = None) -> list:
        """
        List tasks with optional filtering.

        Args:
            project_id: Filter by project ID (UUID string)
            status: Filter by status (todo, inprogress, inreview, done, cancelled)
            limit: Maximum number of tasks to return

        Returns:
            List of task dictionaries
        """
        self.connect()

        query = 'SELECT * FROM tasks WHERE 1=1'
        params = []

        if project_id:
            query += ' AND project_id = ?'
            params.append(self._uuid_to_blob(project_id))

        if status:
            query += ' AND status = ?'
            params.append(status)

        query += ' ORDER BY created_at DESC'

        if limit:
            query += ' LIMIT ?'
            params.append(limit)

        self.cursor.execute(query, params)
        tasks = self.cursor.fetchall()

        result = []
        for task in tasks:
            result.append({
                'id': self._blob_to_uuid(task['id']),
                'project_id': self._blob_to_uuid(task['project_id']),
                'title': task['title'],
                'description': task['description'],
                'status': task['status'],
                'created_at': task['created_at'],
                'updated_at': task['updated_at'],
            })

        self.close()
        return result

    def get_task(self, task_id: str) -> Optional[dict]:
        """Get a specific task by ID."""
        self.connect()
        self.cursor.execute(
            'SELECT * FROM tasks WHERE id = ?',
            (self._uuid_to_blob(task_id),)
        )
        task = self.cursor.fetchone()

        if task:
            result = {
                'id': self._blob_to_uuid(task['id']),
                'project_id': self._blob_to_uuid(task['project_id']),
                'title': task['title'],
                'description': task['description'],
                'status': task['status'],
                'created_at': task['created_at'],
                'updated_at': task['updated_at'],
            }
            self.close()
            return result

        self.close()
        return None

    def get_workspaces(self, project_id: str = None) -> list:
        """Get workspace sessions for a project."""
        self.connect()

        if project_id:
            # Get workspaces that have tasks from this project
            self.cursor.execute('''
                SELECT DISTINCT w.* FROM workspaces w
                JOIN tasks t ON t.parent_workspace_id = w.id
                WHERE t.project_id = ?
                ORDER BY w.created_at DESC
            ''', (self._uuid_to_blob(project_id),))
        else:
            self.cursor.execute('SELECT * FROM workspaces ORDER BY created_at DESC')

        workspaces = self.cursor.fetchall()

        result = []
        for w in workspaces:
            result.append({
                'id': self._blob_to_uuid(w['id']),
                'created_at': w['created_at'],
            })

        self.close()
        return result


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Query vibe-kanban SQLite database',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Database path
    parser.add_argument('--db', type=str, help='Path to vibe-kanban database')

    # Actions
    parser.add_argument('--list-projects', action='store_true',
                       help='List all projects')
    parser.add_argument('--list-tasks', action='store_true',
                       help='List all tasks for a project')
    parser.add_argument('--get-task', type=str, metavar='TASK_ID',
                       help='Get details for a specific task')
    parser.add_argument('--get-workspaces', action='store_true',
                       help='Get workspace sessions')

    # Filters
    parser.add_argument('--project-id', type=str, metavar='UUID',
                       help='Project ID (UUID)')
    parser.add_argument('--project-name', type=str, metavar='NAME',
                       help='Project name (partial match)')
    parser.add_argument('--task-id', type=str, metavar='UUID',
                       help='Task ID (UUID)')
    parser.add_argument('--status', type=str,
                       choices=['todo', 'inprogress', 'inreview', 'done', 'cancelled'],
                       help='Filter by task status')
    parser.add_argument('--limit', type=int, metavar='N',
                       help='Limit number of results')

    # Output
    parser.add_argument('--output', '-o', type=str, metavar='FILE',
                       help='Output to JSON file')
    parser.add_argument('--json', action='store_true',
                       help='Output as JSON')

    args = parser.parse_args()

    try:
        kq = KanbanQuery(args.db)

        # Default action: list projects if no other action specified
        if not any([args.list_projects, args.list_tasks, args.get_task, args.get_workspaces]):
            args.list_projects = True

        result = None

        if args.list_projects:
            result = kq.list_projects()

        elif args.list_tasks or args.status or args.limit:
            # Determine project ID
            project_id = args.project_id
            if args.project_name:
                project = kq.find_project_by_name(args.project_name)
                if not project:
                    print(f"Error: Project '{args.project_name}' not found", file=sys.stderr)
                    sys.exit(1)
                project_id = project['id']
                print(f"Using project: {project['name']} (ID: {project['id']})", file=sys.stderr)

            result = kq.list_tasks(project_id=project_id, status=args.status, limit=args.limit)

        elif args.get_task:
            result = kq.get_task(args.get_task)
            if not result:
                print(f"Error: Task '{args.get_task}' not found", file=sys.stderr)
                sys.exit(1)

        elif args.get_workspaces:
            project_id = args.project_id
            if args.project_name:
                project = kq.find_project_by_name(args.project_name)
                if not project:
                    print(f"Error: Project '{args.project_name}' not found", file=sys.stderr)
                    sys.exit(1)
                project_id = project['id']

            result = kq.get_workspaces(project_id)

        # Output
        if args.output or args.json:
            json_output = json.dumps(result, indent=2, default=str)
            if args.output:
                Path(args.output).write_text(json_output)
                print(f"Output written to {args.output}", file=sys.stderr)
            else:
                print(json_output)
        else:
            # Pretty print
            if isinstance(result, list):
                for item in result:
                    print(json.dumps(item, indent=2, default=str))
                    print('-' * 80)
            else:
                print(json.dumps(result, indent=2, default=str))

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
