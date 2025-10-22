import requests
import json
import time
import os

# Bounding box for Greater Bandung
BBOX = "-7.119970883040842,107.29935103886602,-6.7164372353137045,108.00522056337834"

# Output folder
OUTPUT_DIR = "route-data/bus-stop"

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Function to query Overpass API
def fetch_overpass(query, retries=3, delay=5):
    base_url = "https://overpass-api.de/api/interpreter"
    
    for attempt in range(1, retries + 1):
        try:
            response = requests.post(base_url, data=query, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            if attempt == retries:
                print(f"Final Overpass error: {e}")
                print(f"Query was: {query}")
                raise
            print(f"Overpass error (attempt {attempt}/{retries}): {e}")
            time.sleep(delay * attempt)

# Function to fetch all bus stops in the bounding box
def fetch_all_bus_stops():
    print("Fetching all bus stops in the area...")
    
    # Simple query to get all bus stops
    query = f"""
    [out:json][timeout:90];
    (
      node["highway"="bus_stop"]({BBOX});
    );
    out body;
    """
    
    data = fetch_overpass(query)
    return data.get("elements", [])

# Function to fetch route relation IDs for a bus stop node
def fetch_relations_for_node(node_id):
    query = f'[out:json][timeout:25];node({node_id});rel(bn)["type"="route"]["route"="bus"];out ids;'
    try:
        data = fetch_overpass(query)
        return [el["id"] for el in data.get("elements", []) if el["type"] == "relation"]
    except Exception as e:
        print(f"Failed to fetch relations for node {node_id}: {e}")
        return []

# Safe function to check pole values
def check_pole_value(pole, values):
    if pole is None:
        return False
    pole_str = str(pole).lower()
    for value in values:
        if value in pole_str:
            return True
    return False

# Function to determine category based on shelter and pole
def get_stop_category(shelter, pole):
    shelter_str = str(shelter).lower() if shelter is not None else "no"
    
    if shelter_str == "yes":
        if pole is None or pole == "":
            return "1_shelter_yes_pole_none"
        elif check_pole_value(pole, ["yes", "traffic_sign"]):
            return "5_shelter_yes_pole_sign"
        elif check_pole_value(pole, ["totem"]):
            return "6_shelter_yes_pole_totem"
        elif check_pole_value(pole, ["flag"]):
            return "7_shelter_yes_pole_flag"
        else:
            return "1_shelter_yes_pole_none"
    else:  # shelter is no, or not present
        if check_pole_value(pole, ["yes", "traffic_sign"]):
            return "2_shelter_none_pole_sign"
        elif check_pole_value(pole, ["totem"]):
            return "3_shelter_none_pole_totem"
        elif check_pole_value(pole, ["flag"]):
            return "4_shelter_none_pole_flag"
        else:
            return "8_shelter_none_pole_none"

# Main processing
def main():
    # Fetch all bus stops first
    all_stops = fetch_all_bus_stops()
    print(f"Found {len(all_stops)} total bus stops")
    
    features = []
    
    # Process each stop
    for i, stop in enumerate(all_stops):
        if stop["type"] != "node":
            continue
            
        tags = stop.get("tags", {})
        shelter = tags.get("shelter")
        pole = tags.get("pole")
        
        # Determine category
        category = get_stop_category(shelter, pole)
        
        # Fetch related bus route IDs
        route_ids = fetch_relations_for_node(stop["id"])
        
        # Small delay to be respectful to the API
        if i % 10 == 0 and i > 0:
            time.sleep(0.5)
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [stop["lon"], stop["lat"]]
            },
            "properties": {
                "id": stop["id"],
                "name": tags.get("name"),
                "shelter": shelter,
                "pole": pole,
                "routes": route_ids,
                "category": category  # This is the key addition!
            }
        }
        features.append(feature)
    
    # Create single combined GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    # Write single combined file
    output_path = f"{OUTPUT_DIR}/all_bus_stops.geojson"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    print(f"Saved {len(features)} stops to {output_path}")
    
    # Optional: Also write summary by category
    category_counts = {}
    for feature in features:
        cat = feature["properties"]["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    print("\nCategory breakdown:")
    for cat, count in category_counts.items():
        print(f"  {cat}: {count} stops")

if __name__ == "__main__":
    main()
