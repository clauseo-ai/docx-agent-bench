#!/usr/bin/env bash
# The text the graders read: the harness report with the reader's presentation removed, the same way for every arm.
#   normalise.sh < raw-report > graded-report
# - Comment range markers {cN} and {/cN} (and a lone {cN} point anchor) are dropped and the text they wrap is kept,
#   so "{c3}11.1{/c3} Payment" reads "11.1 Payment". Comment bodies keep their "{cN AUTHOR DATE}" label.
# - The reader's note on tracked changes by other authors is dropped: the line "N tracked change(s) by WHO already in
#   the document: ..." (with any wrapped continuation lines ending in a backslash) and the line after it, "If you did
#   not make them, tell the user about them."
# report.sh pipes its report through this before the graders run; scripts/rescore.mjs applies the same file to
# saved reports.
LC_ALL=C awk '
  skip_cont { if ($0 ~ /\\$/) next; skip_cont = 0; next }
  skip_note { skip_note = 0; if ($0 == "If you did not make them, tell the user about them.") next }
  /^[0-9]+ tracked changes? by .* already in the document: / { if ($0 ~ /\\$/) skip_cont = 1; skip_note = 1; next }
  { gsub(/\{\/?c[0-9]+\}/, ""); print }
'
