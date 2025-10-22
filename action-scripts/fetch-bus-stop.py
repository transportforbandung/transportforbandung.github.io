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

# Main processing
def main():
    # Fetch all bus stops first
    all_stops = fetch_all_bus_stops()
    print(f"Found {len(all_stops)} total bus stops")
    
    # Categorize stops by shelter and pole combinations
    categorized = {
        "1_shelter_yes_pole_none": [],
        "2_shelter_none_pole_sign": [],
        "3_shelter_none_pole_totem": [],
        "4_shelter_none_pole_flag": [],
        "5_shelter_yes_pole_sign": [],
        "6_shelter_yes_pole_totem": [],
        "7_shelter_yes_pole_flag": [],
        "8_shelter_none_pole_none": []
    }
    
    # Process each stop and categorize
    for i, stop in enumerate(all_stops):
        if stop["type"] != "node":
            continue
            
        tags = stop.get("tags", {})
        shelter = tags.get("shelter")
        pole = tags.get("pole")
        
        # Categorize based on shelter and pole values
        if shelter == "yes":
            if pole is None or pole == "":
                categorized["1_shelter_yes_pole_none"].append(stop)
            elif pole in ["yes", "traffic_sign"]:
                categorized["5_shelter_yes_pole_sign"].append(stop)
            elif "totem" in pole:
                categorized["6_shelter_yes_pole_totem"].append(stop)
            elif "flag" in pole:
                categorized["7_shelter_yes_pole_flag"].append(stop)
        else:  # shelter is no, or not present
            if pole in ["yes", "traffic_sign"]:
                categorized["2_shelter_none_pole_sign"].append(stop)
            elif "totem" in pole:
                categorized["3_shelter_none_pole_totem"].append(stop)
            elif "flag" in pole:
                categorized["4_shelter_none_pole_flag"].append(stop)
            else:
                categorized["8_shelter_none_pole_none"].append(stop)
    
    # Generate GeoJSON files for each category
    for category_name, stops in categorized.items():
        print(f"Processing {category_name} with {len(stops)} stops...")
        
        features = []
        
        for i, stop in enumerate(stops):
            node_id = stop["id"]
            lat, lon = stop["lat"], stop["lon"]
            tags = stop.get("tags", {})
            
            # Fetch related bus route IDs
            route_ids = fetch_relations_for_node(node_id)
            
            # Small delay to be respectful to the API
            if i % 10 == 0 and i > 0:
                time.sleep(0.5)
            
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]
                },
                "properties": {
                    "id": node_id,
                    "name": tags.get("name"),
                    "shelter": tags.get("shelter"),
                    "pole": tags.get("pole"),
                    "routes": route_ids
                }
            }
            features.append(feature)
        
        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        
        output_path = f"{OUTPUT_DIR}/{category_name}.geojson"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)
        
        print(f"Saved {len(features)} stops to {output_path}\n")

if __name__ == "__main__":
    main()
