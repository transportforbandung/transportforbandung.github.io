import requests
import json
import time

# Bounding box for Greater Bandung
BBOX = "-7.119970883040842,107.29935103886602,-6.7164372353137045,108.00522056337834"

# Output folder
OUTPUT_DIR = "route-data/bus-stop"

# 8 combinations for Overpass filtering - FIXED SYNTAX
COMBINATIONS = {
    "1_shelter_yes_pole_none": '(node["highway"="bus_stop"]["shelter"="yes"]["pole"!~".*"]({bbox});)',
    "2_shelter_none_pole_sign": '(node["highway"="bus_stop"]["shelter"!~".*"]["pole"~"^(yes|traffic_sign)$"]({bbox});)',
    "3_shelter_none_pole_totem": '(node["highway"="bus_stop"]["shelter"!~".*"]["pole"~"^(totem|totem;traffic_sign|traffic_sign;totem)$"]({bbox});)',
    "4_shelter_none_pole_flag": '(node["highway"="bus_stop"]["shelter"!~".*"]["pole"~"^(flag|flag;traffic_sign|traffic_sign;flag)$"]({bbox});)',
    "5_shelter_yes_pole_sign": '(node["highway"="bus_stop"]["shelter"="yes"]["pole"~"^(yes|traffic_sign)$"]({bbox});)',
    "6_shelter_yes_pole_totem": '(node["highway"="bus_stop"]["shelter"="yes"]["pole"~"^(totem|totem;traffic_sign|traffic_sign;totem)$"]({bbox});)',
    "7_shelter_yes_pole_flag": '(node["highway"="bus_stop"]["shelter"="yes"]["pole"~"^(flag|flag;traffic_sign|traffic_sign;flag)$"]({bbox});)',
    "8_shelter_none_pole_none": '(node["highway"="bus_stop"]["shelter"!~".*"]["pole"!~".*"]({bbox});)'
}

# Function to query Overpass API - IMPROVED WITH POST REQUEST
def fetch_overpass(query, retries=3, delay=5):
    base_url = "https://overpass-api.de/api/interpreter"
    
    for attempt in range(1, retries + 1):
        try:
            # Use POST instead of GET to avoid URL length issues
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

# Function to fetch route relation IDs for a bus stop node
def fetch_relations_for_node(node_id):
    query = f'[out:json][timeout:25];node({node_id})->.stop;relation(bn.stop)["type"="route"]["route"="bus"];out ids;'
    try:
        data = fetch_overpass(query)
        return [el["id"] for el in data.get("elements", []) if el["type"] == "relation"]
    except Exception as e:
        print(f"Failed to fetch relations for node {node_id}: {e}")
        return []

# Create output directory if it doesn't exist
import os
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Main loop
for name, node_filter in COMBINATIONS.items():
    print(f"Fetching {name}...")

    overpass_query = (
        f"[out:json][timeout:90];\n"
        f"{node_filter.replace('{bbox}', BBOX)}\n"
        "out body geom;"
    )

    try:
        data = fetch_overpass(overpass_query)
        elements = data.get("elements", [])
        features = []

        print(f"Found {len(elements)} nodes for {name}")

        for i, el in enumerate(elements):
            if el["type"] != "node":
                continue

            node_id = el["id"]
            lat, lon = el["lat"], el["lon"]
            tags = el.get("tags", {})

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

        output_path = f"{OUTPUT_DIR}/{name}.geojson"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)

        print(f"Saved {len(features)} stops to {output_path}\n")

    except Exception as e:
        print(f"Failed to process {name}: {e}")
        continue
