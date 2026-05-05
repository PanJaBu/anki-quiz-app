#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from urllib.parse import urlparse
import os

def extract_filename_from_https(url: str) -> str | None:
    """Zwraca nazwę pliku z URL-a https:// lub None, jeśli niepoprawny/brak nazwy."""
    if not isinstance(url, str) or not url.startswith("https://"):
        return None
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        return None
    path = parsed.path.rstrip("/")  # usuń końcowe '/' żeby basename nie był pusty
    name = os.path.basename(path)
    return name or None

def walk_and_replace(obj, changes_counter: list[int]):
    """Rekursywnie przechodzi przez struktury i podmienia wartości w kluczach 'img'."""
    if isinstance(obj, dict):
        new_obj = {}
        for k, v in obj.items():
            if k == "img":
                filename = extract_filename_from_https(v)
                if filename is not None:
                    new_obj[k] = filename
                    changes_counter[0] += 1
                else:
                    new_obj[k] = walk_and_replace(v, changes_counter)
            else:
                new_obj[k] = walk_and_replace(v, changes_counter)
        return new_obj
    elif isinstance(obj, list):
        return [walk_and_replace(x, changes_counter) for x in obj]
    else:
        return obj

def main():
    # Ustalenie pliku wejściowego
    if len(sys.argv) > 1:
        in_path = Path(sys.argv[1])
        if not in_path.exists():
            print(f"Błąd: plik '{in_path}' nie istnieje.", file=sys.stderr)
            sys.exit(1)
    else:
        candidates = sorted(Path(".").glob("*.json"))
        if not candidates:
            print("Błąd: brak plików *.json w bieżącym katalogu. Podaj nazwę pliku jako argument.", file=sys.stderr)
            sys.exit(1)
        in_path = candidates[0]
        print(f"Nie podano pliku — używam: {in_path}")

    # Wczytanie JSON-a
    try:
        with open(in_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Błąd JSON: {e}", file=sys.stderr)
        sys.exit(1)

    # Przetwarzanie
    changes = [0]
    result = walk_and_replace(data, changes)

    # Zapis
    out_path = in_path.with_suffix("")  # usuń .json
    out_path = out_path.with_name(out_path.name + ".normalized.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=4)

    print(f"Zapisano: {out_path} (zmian: {changes[0]})")

if __name__ == "__main__":
    main()
