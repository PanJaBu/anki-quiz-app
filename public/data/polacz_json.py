import os
import json

def merge_robotics_json_files(target_folder=None):
    directory_mapping = {
        "2_prompty": "2_Podstawy_robotyki",
        "3_prompty": "3_Technologie_i_konstrukcje_mechaniczne_w_robotyce",
        "4_prompty": "4_Zapis_konstrukcji",
        "5_prompty": "5_Elektrotechnika_i_elektronika_w_robotyce",
        "6_prompty": "6_Podstawy_programowania_robotow",
        "7_prompty": "7_Komputerowe_wspomaganie_w_robotyce",
        "8_prompty": "8_Pracownia_elektryczna_i_elektroniczna",
        "9_prompty": "9_Pracownia_systemow_robotyki",
        "10_prompty": "10_Pracownia_programowania_i_eksploatacji_robotow_przemyslowych",
        "11_prompty": "11_Projektowanie_ukladow_sterowania_robotow",
        "12_prompty": "12_Pracownia_pneumatyki_i_hydrauliki",
        "13_prompty": "13_Diagnozowanie_i_konserwacja_systemow_robotyki"
    }

    if target_folder:
        if target_folder in directory_mapping:
            items_to_process = {target_folder: directory_mapping[target_folder]}
        else:
            print(f"Błąd: Folder '{target_folder}' nie istnieje na liście.")
            return
    else:
        items_to_process = directory_mapping

    for dir_name, output_filename in items_to_process.items():
        dir_path = os.path.join(".", dir_name)
        if not os.path.exists(dir_path):
            continue

        merged_data = []
        json_files = [f for f in os.listdir(dir_path) if f.endswith('.json')]
        
        if not json_files:
            print(f"Brak plików JSON w {dir_name}")
            continue

        for file_name in json_files:
            file_path = os.path.join(dir_path, file_name)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        merged_data.extend(data)
                    else:
                        merged_data.append(data)
            except Exception as e:
                print(f"Błąd w {file_name}: {e}")

        with open(f"{output_filename}.json", 'w', encoding='utf-8') as out_f:
            json.dump(merged_data, out_f, ensure_ascii=False, indent=2)
        print(f"Zakończono: {output_filename}.json")

if __name__ == "__main__":
    print("Dostępne opcje:")
    print("0 - Wszystkie foldery")
    print("2-13 - Konkretny numer folderu (np. wpisz '2' dla 2_prompty)")
    
    wybor = input("\nPodaj numer (lub Enter dla wszystkich): ").strip()
    
    if wybor == "0" or wybor == "":
        merge_robotics_json_files()
    else:
        folder_name = f"{wybor}_prompty"
        merge_robotics_json_files(folder_name)
