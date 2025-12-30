#!/bin/bash
#
# Get In-Review Tasks from Vibe-Kanban
#
# This script queries the vibe-kanban database for tasks in "inreview" status.
#
# Usage:
#   ./get_inreview_tasks.sh                    # Use default project ID
#   ./get_inreview_tasks.sh --project-id UUID  # Use specific project ID
#   ./get_inreview_tasks.sh --project-name NAME # Search by project name
#   ./get_inreview_tasks.sh --json             # Output as JSON
#   ./get_inreview_tasks.sh --output file.json # Save to file
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="${SCRIPT_DIR}/kanban_query.py"

# Default project
PROJECT_ID="bc2b4968-d4fc-4a7b-b3ca-8dc8e062400a"

# Parse arguments
PROJECT_NAME=""
OUTPUT_JSON=false
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --project-id)
            PROJECT_ID="$2"
            shift 2
            ;;
        --project-name)
            PROJECT_NAME="$2"
            shift 2
            ;;
        --json)
            OUTPUT_JSON=true
            shift
            ;;
        --output|-o)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project-id UUID     Project ID (default: ${PROJECT_ID})"
            echo "  --project-name NAME   Search by project name"
            echo "  --json                Output as JSON"
            echo "  --output, -o FILE     Save to JSON file"
            echo "  --help, -h            Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Build command
CMD="python3 ${PYTHON_SCRIPT} --list-tasks --status inreview"

if [ -n "$PROJECT_NAME" ]; then
    CMD="${CMD} --project-name \"${PROJECT_NAME}\""
else
    CMD="${CMD} --project-id ${PROJECT_ID}"
fi

if [ "$OUTPUT_JSON" = true ]; then
    CMD="${CMD} --json"
fi

if [ -n "$OUTPUT_FILE" ]; then
    CMD="${CMD} --output \"${OUTPUT_FILE}\""
fi

# Execute
eval "$CMD"
