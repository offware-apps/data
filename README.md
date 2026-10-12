# data

The open data every Offware app reads, in one place: towns and cities worldwide with their
sights and links to free travel guides, and railway stations worldwide. Built from open
sources by GitHub Actions and served as static JSON on GitHub Pages, with no server, no key
and no cost.

[train-api](https://github.com/offware-apps/train-api) links its stations to these places,
and [Postcards](https://github.com/offware-apps/Postcards) reads the sights and stations.

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
| all | `v1/sources.json` | Every source and its licence |

Towns are kept from 5,000 people in Europe and from 15,000 elsewhere. The format is in
[docs/format.md](docs/format.md).

## Sources and licences

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
npm run build -- tests/fixtures/raw.json    # build from the fixture
npm run fetch -- LU MC                      # fetch two countries (needs query.wikidata.org)
npm run build
```

Code: AGPL-3.0. Data: CC0 1.0, from Wikidata.
