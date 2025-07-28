import json
import os
import geopandas as gpd
from shapely.geometry import shape

def sanitize_filename(name):
    # Remove or replace unsafe characters, keep dash and space
    return "".join([c if c.isalnum() or c in (' ', '-', '–') else '_' for c in name]).strip()

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, '..', 'route-data')
    route_data_dir = os.path.join(data_dir, 'geojson')
    routes_json_path = os.path.join(data_dir, 'routes.json')
    output_dir = os.path.join(data_dir, 'shp-named-ungrouped')
    os.makedirs(output_dir, exist_ok=True)

    with open(routes_json_path, 'r') as f:
        routes_data = json.load(f)

    for category in routes_data['categories']:
        for route in category['routes']:
            relation_id = route['relationId']
            route_name = route['name']
            color = route['color']
            route_dir = os.path.join(route_data_dir, relation_id)

            if not os.path.exists(route_dir):
                print(f"Skipping missing directory: {route_dir}")
                continue

            # Process only LineString and MultiLineString features
            line_features = []

            for filename in os.listdir(route_dir):
                if filename.endswith('.geojson'):
                    with open(os.path.join(route_dir, filename)) as f:
                        data = json.load(f)
                        features = data['features'] if data['type'] == 'FeatureCollection' else [data]

                        for feature in features:
                            geom = feature['geometry']
                            if geom['type'] not in ['LineString', 'MultiLineString']:
                                continue  # Skip anything not a line

                            feature['geometry'] = shape(geom)
                            props = feature['properties']
                            props.update({
                                "route_name": route_name,
                                "color": color,
                                "source": "Transport for Bandung"
                            })
                            line_features.append(feature)

            # Save to a single SHP file per route
            if line_features:
                gdf = gpd.GeoDataFrame.from_features(line_features)
                gdf.crs = 'EPSG:4326'
                filename_base = sanitize_filename(route_name.replace(":", " -"))
                output_path = os.path.join(output_dir, f"{filename_base}.shp")
                gdf.to_file(output_path)
                print(f"Saved: {output_path}")

if __name__ == '__main__':
    main()
