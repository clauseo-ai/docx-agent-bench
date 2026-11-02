#!/usr/bin/env bash
# shellcheck source-path=SCRIPTDIR source=../../lib/scaffold.sh
source "$(dirname "$0")/../../lib/scaffold.sh"
setup swap-confirmation-counterparty
snapshot
# The grading reference (never copied into the workspace): the document read as final with the amount and date
# changes rejected and every other change accepted. report.sh diffs each written .docx against it.
echo swap-confirmation-counterparty.expected > "$state/expected-final"
