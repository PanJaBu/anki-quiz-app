import json

with open("data_ELM072.json") as f:
    try:
        json.load(f)
        print("✅ JSON is valid")
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")

