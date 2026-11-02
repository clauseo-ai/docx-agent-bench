#!/usr/bin/env bash
# shellcheck source-path=SCRIPTDIR source=../../lib/scaffold.sh
source "$(dirname "$0")/../../lib/scaffold.sh"
setup tidemark-draft-confirmation greenleaf-revised-confirmation
echo ./docs/greenleaf-revised-confirmation.docx > "$state/base-final"
snapshot
