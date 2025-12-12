import requests
import json
import time
import os

# Bounding box for Greater Bandung
BBOX = "-7.119970883040842,107.29935103886602,-6.7164372353137045,108.00522056337834"
OUTPUT_DIR = "route-data/bus-stop"
os.makedirs(OUTPUT_DIR, exist_ok=True)

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

# CORRECTED: Batch fetch routes for multiple nodes at once
def fetch_routes_for_nodes_batch(node_ids, batch_size=30):
    """Fetch routes for multiple nodes in a single Overpass query"""
    if not node_ids:
        return {}
    
    # Create batches to avoid query size limits
    batches = [node_ids[i:i + batch_size] for i in range(0, len(node_ids), batch_size)]
    node_routes = {}
    
    for i, batch in enumerate(batches):
        print(f"Processing batch {i+1}/{len(batches)} with {len(batch)} nodes...")
        
        # Create query for this batch - INCLUDING ALL PLATFORM ROLES
        node_list = ",".join(map(str, batch))
        query = f"""
        [out:json][timeout:120];
        node(id:{node_list});
        rel(bn)["type"="route"]["route"="bus"];
        out body;
        """
        
        try:
            data = fetch_overpass(query)
            
            # Initialize all nodes with empty routes
            for node_id in batch:
                node_routes[node_id] = []
            
            # Parse relations and find which nodes they contain
            # INCLUDING ALL PLATFORM ROLES
            for element in data.get("elements", []):
                if element["type"] == "relation" and "members" in element:
                    relation_id = element["id"]
                    # Find all node members in this relation with ANY platform role
                    for member in element["members"]:
                        if member["type"] == "node":
                            member_role = member.get("role", "")
                            # Include ALL platform roles
                            if member_role in ["", "stop", "platform", "platform_entry_only", "platform_exit_only"]:
                                node_id = member["ref"]
                                if node_id in batch and relation_id not in node_routes[node_id]:
                                    node_routes[node_id].append(relation_id)
            
            # Small delay between batches
            if i < len(batches) - 1:
                time.sleep(3)
                
        except Exception as e:
            print(f"Error processing batch {i+1}: {e}")
            # Mark all nodes in this batch as failed
            for node_id in batch:
                node_routes[node_id] = []
    
    return node_routes

# SIMPLE APPROACH - Fetch routes for each node individually
def fetch_routes_simple_approach(node_ids):
    """Simpler approach: fetch routes for each node individually but with threading"""
    import concurrent.futures
    
    node_routes = {}
    
    def fetch_single_node(node_id):
        try:
            query = f"""
            [out:json][timeout:25];
            node({node_id});
            rel(bn)["type"="route"]["route"="bus"];
            out body;
            """
            data = fetch_overpass(query)
            routes = []
            # Parse relations and check member roles
            for element in data.get("elements", []):
                if element["type"] == "relation" and "members" in element:
                    # Check if this node is a member with any platform role
                    for member in element["members"]:
                        if (member["type"] == "node" and member["ref"] == node_id):
                            member_role = member.get("role", "")
                            # Include ALL platform roles
                            if member_role in ["", "stop", "platform", "platform_entry_only", "platform_exit_only"]:
                                routes.append(element["id"])
                                break  # Found this node in relation, move to next relation
            
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

# Function to determine category based on shelter and pole
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
    # Fetch all bus stops
    all_stops = fetch_all_bus_stops()
    
    # Extract node IDs for batch processing
    node_ids = [stop["id"] for stop in all_stops if stop["type"] == "node"]
    print(f"Processing {len(node_ids)} bus stop nodes...")
    
    # CHOOSE ONE APPROACH:
    
    # Option A: Use simpler threaded approach (recommended for accuracy)
    print("Fetching route relations using threaded approach...")
    node_routes = fetch_routes_simple_approach(node_ids)
    
    # Option B: Use batch approach (more complex but fewer API calls)
    # print("Fetching route relations in batches...")
    # node_routes = fetch_routes_for_nodes_batch(node_ids)
    
    # Process stops and create features
    features = []
    processed_count = 0
    
    for stop in all_stops:
        if stop["type"] != "node":
            continue
            
        tags = stop.get("tags", {})
        shelter = tags.get("shelter")
        pole = tags.get("pole")
        
        # Get routes from results
        route_ids = node_routes.get(stop["id"], [])
        
        # Determine category
        category = get_stop_category(shelter, pole)
        
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
                "lit": tags.get("lit"),
                "bench": tags.get("bench"),
                "bin": tags.get("bin"),
                "routes": route_ids,
                "route_count": len(route_ids),
                "category": category
            }
        }
        features.append(feature)
        
        processed_count += 1
        if processed_count % 100 == 0:
            print(f"Processed {processed_count}/{len(node_ids)} stops")
    
    # Create single combined GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    # Write file
    output_path = f"{OUTPUT_DIR}/all_bus_stops.geojson"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Saved {len(features)} stops to {output_path}")
    
    # Print summary with route statistics
    category_counts = {}
    stops_with_routes = 0
    total_routes = 0
    
    for feature in features:
        cat = feature["properties"]["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1
        
        route_count = len(feature["properties"]["routes"])
        if route_count > 0:
            stops_with_routes += 1
            total_routes += route_count
    
    print("\n📊 Category breakdown:")
    for cat, count in sorted(category_counts.items()):
        print(f"  {cat}: {count} stops")
    
    print(f"\n🛣️  Route statistics:")
    print(f"  Stops with route data: {stops_with_routes}/{len(features)}")
    print(f"  Total route associations: {total_routes}")
    if stops_with_routes > 0:
        print(f"  Average routes per stop: {total_routes/stops_with_routes:.1f}")

if __name__ == "__main__":
    start_time = time.time()
    main()
    end_time = time.time()
    print(f"\n⏱️  Total execution time: {end_time - start_time:.2f} seconds")
