/**
 * v1/sources.json: every source a dataset takes values from, its licence, what is taken,
 * and the credit its licence asks for. A share-alike source (ODbL, CC BY-SA) keeps its
 * licence on every dataset built from it: see `license` in catalog.json.
 */
export interface Source {
  id: string;
  name: string;
  url: string;
  license: string;
  licenseUrl: string;
  use: string;
  /** The credit to show wherever the data is used. */
  attribution?: string;
  /** Where an error is corrected. */
  fix?: string;
}

const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";
const ODBL = "https://opendatacommons.org/licenses/odbl/1-0/";

export const SOURCES: Source[] = [
  {
    id: "wikidata",
    name: "Wikidata",
    url: "https://www.wikidata.org",
    license: "CC0-1.0",
    licenseUrl: CC0,
    use: "Every name, population, coordinate, category and UNESCO flag in places and stations, and the guide links.",
    fix: "Each record's `source` is its Wikidata item: correct an error there and it reaches this dataset on the next weekly build.",
  },
  {
    id: "wikivoyage",
    name: "Wikivoyage",
    url: "https://en.wikivoyage.org",
    license: "CC-BY-SA-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    use: "Links to guide articles, and the travel topics some moments are drawn from. No article text is copied.",
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    url: "https://en.wikipedia.org",
    license: "CC-BY-SA-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    use: "Links to articles only. No article text is copied.",
  },
  {
    id: "geonames",
    name: "GeoNames",
    url: "https://www.geonames.org",
    license: "CC-BY-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    use: "Every city of 1,000 people or more, each city's first-level region code and each code's name. Checked for changes monthly.",
    attribution: "Contains data from GeoNames (https://www.geonames.org), CC BY 4.0.",
    fix: "Errors are corrected on geonames.org.",
  },
  {
    id: "dr5hn",
    name: "countries-states-cities database (dr5hn)",
    url: "https://github.com/dr5hn/countries-states-cities-database",
    license: "ODbL-1.0",
    licenseUrl: ODBL,
    use: "The name of a region GeoNames gives a code but no name, matched by nearest centroid.",
    attribution: "Contains information from the countries-states-cities database, made available under the ODbL.",
  },
  {
    id: "openflights",
    name: "OpenFlights airports",
    url: "https://openflights.org/data.html",
    license: "ODbL-1.0",
    licenseUrl: ODBL,
    use: "Every airport with an IATA code (by way of the airport-data package). OpenFlights aggregates OurAirports, which is public domain.",
    attribution: "Contains information from OpenFlights (https://openflights.org/data.html), made available under the ODbL.",
  },
  {
    id: "unesco-whc",
    name: "UNESCO World Heritage List",
    url: "https://whc.unesco.org/en/list/",
    license: "CC-BY-SA-3.0-IGO",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/igo/",
    use: "Every World Heritage site: name, countries, coordinates and category. Checked for changes weekly. Some moments are drawn from it.",
    attribution: "© UNESCO World Heritage Centre (https://whc.unesco.org), CC BY-SA 3.0 IGO.",
  },
  {
    id: "unesco-ich",
    name: "UNESCO Intangible Cultural Heritage lists",
    url: "https://ich.unesco.org/en/lists",
    license: "CC-BY-SA-3.0-IGO",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/igo/",
    use: "The traditions some moments are drawn from; each such moment cites its element.",
    attribution: "© UNESCO (https://ich.unesco.org), CC BY-SA 3.0 IGO.",
  },
  {
    id: "trainline",
    name: "Trainline EU open stations database",
    url: "https://github.com/trainline-eu/stations",
    license: "ODbL-1.0",
    licenseUrl: ODBL,
    use: "European railway stations: name, country and coordinates.",
    attribution: "Contains information from the Trainline EU stations database (https://github.com/trainline-eu/stations), made available under the ODbL.",
    fix: "Errors are corrected in trainline-eu/stations.",
  },
  {
    id: "world-countries",
    name: "mledoze/countries",
    url: "https://github.com/mledoze/countries",
    license: "ODbL-1.0",
    licenseUrl: ODBL,
    use: "Each country's common name, region, languages and UN membership. Checked for changes weekly.",
    attribution: "Contains information from mledoze/countries (https://github.com/mledoze/countries), made available under the ODbL.",
  },
  {
    id: "iso-3166",
    name: "ISO 3166-1 country codes (via i18n-iso-countries)",
    url: "https://github.com/michaelwittig/node-i18n-iso-countries",
    license: "MIT",
    licenseUrl: "https://github.com/michaelwittig/node-i18n-iso-countries/blob/master/LICENSE",
    use: "The list of country codes. The codes themselves are public facts.",
  },
];
