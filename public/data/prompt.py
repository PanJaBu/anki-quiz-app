import os
import re
import json
# from openai import OpenAI

from pathlib import Path
from docx import Document

def normalize(text):
    return " ".join(text.replace("\u00A0", " ").split())

def sanitize_filename(nazwa: str) -> str:
    nazwa = nazwa.replace("\u00A0", " ").strip()
    nazwa = re.sub(r'[<>:"/\\|?*\n\r\t]', '', nazwa)
    return re.sub(r'\s+', '_', nazwa)

def normalize_requirements(text: str) -> str:
    text = text.replace("\u00A0", " ").replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in text.split("\n")]

    normalized_lines = []
    current = ""

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith("-"):
            if current:
                normalized_lines.append(current)
            current = stripped
        elif current:
            current = f"{current} {stripped}"
        else:
            current = stripped

    if current:
        normalized_lines.append(current)

    return "\n".join(normalized_lines)

def extract_requirements(text: str) -> list[str]:
    normalized_text = normalize_requirements(text)
    requirements = []

    for line in normalized_text.split("\n"):
        stripped = line.strip()
        if not stripped.startswith("-"):
            continue
        requirement = normalize(stripped)
        if requirement:
            requirements.append(requirement)

    return requirements

def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[idx:idx + size] for idx in range(0, len(items), size)]

def format_requirements_block(title: str, requirements: list[str]) -> str:
    return f"{title}:\n" + "\n".join(requirements)

# Ustaw klucz API
print("prompt START\n")
# api_key = os.getenv("OPENAI_API_KEY")
# if not api_key:
#    raise ValueError("Ustaw zmienną środowiskową OPENAI_API_KEY z kluczem API.")
# print("OPENAI_API_KEY ustawiona\n")
# client = OpenAI(api_key=api_key)

# Wczytaj dokument DOCX
document = Document("technik-robotyk.docx")
wszystkie_odpowiedzi = []
tab_idx = 0

