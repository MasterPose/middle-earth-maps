# About the data

The original data source was the 3rd age of [kwoxer/Arda-Maps](https://github.com/kwoxer/Arda-Maps).

The project has modified the original geo data to include regions, places and potentially fix mistakes.

- The ARCGIS files are on `resources/geo/` and then the exported GEOJSONS are placed under `resources/geojson/`.
- The CSV and GEOJSON data gets indexed and transformed to JSON and compressed using `bin/generatePlaceDatabase.js`. The transformed files are placed under `public/data/`.
