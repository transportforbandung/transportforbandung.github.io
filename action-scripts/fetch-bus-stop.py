import requests
import json
import time
import os
import math
import threading
from datetime import datetime
from queue import Queue

# Bounding box for Greater Bandung
BBOX = "-7.119970883040842,107.29935103886602,-6.7164372353137045,108.00522056337834"

# Thread-safe rate limiter class
class RateLimiter:
    def __init__(self, min_interval=5):
        self.min_interval = min_interval
        self.last_request_time = 0
        self.lock = threading.Lock()
    
    def wait_if_needed(self):
        with self.lock:
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            
            if time_since_last < self.min_interval:
                sleep_time = self.min_interval - time_since_last
                if sleep_time > 0.1:  # Only log if significant wait
                    print(f"Rate limiter: Waiting {sleep_time:.1f} seconds...")
                time.sleep(sleep_time)
            
            self.last_request_time = time.time()

# Create a global rate limiter instance
rate_limiter = RateLimiter(min_interval=5)

# Alternative servers
ALTERNATIVE_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]

def fetch_overpass(query, retries=5, delay=10):
    """Query Overpass API with exponential backoff and server rotation"""
    
    for attempt in range(1, retries + 1):
        # Rate limit BEFORE making the request
        rate_limiter.wait_if_needed()
        
        # Rotate servers to spread load
        server_idx = (attempt - 1) % len(ALTERNATIVE_SERVERS)
        base_url = ALTERNATIVE_SERVERS[server_idx]
        server_name = base_url.split('/')[2]
        
        try:
            if attempt == 1:
                print(f"  Request to {server_name}...")
            
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
                print(f"  Rate limited by {server_name}. Waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            elif response.status_code == 504:
                # Gateway timeout
                print(f"  Gateway timeout from {server_name}, retrying...")
                time.sleep(delay)
                continue
            else:
                response.raise_for_status()
                
        except requests.exceptions.RequestException as e:
            print(f"  Request error (attempt {attempt}/{retries}): {e}")
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

# Better sequential approach with progress
def fetch_routes_sequential_safe(node_ids):
    """Fetch routes sequentially - most reliable for rate limiting"""
    node_routes = {}
    total = len(node_ids)
    
    print(f"Fetching routes for {total} nodes sequentially...")
    print("This will take approximately {} minutes".format(math.ceil(total * 5 / 60)))
    
    for i, node_id in enumerate(node_ids, 1):
        # Progress indicator
        if i % 10 == 0 or i == total:
            print(f"Progress: {i}/{total} ({i/total*100:.1f}%)")
        
        try:
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
            
            # Additional delay every 50 requests
            if i % 50 == 0 and i < total:
                print("  Taking a 30-second pause...")
                time.sleep(30)
            
        except Exception as e:
            print(f"Error for node {node_id}: {e}")
            node_routes[node_id] = []
            
            # Longer delay on error
            print("  Pausing 15 seconds after error...")
            time.sleep(15)
    
    return node_routes

# Thread-safe batch processing
def fetch_routes_batched_safe(node_ids, batch_size=20):
    """Process nodes in batches with controlled concurrency"""
    import concurrent.futures
    
    node_routes = {}
    total = len(node_ids)
    batches = [node_ids[i:i + batch_size] for i in range(0, total, batch_size)]
    
    print(f"Processing {len(batches)} batches of up to {batch_size} nodes each")
    
    # Use a queue to process batches sequentially
    for batch_idx, batch in enumerate(batches, 1):
        print(f"\nBatch {batch_idx}/{len(batches)}: {len(batch)} nodes")
        
        batch_results = {}
        
        # Process this batch sequentially within the batch
        for i, node_id in enumerate(batch, 1):
            print(f"  Node {i}/{len(batch)} in batch...")
            
            try:
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
                
                batch_results[node_id] = routes
                
            except Exception as e:
                print(f"  Error for node {node_id}: {e}")
                batch_results[node_id] = []
        
        # Add batch results to main dict
        node_routes.update(batch_results)
        
        # Delay between batches
        if batch_idx < len(batches):
            batch_delay = 30
            print(f"  Waiting {batch_delay} seconds before next batch...")
            time.sleep(batch_delay)
    
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
    print("Bus Stop Extractor - Rate Limited Version")
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Create output directory
    OUTPUT_DIR = "route-data/bus-stop"
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Output directory: {OUTPUT_DIR}")
    
    total_start = time.time()
    
    # Step 1: Fetch bus stops
    print("\n[1/4] Fetching bus stops...")
    start_time = time.time()
    all_stops = fetch_all_bus_stops()
    stop_fetch_time = time.time() - start_time
    
    if not all_stops:
        print("No bus stops found!")
        return
    
    # Extract node IDs
    node_ids = [stop["id"] for stop in all_stops if stop["type"] == "node"]
    print(f"\n[2/4] Found {len(node_ids)} bus stop nodes")
    
    # Step 2: Fetch routes
    print("\n[3/4] Fetching route associations...")
    print("Using sequential method for maximum reliability")
    
    route_start = time.time()
    
    # CHOOSE METHOD:
    # Method 1: Pure sequential (safest)
    # node_routes = fetch_routes_sequential_safe(node_ids)
    
    # Method 2: Batched sequential (good balance)
    node_routes = fetch_routes_batched_safe(node_ids, batch_size=10)
    
    route_fetch_time = time.time() - route_start
    
    # Step 3: Process and save
    print("\n[4/4] Creating GeoJSON...")
    
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
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = f"{OUTPUT_DIR}/bus_stops_{timestamp}.geojson"
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "type": "FeatureCollection",
            "features": features
        }, f, ensure_ascii=False, indent=2)
    
    # Summary
    total_time = time.time() - total_start
    stops_with_routes = sum(1 for f in features if f["properties"]["route_count"] > 0)
    
    print(f"  Extraction complete!")
    print(f"  Output: {output_path}")
    print(f"  Total time: {total_time/60:.1f} minutes")
    print(f"  Stops with routes: {stops_with_routes}/{len(features)}")

if __name__ == "__main__":
    main()
