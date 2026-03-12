# About the data

The original data source was the 3rd age of [kwoxer/Arda-Maps](https://github.com/kwoxer/Arda-Maps).

The project has modified the original geo data to include regions, places and potentially fix mistakes.

- The layers are exported to `public/data/` as GEOJSON.
- The CSV gets converted to JSON using `bin/generatePlaceDatabase.js` and placed on `public/db.json`.
