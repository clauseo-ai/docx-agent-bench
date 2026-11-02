#!/usr/bin/env bash
# shellcheck source-path=SCRIPTDIR source=../../lib/scaffold.sh
source "$(dirname "$0")/../../lib/scaffold.sh"
setup_long long-indenture-markup issuer-draft-indenture.docx
snapshot
