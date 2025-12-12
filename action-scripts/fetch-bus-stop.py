import requests
import json
import time
import os

# Bounding box for Greater Bandung
BBOX = "-7.119970883040842,107.29935103886602,-6.7164372353137045,108.00522056337834"

# Function to query Overpass API
def fetch_overpass(query, retries=3, delay=2):
    base_url = "https://overpass-api.de/api/interpreter"
    
    for attempt in range(1, retries + 1):
        try:
            response = requests.post(base_url, data=query, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            if attempt == retries:
                raise
            print(f"Overpass error (attempt {attempt}/{retries}): {e}")
            time.sleep(delay * attempt)

# Fetch all bus stops in single query
def fetch_all_bus_stops():
    print("Fetching all bus stops in the area...")
    
    query = f"""
    [out:json][timeout:180];
    (
      node["highway"="bus_stop"]({BBOX});
    );
    out body;
    """
    
    data = fetch_overpass(query)
    print(f"Found {len(data.get('elements', []))} total bus stops")
    return data.get("elements", [])

# Simple approach for fetching routes
def fetch_routes_for_nodes(node_ids, max_workers=3):
    """Fetch routes for nodes with simple sequential requests"""
    import concurrent.futures
    
    node_routes = {}
    
    def fetch_single_node(node_id):
        try:
            query = f"""
            [out:json][timeout:30];
            node({node_id});
            rel(bn)["type"="route"]["route"="bus"];
            out body;
            """
            data = fetch_overpass(query)
            routes = [el["id"] for el in data.get("elements", []) if el["type"] == "relation"]
            return (node_id, routes)
        except Exception as e:
            print(f"Error fetching routes for node {node_id}: {e}")
            return (node_id, [])
    
    # Use ThreadPoolExecutor for parallel requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(fetch_single_node, node_id) for node_id in node_ids]
        
        for future in concurrent.futures.as_completed(futures):
            node_id, routes = future.result()
            node_routes[node_id] = routes
    
    return node_routes

# Function to determine category
def get_stop_category(shelter, pole):
    shelter_str = str(shelter).lower() if shelter is not None else "no"
    
    if shelter_str == "yes":
        if pole is None or pole == "":
            return "1_shelter_yes_pole_none"
        elif any(val in str(pole).lower() for val in ["yes", "traffic_sign"]):
            return "5_shelter_yes_pole_sign"
        elif "totem" in str(pole).lower():
            return "6_shelter_yes_pole_totem"
        elif "flag" in str(pole).lower():
            return "7_shelter_yes_pole_flag"
        else:
            return "1_shelter_yes_pole_none"
    else:
        if any(val in str(pole).lower() for val in ["yes", "traffic_sign"]):
            return "2_shelter_none_pole_sign"
        elif "totem" in str(pole).lower():
            return "3_shelter_none_pole_totem"
        elif "flag" in str(pole).lower():
            return "4_shelter_none_pole_flag"
        else:
            return "8_shelter_none_pole_none"

def main():
    # Create output directory INSIDE main()
    OUTPUT_DIR = "route-data/bus-stop"
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Created output directory: {OUTPUT_DIR}")
    
    # Fetch all bus stops
    print("Step 1: Fetching bus stops...")
    all_stops = fetch_all_bus_stops()
    
    if not all_stops:
        print("No bus stops found!")
        return
    
    # Extract node IDs
    node_ids = [stop["id"] for stop in all_stops if stop["type"] == "node"]
    print(f"Step 2: Processing {len(node_ids)} bus stops...")
    
    # Fetch routes
    print("Step 3: Fetching route associations...")
    node_routes = fetch_routes_for_nodes(node_ids, max_workers=3)
    
    # Process and save
    print("Step 4: Creating GeoJSON...")
    features = []
    
    for stop in all_stops:
        if stop["type"] != "node":
            continue
            
        tags = stop.get("tags", {})
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [stop["lon"], stop["lat"]]
            },
            "properties": {
                "id": stop["id"],
                "name": tags.get("name"),
                "shelter": tags.get("shelter"),
                "pole": tags.get("pole"),
                "lit": tags.get("lit"),
                "bench": tags.get("bench"),
                "bin": tags.get("bin"),
                "routes": node_routes.get(stop["id"], []),
                "category": get_stop_category(tags.get("shelter"), tags.get("pole"))
            }
        }
        features.append(feature)
    
    # Save to file
    output_path = f"{OUTPUT_DIR}/all_bus_stops.geojson"
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Saved {len(features)} stops to {output_path}")
    
    # Print summary
    stops_with_routes = sum(1 for f in features if len(f["properties"]["routes"]) > 0)
    print(f"\n📊 Summary:")
    print(f"  Total stops: {len(features)}")
    print(f"  Stops with routes: {stops_with_routes}")
    print(f"  Route associations: {sum(len(f['properties']['routes']) for f in features)}")

# This is the key fix - Only run main() if the script is executed directly
if __name__ == "__main__":
    print("Starting bus stop extraction script...")
    start_time = time.time()
    main()
    end_time = time.time()
    print(f"\n⏱️  Total execution time: {end_time - start_time:.2f} seconds")
