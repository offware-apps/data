# Format (v1)

All files are JSON under `/v1/`. Coordinates are WGS 84 decimal degrees. Countries are
ISO 3166-1 alpha-2 codes. In places and stations, coordinates are rounded to 5 places
(about 1 m) and every record carries its Wikidata id; `source` is the URL of that Wikidata
item, where its values come from and where an error can be corrected. The other datasets
keep the ids and rounding of their sources.

## `catalog.json`

Every dataset published here. `files` paths are relative to `baseUrl`; `sources` are ids
in `sources.json`.

```json
{
  "version": 1,
  "baseUrl": "https://offware-apps.github.io/data/v1",
  "updatedAt": "2026-10-12T03:00:00.000Z",
  "datasets": [
    { "id": "places", "name": "Towns, cities and sights", "description": "…", "license": "CC0-1.0",
      "sources": ["wikidata", "wikivoyage", "wikipedia"], "schedule": "weekly",
      "usedBy": ["postcards", "train-api"], "updatedAt": "2026-10-12T03:00:00.000Z", "records": 31250,
      "files": [{ "path": "places/index.json", "content": "every town and city, with the names it goes by" }] }
  ]
}
```

## `places/index.json`

```json
{
  "version": 1,
  "updatedAt": "2026-10-12T03:00:00.000Z",
  "source": "Wikidata",
  "license": "CC0-1.0",
  "attribution": "Data from Wikidata (CC0). …",
  "places": [
    { "id": "paris", "name": "Paris", "names": ["Paris", "Parigi", "Parijs"], "countryIso2": "FR",
      "wikidata": "Q90", "population": 2102650, "lat": 48.85694, "lon": 2.35139, "sights": 15 }
  ]
}
```

`names` holds the place's labels in English, French, German, Spanish, Italian, Dutch,
Portuguese, Catalan, Swedish, Norwegian, Danish, Finnish, Polish, Czech and Hungarian, for
matching names written in another language (a station called "Bruxelles-Midi", say).

`id` is stable: the largest place of a name keeps the plain slug; a smaller namesake gets
its country (`valence-fr`), then a number. `index`, `landmarks` and `pack` are never a
place's id, since those files share the folder.

## `places/<id>.json`

```json
{
  "id": "paris", "name": "Paris", "countryIso2": "FR", "wikidata": "Q90",
  "population": 2102650, "lat": 48.85694, "lon": 2.35139,
  "source": "https://www.wikidata.org/wiki/Q90",
  "links": {
    "wikivoyage": "https://en.wikivoyage.org/wiki/Paris",
    "wikipedia": "https://en.wikipedia.org/wiki/Paris",
    "website": "https://www.paris.fr/"
  },
  "sights": [
    { "wikidata": "Q2981", "source": "https://www.wikidata.org/wiki/Q2981", "name": "Notre-Dame de Paris",
      "category": "heritage site", "lat": 48.853, "lon": 2.3499, "unesco": true,
      "wikipedia": "https://en.wikipedia.org/wiki/Notre-Dame_de_Paris" }
  ]
}
```

Up to 15 sights: UNESCO World Heritage sites first, then the best known (by how many
Wikipedia editions have an article). `category` is one of museum, cathedral, church,
castle, palace, monument, park, garden, square, theatre, bridge or heritage site. Links
appear only when Wikidata has them.

## `places/landmarks.json`

Every sight except UNESCO sites, once each. `sitelinks` is how many Wikipedia editions
have an article on it, to keep the best known when a client needs fewer:

```json
[{ "id": "wd-Q243", "name": "Eiffel Tower", "countryIso2": "FR", "lat": 48.8584, "lon": 2.2945, "category": "monument", "sitelinks": 180 }]
```

## `stations/railways.json`

```json
{
  "_source": { "dataset": "…", "url": "https://www.wikidata.org", "license": "CC0-1.0",
               "retrieved": "2026-10-12", "note": "…", "coverage": "worldwide" },
  "stations": [{ "id": "Q745942", "name": "Paris Gare de Lyon", "countryIso2": "FR",
                 "subdivisionId": null, "lat": 48.8443, "lon": 2.3733 }]
}
```

Open mainline railway stations with coordinates and a UIC code or a Wikipedia (or other Wikimedia) page.
`id` is the station's Wikidata item.

## `places/pack.json`

The landmarks as a Postcards community data pack (`"format": "postcards-pack"`), at most
50,000 of them, the best known kept.

## `stations-europe/railways.json`

The same shape as `stations/railways.json`, with `"license": "ODbL-1.0"` and
`"coverage": "europe"`. Ids are `tl-` and Trainline's own id.

## `cities/top.json`, `cities/all.json`

The 10,000 most populous cities, and every city, most populous first. `id` is the GeoNames
id; `population` is null when GeoNames doesn't know it; `subdivisionId` is a region in
`regions/regions.json`, or null.

```json
[{ "id": "2988507", "name": "Paris", "countryIso2": "FR", "subdivisionId": "FR-11",
   "lat": 48.8534, "lon": 2.3488, "population": 2138551 }]
```

## `regions/regions.json`

```json
[{ "id": "FR-11", "countryIso2": "FR", "name": "Île-de-France" }]
```

## `airports/airports.json`

```json
[{ "id": "CDG", "name": "Charles de Gaulle International Airport", "city": "Paris",
   "countryIso2": "FR", "lat": 49.0128, "lon": 2.55 }]
```

## `heritage/unesco.json`

One entry per country a site is in; a site in several countries has the country code at
the end of its id. `lat` and `lon` are 0 when UNESCO gives no coordinates.

```json
[{ "id": "whs-paris-banks-of-the-seine", "name": "Paris, Banks of the Seine", "countryIso2": "FR",
   "lat": 48.8655, "lon": 2.3211, "category": "cultural" }]
```

## `countries/*.json`

Objects keyed by ISO 3166-1 alpha-2 code: `names.json` and `article-names.json`
(`"RU": "Russia"`), `continents.json` (`"FR": "Europe"`), `languages.json`
(`"FR": [{ "code": "fra", "name": "French" }]`) and `sovereignty.json` (`"un"` or
`"territory"`).

## `moments/moments.json`

Postcards' moments: `{ name, version, license, note, experiences: [...] }`, each
experience citing its own `sources`.

## `sources.json`

Every source, its licence, what is taken from it, and the `attribution` its licence asks
an app to show.
