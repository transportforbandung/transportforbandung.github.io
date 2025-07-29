import json
import os
import geopandas as gpd
from shapely.geometry import shape

def sanitize_filename(name):
    return "".join([c if c.isalnum() or c in (' ', '-', '–') else '-' for c in name]).strip()

def write_qml(path, color_hex, stroke_width=0.86):
    with open(path, 'w') as f:
        f.write(f"""<?xml version="1.0" encoding="UTF-8"?>
<qgis styleCategories="Symbology" version="3.16">
  <renderer-v2 type="singleSymbol">
    <symbol type="line" name="">
      <layer pass="0" class="SimpleLine">
        <prop k="color" v="{color_hex}"/>
        <prop k="width" v="{stroke_width}"/>
        <prop k="capstyle" v="square"/>
        <prop k="joinstyle" v="miter"/>
      </layer>
    </symbol>
  </renderer-v2>
  <layerGeometryType>1</layerGeometryType>
</qgis>""")

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
            color = route['color'].lstrip('#')
            color_hex = f"#{color.upper()}"
            route_dir = os.path.join(route_data_dir, relation_id)

            if not os.path.exists(route_dir):
                print(f"Skipping missing directory: {route_dir}")
                continue

            # Process only LineString and MultiLineString
            line_features = []

            for filename in os.listdir(route_dir):
                if filename.endswith('.geojson'):
                    with open(os.path.join(route_dir, filename)) as f:
                        data = json.load(f)
                        features = data['features'] if data['type'] == 'FeatureCollection' else [data]

                        for feature in features:
                            geom = feature['geometry']
                            if geom['type'] not in ['LineString', 'MultiLineString']:
                                continue

                            feature['geometry'] = shape(geom)
                            props = feature['properties']
                            props.update({
                                "route_name": route_name,
                                "color": color_hex,
                                "source": "Transport for Bandung"
                            })
                            line_features.append(feature)

            # Save to SHP and matching QML
            if line_features:
                gdf = gpd.GeoDataFrame.from_features(line_features)
                gdf.crs = 'EPSG:4326'

                filename_base = sanitize_filename(route_name.replace(":", " -"))
                shapefile_path = os.path.join(output_dir, f"{filename_base}.shp")
                qml_path = os.path.join(output_dir, f"{filename_base}.qml")

                gdf.to_file(shapefile_path)
                write_qml(qml_path, color_hex)

                print(f"Saved: {shapefile_path}")
                print(f"Style: {qml_path}")

if __name__ == '__main__':
    main()
