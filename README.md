# data

The open data every Offware app reads, in one place: towns and cities worldwide with their
sights and links to free travel guides, railway stations, cities, regions, airports, UNESCO
World Heritage sites, countries and Postcards' moments. Built from open sources by GitHub
Actions and served as static JSON on GitHub Pages, with no server, no key and no cost.

[train-api](https://github.com/offware-apps/train-api) links its stations to these places,
and [Postcards](https://github.com/offware-apps/Postcards) reads every other dataset.

Live at <https://offware-apps.github.io/data/v1/catalog.json> once Pages is on
(Settings → Pages → Source: GitHub Actions).

## What's in it

`v1/catalog.json` lists every dataset: what it holds, its sources and licence, when it was
built, how many records it has and which apps read it.

| Dataset | Files | What it holds |
| --- | --- | --- |
| places | `v1/places/index.json` | Every town and city: id, names in 15 languages, country, population, coordinates |
| | `v1/places/<id>.json` | One town or city: links to Wikivoyage, Wikipedia and its website, and up to 15 sights |
| | `v1/places/landmarks.json` | Every sight except UNESCO World Heritage sites, in Postcards' landmark shape |
| | `v1/places/pack.json` | The sights as a Postcards community data pack |
| stations | `v1/stations/railways.json` | Open railway stations worldwide, in Postcards' station shape |
| stations-europe | `v1/stations-europe/railways.json` | About 70,000 European stations from Trainline, same shape |
| cities | `v1/cities/top.json`, `v1/cities/all.json` | The 10,000 most populous cities, and all 135,000 |
| regions | `v1/regions/regions.json` | First-level regions (states, provinces, régions) with their names |
| airports | `v1/airports/airports.json` | Every airport with an IATA code |
| heritage | `v1/heritage/unesco.json` | Every UNESCO World Heritage site, once per country |
| countries | `v1/countries/*.json` | Common names, continents, languages and UN membership |
| moments | `v1/moments/moments.json` | Postcards' travel experiences, each citing its sources |
| all | `v1/sources.json` | Every source, its licence and the credit it asks for |

Towns are kept from 5,000 people in Europe and from 15,000 elsewhere. The format is in
[docs/format.md](docs/format.md).

## Sources and licences

Each dataset keeps the licence of what it is built from, given as `license` in
`catalog.json`. A share-alike licence (ODbL, CC BY-SA) carries over to the dataset, and
an app showing the data shows the source's `attribution` from `sources.json`.

| Dataset | Licence | Source |
| --- | --- | --- |
| places, stations | CC0 1.0 | Wikidata |
| stations-europe | ODbL 1.0 | [Trainline EU stations](https://github.com/trainline-eu/stations) |
| cities | CC BY 4.0 | [GeoNames](https://www.geonames.org), by way of all-the-cities |
| regions | ODbL 1.0 | GeoNames, and [dr5hn countries-states-cities](https://github.com/dr5hn/countries-states-cities-database) for a few names |
| airports | ODbL 1.0 | [OpenFlights](https://openflights.org/data.html) (from OurAirports, public domain) |
| heritage | CC BY-SA 3.0 IGO | [UNESCO World Heritage Centre](https://whc.unesco.org/en/list/) |
| countries | ODbL 1.0 | [mledoze/countries](https://github.com/mledoze/countries), ISO 3166-1 codes |
| moments | Each item cites its sources | Written for Postcards (CC0), drawn from Wikidata, GeoNames, UNESCO and Wikivoyage |

The vendored source files are in `data/reference/`: GeoNames' admin-1 names and city codes
(export of 2026-09-30), UNESCO's list (retrieved 2026-07-11) and the moments.

- **Wikidata (CC0).** Every name, population, coordinate, category and UNESCO flag comes
  from Wikidata. CC0 asks for nothing, but every record still names its source: its
  `source` field is its Wikidata item.
- **Wikivoyage and Wikipedia (CC BY-SA 4.0).** Only links to their articles are
  published. No article text is copied, so nothing here is under their licence.

**Found an error?** Fix it at the source. Each record's `source` link opens its
Wikidata item, which anyone can edit, and the fix reaches this repository on the next weekly
build. Corrections are never made in this repository.

## Develop

```sh
npm ci
npm run check                               # typecheck + tests
npm run build -- tests/fixtures/raw.json    # build from the fixture (add --offline to skip Trainline)
npm run fetch -- LU MC                      # fetch two countries (needs query.wikidata.org)
npm run build
```

Code: AGPL-3.0. Data: each dataset under its source's licence, as above.
