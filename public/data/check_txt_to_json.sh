for f in *.txt; do [ ! -f "$f.json" ] && echo "Brak JSON dla: $f"; done
