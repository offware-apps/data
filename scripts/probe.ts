// Temporary: checks why some countries come back with few or no towns.
const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "offware-data/0.1 (https://github.com/offware-apps/data)";
const Q: [string, string][] = [
  ["NL holders of P297", `SELECT ?c ?cLabel WHERE { ?c wdt:P297 "NL" . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`],
  ["Amsterdam P17/P31", `SELECT ?p17 ?p31 WHERE { wd:Q727 wdt:P17 ?p17 . OPTIONAL { wd:Q727 wdt:P31 ?p31 } }`],
  ["Utrecht station P17", `SELECT ?p17 WHERE { wd:Q1022934 wdt:P17 ?p17 }`],
  ["NL pop>=5000 by P17", `SELECT ?country (COUNT(DISTINCT ?city) AS ?n) WHERE { VALUES ?country { wd:Q55 wd:Q29999 } ?city wdt:P17 ?country ; wdt:P1082 ?p . FILTER(?p >= 5000) } GROUP BY ?country`],
  ["Kingdom P297", `SELECT ?v WHERE { wd:Q29999 wdt:P297 ?v }`],
  ["class paths", `SELECT ?cls ?settlement ?municipality WHERE { VALUES ?cls { wd:Q484170 wd:Q747074 wd:Q2039348 wd:Q15284 wd:Q2074737 wd:Q1529096 wd:Q262166 } BIND(EXISTS { ?cls wdt:P279* wd:Q486972 } AS ?settlement) BIND(EXISTS { ?cls wdt:P279* wd:Q15284 } AS ?municipality) }`],
  ["FR communes >=5000", `SELECT (COUNT(DISTINCT ?c) AS ?n) (COUNT(DISTINCT ?s) AS ?settled) WHERE { ?c wdt:P31 wd:Q484170 ; wdt:P1082 ?p . FILTER(?p >= 5000) OPTIONAL { ?c wdt:P31 ?cls . ?cls wdt:P279* wd:Q486972 . BIND(?c AS ?s) } }`],
  ["IT comuni >=5000", `SELECT (COUNT(DISTINCT ?c) AS ?n) (COUNT(DISTINCT ?s) AS ?settled) WHERE { ?c wdt:P31 wd:Q747074 ; wdt:P1082 ?p . FILTER(?p >= 5000) OPTIONAL { ?c wdt:P31 ?cls . ?cls wdt:P279* wd:Q486972 . BIND(?c AS ?s) } }`],
  ["TR pop>=5000 classes", `SELECT ?cls ?clsLabel (COUNT(DISTINCT ?c) AS ?n) WHERE { ?country wdt:P297 "TR" . ?c wdt:P17 ?country ; wdt:P1082 ?p ; wdt:P31 ?cls . FILTER(?p >= 5000) SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?cls ?clsLabel ORDER BY DESC(?n) LIMIT 25`],
  ["FR pop>=5000 classes", `SELECT ?cls ?clsLabel (COUNT(DISTINCT ?c) AS ?n) WHERE { ?c wdt:P17 wd:Q142 ; wdt:P1082 ?p ; wdt:P31 ?cls . FILTER(?p >= 5000) SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?cls ?clsLabel ORDER BY DESC(?n) LIMIT 15`],
];
for (const [name, query] of Q) {
  const t = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(90_000),
    });
    const text = await res.text();
    const rows = res.ok ? (JSON.parse(text) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value.replace("http://www.wikidata.org/entity/", "")]))) : text.slice(0, 200);
    console.log(`### ${name} (${res.status}, ${((Date.now() - t) / 1000).toFixed(1)} s)\n${JSON.stringify(rows)}`);
  } catch (err) {
    console.log(`### ${name}: ${String(err)}`);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
