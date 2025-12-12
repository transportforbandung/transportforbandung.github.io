import requests
import json
import time
import os
from datetime import datetime

# Bounding box for Greater Bandung
BBOX = "-7.119970883040842,107.29935103886602,-6.7164372353137045,108.00522056337834"

# Function to query Overpass API with rate limiting
def fetch_overpass(query, retries=3, delay=2):
    base_url = "https://overpass-api.de/api/interpreter"
    
    for attempt in range(1, retries + 1):
        try:
            response = requests.post(base_url, data=query, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if response.status_code == 429:  # Rate limit
                wait_time = delay * (2 ** attempt)  # Exponential backoff
                print(f"Rate limited. Waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            if attempt == retries:
                raise
            print(f"HTTP error (attempt {attempt}/{retries}): {e}")
            time.sleep(delay * attempt)
        except requests.RequestException as e:
            if attempt == retries:
                raise
            print(f"Request error (attempt {attempt}/{retries}): {e}")
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

# FIXED: Fetch all bus routes in one query, then match locally
def fetch_all_bus_routes_and_match():
    """Fetch all bus routes in the area once, then match to stops locally"""
    print("Fetching all bus routes in the area...")
    
    # First, get all bus routes in the bounding box
    query = f"""
    [out:json][timeout:180];
    (
      relation["type"="route"]["route"="bus"]({BBOX});
    );
    out body;
    """
    
    try:
        data = fetch_overpass(query)
        routes = data.get("elements", [])
        print(f"Found {len(routes)} bus routes")
        
        # Create a mapping of node_id -> list of route_ids
        node_to_routes = {}
        
        for route in routes:
            if route["type"] != "relation":
                continue
                
            route_id = route["id"]
            # Look for node members in this route
            for member in route.get("members", []):
                if member["type"] == "node":
                    member_role = member.get("role", "")
                    # FIX: Include ALL platform roles including entry/exit
                    if member_role in ["", "stop", "platform", "platform_entry_only", "platform_exit_only"]:
                        node_id = member["ref"]
                        if node_id not in node_to_routes:
                            node_to_routes[node_id] = []
                        if route_id not in node_to_routes[node_id]:  # Avoid duplicates
                            node_to_routes[node_id].append(route_id)
        
        return node_to_routes
        
    except Exception as e:
        print(f"Error fetching routes: {e}")
        return {}

# FIXED: Fetch routes in a smarter way with batch queries
def fetch_routes_for_nodes_smart(node_ids):
    """Fetch routes for nodes using smarter batching to avoid rate limits"""
    import concurrent.futures
    
    node_routes = {}
    
    # Group nodes into batches of 10
    batches = [node_ids[i:i+10] for i in range(0, len(node_ids), 10)]
    print(f"Processing {len(batches)} batches of up to 10 nodes each")
    
    def fetch_batch(batch_nodes):
        try:
            # Create a query for multiple nodes at once
            node_list = ",".join(str(node_id) for node_id in batch_nodes)
            query = f"""
            [out:json][timeout:60];
            node(id:{node_list});
            rel(bn)["type"="route"]["route"="bus"];
            out body;
            """
            
            data = fetch_overpass(query)
            
            # Initialize all nodes in batch with empty routes
            batch_result = {}
            for node_id in batch_nodes:
                batch_result[node_id] = []
            
            # Parse relations and check member roles
            for element in data.get("elements", []):
                if element["type"] == "relation" and "members" in element:
                    relation_id = element["id"]
                    # Check each member for platform roles
                    for member in element["members"]:
                        if member["type"] == "node":
                            member_role = member.get("role", "")
                            # FIX: Include ALL platform roles
                            if member_role in ["", "stop", "platform", "platform_entry_only", "platform_exit_only"]:
                                node_id = member["ref"]
                                if node_id in batch_nodes and relation_id not in batch_result[node_id]:
                                    batch_result[node_id].append(relation_id)
            
            return batch_result
            
        except Exception as e:
            print(f"Error fetching batch: {e}")
            # Return empty routes for this batch
            return {node_id: [] for node_id in batch_nodes}
    
    # Use ThreadPoolExecutor but with max 2 workers and delays
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = []
        
        for i, batch in enumerate(batches):
            # Add delay between submitting batches
            if i > 0:
                time.sleep(5)  # 5 second delay between batch submissions
            
            future = executor.submit(fetch_batch, batch)
            futures.append(future)
            print(f"Submitted batch {i+1}/{len(batches)}")
        
        # Collect results
        for future in concurrent.futures.as_completed(futures):
            batch_result = future.result()
            node_routes.update(batch_result)
    
    return node_routes

# ORIGINAL SIMPLE APPROACH - Most accurate
def fetch_routes_original_approach(node_ids):
    """Original approach: fetch routes for each node individually with threading"""
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
            routes = []
            # Check member roles in each relation
            for element in data.get("elements", []):
                if element["type"] == "relation" and "members" in element:
                    # Check if this node is a member with any platform role
                    for member in element["members"]:
                        if member["type"] == "node" and member["ref"] == node_id:
                            member_role = member.get("role", "")
                            # Include ALL platform roles
                            if member_role in ["", "stop", "platform", "platform_entry_only", "platform_exit_only"]:
                                routes.append(element["id"])
                                break  # Found this node in relation
            return (node_id, routes)
        except Exception as e:
            print(f"Error fetching routes for node {node_id}: {e}")
            return (node_id, [])
    
    # Use threading to speed up individual requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
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
    # Create output directory
    OUTPUT_DIR = "route-data/bus-stop"
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Created output directory: {OUTPUT_DIR}")
    start_time = time.time()
    
    # Fetch all bus stops
    print("Step 1: Fetching bus stops...")
    all_stops = fetch_all_bus_stops()
    
    if not all_stops:
        print("No bus stops found!")
        return
    
    # Extract node IDs
    node_ids = [stop["id"] for stop in all_stops if stop["type"] == "node"]
    print(f"Step 2: Processing {len(node_ids)} bus stops...")
    
    # CHOOSE ONE APPROACH FOR FETCHING ROUTES:
    
    # Option A: Fetch all routes once and match locally (FASTEST) - FIXED
    print("Step 3: Fetching route associations (bulk method)...")
    node_routes = fetch_all_bus_routes_and_match()
    
    # Option B: Use smart batching (slower but more accurate) - FIXED
    # print("Step 3: Fetching route associations (batched method)...")
    # node_routes = fetch_routes_for_nodes_smart(node_ids)
    
    # Option C: Original individual approach (most accurate) - FIXED
    # print("Step 3: Fetching route associations (original method)...")
    # node_routes = fetch_routes_original_approach(node_ids)
    
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
                "route_count": len(node_routes.get(stop["id"], [])),
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
    
    end_time = time.time()
    elapsed = end_time - start_time
    
    print(f" Saved {len(features)} stops to {output_path}")
    print(f"  Total execution time: {elapsed:.2f} seconds ({elapsed/60:.1f} minutes)")
    
    # Print summary
    stops_with_routes = sum(1 for f in features if f["properties"]["route_count"] > 0)
    print(f" Summary:")
    print(f"  Total stops: {len(features)}")
    print(f"  Stops with routes: {stops_with_routes} ({stops_with_routes/len(features)*100:.1f}%)")
    print(f"  Total route associations: {sum(len(f['properties']['routes']) for f in features)}")
    
    if elapsed > 480:  # 8 minutes
        print("  Warning: Script took more than 8 minutes. Consider:")
        print("  1. Using the bulk route fetching method (Option A)")
        print("  2. Reducing the bounding box size")

if __name__ == "__main__":
    print("Starting bus stop extraction script...")
    try:
        main()
    except KeyboardInterrupt:
        print("  Script interrupted by user")
    except Exception as e:
        print(f" Script failed: {e}")
        import traceback
        traceback.print_exc()
