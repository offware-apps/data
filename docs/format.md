# Format (v1)

All files are JSON under `/v1/`. Coordinates are WGS 84 decimal degrees, rounded to 5
places (about 1 m). Countries are ISO 3166-1 alpha-2 codes. Every record carries its
Wikidata id; `source` is the URL of that Wikidata item, where its values come from and
where an error can be corrected.

## `index.json`

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
its country (`valence-fr`), then a number.

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

## `landmarks.json`

Every sight except UNESCO sites, once each:

```json
[{ "id": "wd-Q243", "name": "Eiffel Tower", "countryIso2": "FR", "lat": 48.8584, "lon": 2.2945, "category": "monument" }]
```

## `stations.json`

```json
{
  "_source": { "dataset": "…", "url": "https://www.wikidata.org", "license": "CC0-1.0",
               "retrieved": "2026-10-12", "note": "…", "coverage": "worldwide" },
  "stations": [{ "id": "Q745942", "name": "Paris Gare de Lyon", "countryIso2": "FR",
                 "subdivisionId": null, "lat": 48.8443, "lon": 2.3733 }]
}
```

Open mainline railway stations with coordinates and a UIC code or a Wikipedia article.
`id` is the station's Wikidata item.

## `pack.json`

The landmarks as a Postcards community data pack (`"format": "postcards-pack"`), at most
50,000 of them, the best known kept.

## `sources.json`

Every source, its licence and what is taken from it.
