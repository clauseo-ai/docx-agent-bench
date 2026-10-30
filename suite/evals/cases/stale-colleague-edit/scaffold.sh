#!/usr/bin/env bash
source "$(dirname "$0")/../../lib/scaffold.sh"
rm -f "$(dirname "$0")/0b8f3c2e-5d1a-4e7b-9c6f-2a4d8e1f7b30.jsonl"
# docs/master-supply-agreement.redline.docx is built by scripts/build-fixtures.py: turn 1, as the
# history file tells it (net 45 days in 11.1, tracked by Eval Reviewer), then a colleague's tracked
# insertion in 11.2 between the turns (" rated at least A-", by Dana Colleague).
setup master-supply-agreement master-supply-agreement.redline
snapshot
