import requests
import json
import time
import os
import math
from datetime import datetime

# Bounding box for Greater Bandung
BBOX = "-7.119970883040842,107.29935103886602,-6.7164372353137045,108.00522056337834"

# Overpass API settings
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# Alternative servers if main one fails
ALTERNATIVE_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]

# Rate limiting
LAST_REQUEST_TIME = 0
MIN_REQUEST_INTERVAL = 5  # Minimum 5 seconds between requests

def fetch_overpass(query, retries=5, delay=10):
    """Query Overpass API with exponential backoff and server rotation"""
    global LAST_REQUEST_TIME
    
    # Rate limiting between all requests
    current_time = time.time()
    time_since_last = current_time - LAST_REQUEST_TIME
    if time_since_last < MIN_REQUEST_INTERVAL:
        sleep_time = MIN_REQUEST_INTERVAL - time_since_last
        time.sleep(sleep_time)
    
    for attempt in range(1, retries + 1):
        # Rotate servers to spread load
        server_idx = (attempt - 1) % len(ALTERNATIVE_SERVERS)
        base_url = ALTERNATIVE_SERVERS[server_idx]
        
        try:
            print(f"Attempt {attempt}/{retries} on server {base_url.split('/')[2]}...")
            LAST_REQUEST_TIME = time.time()
            
            response = requests.post(
                base_url,
                data={'data': query},
                timeout=60,
                headers={
                    'User-Agent': 'BusStopFetcher/1.0',
                    'Accept': 'application/json'
                }
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                # Rate limited - exponential backoff
                wait_time = delay * (2 ** attempt)
                print(f"Rate limited. Waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            elif response.status_code == 504:
                # Gateway timeout
                print(f"Gateway timeout, retrying in {delay} seconds...")
                time.sleep(delay)
                continue
            else:
                response.raise_for_status()
                
        except requests.exceptions.RequestException as e:
            print(f"Request error (attempt {attempt}/{retries}): {e}")
            if attempt == retries:
                raise
            
            # Exponential backoff
            wait_time = delay * (2 ** attempt)
            time.sleep(wait_time)
    
    raise Exception(f"Failed after {retries} retries")

# Fetch all bus stops
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
    elements = data.get('elements', [])
    print(f"Found {len(elements)} total bus stops")
    return elements

# Enhanced individual node route fetching with progress tracking
def fetch_routes_for_nodes_individual(node_ids, max_workers=2, batch_size=1):
    """Fetch routes for each node individually with proper rate limiting"""
    import concurrent.futures
    import threading
    
    node_routes = {}
    completed_count = 0
    total_count = len(node_ids)
    lock = threading.Lock()
    
    def update_progress():
        nonlocal completed_count
        with lock:
            completed_count += 1
            if completed_count % 10 == 0 or completed_count == total_count:
                print(f"Progress: {completed_count}/{total_count} ({completed_count/total_count*100:.1f}%)")
    
    def fetch_single_node_with_delay(node_id, delay_multiplier=1):
        """Fetch routes for a single node with delay"""
        try:
            # Add delay based on request count
            time.sleep(2 * delay_multiplier)
            
            query = f"""
            [out:json][timeout:30];
            node({node_id});
            rel(bn)["type"="route"]["route"="bus"];
            out body;
            """
            
            data = fetch_overpass(query)
            routes = []
            
            # Parse relations
            for element in data.get("elements", []):
                if element["type"] == "relation":
                    routes.append(element["id"])
            
            update_progress()
            return (node_id, routes)
            
        except Exception as e:
            print(f"Error fetching routes for node {node_id}: {e}")
            update_progress()
            return (node_id, [])
    
    # Group nodes by area to potentially find patterns
    print(f"Fetching routes for {total_count} nodes...")
    print(f"Using {max_workers} workers with {batch_size} nodes per batch")
    
    # Process in batches with delays between batches
    batches = [node_ids[i:i + batch_size] for i in range(0, len(node_ids), batch_size)]
    
    for batch_idx, batch in enumerate(batches):
        print(f"Processing batch {batch_idx + 1}/{len(batches)}")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = []
            
            for i, node_id in enumerate(batch):
                # Stagger start times
                initial_delay = i * 0.5
                future = executor.submit(fetch_single_node_with_delay, node_id, batch_idx + 1)
                futures.append(future)
            
            # Wait for all in batch to complete
            for future in concurrent.futures.as_completed(futures):
                node_id, routes = future.result()
                node_routes[node_id] = routes
        
        # Longer delay between batches
        if batch_idx < len(batches) - 1:
            batch_delay = 10  # 10 seconds between batches
            print(f"Batch completed. Waiting {batch_delay} seconds before next batch...")
            time.sleep(batch_delay)
    
    return node_routes

# Alternative: Sequential with intelligent delay
def fetch_routes_sequential(node_ids):
    """Fetch routes sequentially with intelligent delay management"""
    node_routes = {}
    total = len(node_ids)
    
    for i, node_id in enumerate(node_ids, 1):
        if i % 20 == 0:
            print(f"Progress: {i}/{total} ({i/total*100:.1f}%)")
        
        try:
            # Dynamic delay based on progress
            base_delay = 3
            if i % 50 == 0:
                # Longer pause every 50 requests
                print("Taking a longer pause to respect rate limits...")
                time.sleep(30)
            
            query = f"""
            [out:json][timeout:25];
            node({node_id});
            rel(bn)["type"="route"]["route"="bus"];
            out body;
            """
            
            data = fetch_overpass(query)
            routes = []
            
            for element in data.get("elements", []):
                if element["type"] == "relation":
                    routes.append(element["id"])
            
            node_routes[node_id] = routes
            
            # Short delay between requests
            if i < total:
                time.sleep(base_delay)
                
        except Exception as e:
            print(f"Error for node {node_id}: {e}")
            node_routes[node_id] = []
            
            # Longer delay on error
            time.sleep(10)
    
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
    print("=" * 60)
    print("Bus Stop Extractor - Individual Node Method")
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Create output directory
    OUTPUT_DIR = "route-data/bus-stop"
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Output directory: {OUTPUT_DIR}")
    
    # Timer
    total_start = time.time()
    
    # Step 1: Fetch bus stops
    print("\n[1/4] Fetching bus stops...")
    start_time = time.time()
    all_stops = fetch_all_bus_stops()
    stop_fetch_time = time.time() - start_time
    print(f"  Time: {stop_fetch_time:.1f} seconds")
    
    if not all_stops:
        print("No bus stops found!")
        return
    
    # Extract node IDs
    node_ids = [stop["id"] for stop in all_stops if stop["type"] == "node"]
    print(f"\n[2/4] Processing {len(node_ids)} bus stops...")
    
    # Step 2: Fetch routes (choose method)
    print("\n[3/4] Fetching route associations...")
    print("Using individual node method for accuracy")
    
    route_start = time.time()
    
    # CHOOSE YOUR METHOD:
    # Method A: Threaded with rate limiting (faster but riskier)
    # node_routes = fetch_routes_for_nodes_individual(node_ids, max_workers=2, batch_size=10)
    
    # Method B: Sequential (slower but safest)
    node_routes = fetch_routes_sequential(node_ids)
    
    route_fetch_time = time.time() - route_start
    print(f"  Route fetching time: {route_fetch_time:.1f} seconds ({route_fetch_time/60:.1f} minutes)")
    
    # Step 3: Process and save
    print("\n[4/4] Creating GeoJSON...")
    
    features = []
    route_stats = {}
    
    for stop in all_stops:
        if stop["type"] != "node":
            continue
            
        tags = stop.get("tags", {})
        stop_id = stop["id"]
        
        # Get routes
        routes = node_routes.get(stop_id, [])
        
        # Track route statistics
        for route_id in routes:
            route_stats[route_id] = route_stats.get(route_id, 0) + 1
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [stop["lon"], stop["lat"]]
            },
            "properties": {
                "id": stop_id,
                "name": tags.get("name"),
                "shelter": tags.get("shelter"),
                "pole": tags.get("pole"),
                "lit": tags.get("lit"),
                "bench": tags.get("bench"),
                "bin": tags.get("bin"),
                "routes": routes,
                "route_count": len(routes),
                "category": get_stop_category(tags.get("shelter"), tags.get("pole"))
            }
        }
        features.append(feature)
    
    # Save to file with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = f"{OUTPUT_DIR}/bus_stops_{timestamp}.geojson"
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    # Create a symlink to the latest file
    latest_path = f"{OUTPUT_DIR}/all_bus_stops.geojson"
    if os.path.exists(latest_path):
        os.remove(latest_path)
    os.symlink(f"bus_stops_{timestamp}.geojson", latest_path)
    
    # Print comprehensive summary
    total_time = time.time() - total_start
    stops_with_routes = sum(1 for f in features if f["properties"]["route_count"] > 0)
    total_routes = sum(f["properties"]["route_count"] for f in features)
    unique_routes = len(route_stats)
    
    print("\n" + "=" * 60)
    print(" EXTRACTION COMPLETE")
    print("=" * 60)
    print(f" Output file: {output_path}")
    print(f" Total time: {total_time:.1f} seconds ({total_time/60:.1f} minutes)")
    
    print(f"\n📈 Statistics:")
    print(f"  Total bus stops: {len(features)}")
    print(f"  Stops with routes: {stops_with_routes} ({stops_with_routes/len(features)*100:.1f}%)")
    print(f"  Total route associations: {total_routes}")
    print(f"  Unique bus routes found: {unique_routes}")
    
    if stops_with_routes > 0:
        print(f"  Average routes per stop: {total_routes/stops_with_routes:.2f}")
    
    # Route distribution
    print(f"  Route distribution:")
    route_counts = {}
    for f in features:
        count = f["properties"]["route_count"]
        route_counts[count] = route_counts.get(count, 0) + 1
    
    for count in sorted(route_counts.keys()):
        percentage = route_counts[count] / len(features) * 100
        print(f"  {count} route(s): {route_counts[count]} stops ({percentage:.1f}%)")
    
    # Time breakdown
    print(f"  Time breakdown:")
    print(f"  Bus stop fetching: {stop_fetch_time:.1f}s ({stop_fetch_time/total_time*100:.1f}%)")
    print(f"  Route fetching: {route_fetch_time:.1f}s ({route_fetch_time/total_time*100:.1f}%)")
    print(f"  Processing: {total_time - stop_fetch_time - route_fetch_time:.1f}s")
    
    print(f" Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("  Script interrupted by user")
    except Exception as e:
        print(f" Script failed with error: {e}")
        import traceback
        traceback.print_exc()
