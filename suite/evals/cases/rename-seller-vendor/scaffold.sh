#!/usr/bin/env bash
# shellcheck source-path=SCRIPTDIR source=../../lib/scaffold.sh
source "$(dirname "$0")/../../lib/scaffold.sh"
setup master-supply-agreement
snapshot