for table in document.tables:
    tab_idx += 1
    header_cells = table.rows[0].cells
    headers = [normalize(cell.text) for cell in header_cells]

    if "Tematy jednostek metodycznych" not in headers:
        continue

    try:
        temat_idx = headers.index("Tematy jednostek metodycznych")
        dzial_idx = headers.index("Dział programowy Liczba godzin")

        requirement_indices = [idx for idx, header in enumerate(headers) if header == "Wymagania programowe"]
        if len(requirement_indices) < 2:
            raise ValueError

        podst_idx, pond_idx = requirement_indices[:2]
    except ValueError:
        print(f"⚠️ Brakuje wymaganych kolumn w tabeli {tab_idx}.")
        continue

    katalog = Path(f"{tab_idx}_prompty")
    katalog.mkdir(parents=True, exist_ok=True)

    for row in table.rows[1:]:
        cells = row.cells
        temat = cells[temat_idx].text.strip()
        podst = cells[podst_idx].text.strip()
        pond = cells[pond_idx].text.strip()
        dzial = cells[dzial_idx].text.strip()

        if not temat or not dzial or normalize(dzial) == "Dział programowy Liczba godzin":
            continue

        nazwa = f"{sanitize_filename(dzial)}_{sanitize_filename(temat)}"
        podstawowe = extract_requirements(podst)
        ponadpodstawowe = extract_requirements(pond)

        requirement_blocks = []

        for chunk in chunked(podstawowe, 3):
            requirement_blocks.append(format_requirements_block("Podstawowe wymagania programowe", chunk))

        for chunk in chunked(ponadpodstawowe, 3):
            requirement_blocks.append(format_requirements_block("Ponadpodstawowe wymagania programowe", chunk))

        if not requirement_blocks:
            continue

        system_prompt = (
           "Jesteś ekspertem z zakresu automatyki przemysłowej, robotyki, systemów sterowania oraz programowania PLC, "
           "specjalizującym się w kwalifikacjach zawodowych ELM.07 (Montaż i uruchamianie urządzeń i systemów automatyki przemysłowej) "
           "oraz ELM.08 (Eksploatacja i programowanie urządzeń i systemów automatyki przemysłowej). "
           "Znasz obowiązujące normy bezpieczeństwa (w tym PN-EN ISO 12100, PN-EN ISO 13849, PN-EN 60204-1), "
           "a także stosowane rozwiązania praktyczne w przemyśle 4.0, systemach SCADA, układach bezpieczeństwa, sieciach przemysłowych (PROFINET, AS-i, Modbus RTU) "
           "oraz sterownikach PLC (np. Siemens S7-1200, S7-1500). "
           "Twoim zadaniem jest tworzenie profesjonalnych pytań testowych jednokrotnego wyboru (w formacie JSON), zgodnych z wymaganiami podstawy programowej MEN "
           "dla technika robotyka, z uwzględnieniem kontekstu praktycznego oraz zasad BHP. "
            "Pytania powinny sprawdzać wiedzę ucznia zgodnie z zakresem: diagnozowanie, montaż, uruchamianie, obsługa oraz programowanie urządzeń automatyki i robotyki. "
            "Stosuj język techniczny, poprawny merytorycznie, jasny i precyzyjny. Odpowiedzi formatuj wyłącznie w formacie JSON."
         )

        for fragment_idx, requirements_block in enumerate(requirement_blocks, start=1):
            plik_prompt = katalog / f"{nazwa}_{fragment_idx}.txt"
            plik_response = katalog / f"{nazwa}_{fragment_idx}_RESPONSE.json"

            prompt = f"""Dla każdego z wymagań programowych z tematu: {temat} przygotuj po 5 pytań dla poszczególnych wymagań sprawdzających wiadomości nabyte przez ucznia.
{requirements_block}

Zawsze generuj pełny, poprawnie sformatowany JSON. Nie dodawaj komentarzy, tekstu wokół ani formatowania Markdown.
Kolejne pytania oddzielaj przecinkami.
Pole correct pokazuje która opcja jest poprawna. Umieszczaj poprawne odpowiedzi w opcji a.
Jeśli pytanie dotyczy obrazka w nazwie napisz umieść opis co na nim ma być (tag img).
W przypadku gdy "a." jest poprawna correct przyjmuje wartość "1 0 0 0", dla "b." wartość "0 1 0 0", dla "c." wartość "0 0 1 0", dla "d." wartość "0 0 0 1"

Struktura JSON:
{{
    "img": "",
    "question": "Wybierz odpowiedź",
    "a.": "Pierwsza opcja.",
    "img_a": "",
    "b.": "Druga opcja.",
    "img_b": "",
    "c.": "Trzecia opcja.",
    "img_c": "",
    "d.": "Czwarta opcja.",
    "img_d": "",
    "explanation": "Tu opisuje poprawną odpowiedz nie wskazujac jej wprost.\\nOpisuje dodatkowe informacje związane z opcjom.",
    "correct": "1 0 0 0"
}}
"""

            with open(plik_prompt, "w", encoding="utf-8") as f:
                f.write(prompt)
            print(f"✅ Prompt zapisany: {plik_prompt.name}")

#       response = client.chat.completions.create(model="gpt-4o",
#        messages=[{"role": "system", "content": system_prompt},{"role": "user", "content": prompt}],
#        max_tokens=8000,
#        temperature=0.7)
#        result = response.choices[0].message.content
#        usage = response.usage
#        print(f"📊 Zużycie tokenów: prompt={usage.prompt_tokens}, completion={usage.completion_tokens}, total={usage.total_tokens}")
#
#        with open(plik_response, "w", encoding="utf-8") as f:
#            f.write(result)
#        print(f"✅ Response zapisany: {plik_response.name}")
#
#        try:
#            pytania = json.loads(result)
#            wszystkie_odpowiedzi.extend(pytania)
#        except json.JSONDecodeError:
#            print(f"❌ Błąd dekodowania JSON w {plik_response.name}:\n{result[:300]}...\n")
#
#    pytania_anki_plik = katalog / f"anki_tabela{tab_idx}.json"
#    with open(pytania_anki_plik, "w", encoding="utf-8") as f:
#        json.dump(wszystkie_odpowiedzi, f, ensure_ascii=False, indent=2)
#    print(f"📄 Zapisano pytania dla ANKI z tabeli {tab_idx} do pliku: {pytania_anki_plik.name}")
