'use strict';
/*
 * Generatore del sito statico "La Terrazza".
 * Uso: node build.js   (Node 20, nessuna dipendenza)
 * Legge content.json, template.html e images/, scrive tutto in dist/.
 */
const fs = require('fs');
const path = require('path');

const RADICE = __dirname;
const DIST = path.join(RADICE, 'dist');
const LINGUE = [
  { codice: 'it', locale: 'it_IT', percorso: '/', file: 'index.html' },
  { codice: 'en', locale: 'en_GB', percorso: '/en/', file: path.join('en', 'index.html') },
];
const EST_GALLERIA = ['.jpg', '.jpeg', '.png', '.webp'];
const EST_IMMAGINI = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg'];
const ordineNaturale = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });
const avvisi = [];

// ---------- utilità ----------

function esc(valore) {
  return String(valore)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function esci(righe) {
  console.error(righe.join('\n'));
  process.exit(1);
}

function esiste(relativo) {
  return fs.existsSync(path.join(RADICE, relativo));
}

function riempi(modello, valori) {
  return modello.replace(/\{(\w+)\}/g, (tutto, k) => (k in valori ? String(valori[k]) : tutto));
}

function formattaTelefono(n) {
  const m = n.match(/^\+39(\d{3})(\d{3})(\d{4})$/);
  return m ? `+39 ${m[1]} ${m[2]} ${m[3]}` : n;
}

// Sostituisce gli oggetti {"it": "...", "en": "..."} con il testo della lingua scelta.
function risolvi(v, lingua) {
  if (Array.isArray(v)) return v.map((x) => risolvi(x, lingua));
  if (v && typeof v === 'object') {
    if (typeof v.it === 'string' && typeof v.en === 'string') return v[lingua];
    const o = {};
    for (const k of Object.keys(v)) o[k] = risolvi(v[k], lingua);
    return o;
  }
  return v;
}

// ---------- lettura e validazione di content.json ----------

function descriviErroreJson(testo, errore) {
  const messaggio = String(errore.message);
  const righe = testo.split('\n');
  let pos = null;
  let m = messaggio.match(/position (\d+)/);
  if (m) {
    pos = Number(m[1]);
  } else if ((m = messaggio.match(/line (\d+) column (\d+)/))) {
    pos = righe.slice(0, Number(m[1]) - 1).reduce((s, r) => s + r.length + 1, 0) + Number(m[2]) - 1;
  } else if (/end of JSON/i.test(messaggio)) {
    pos = testo.length;
  }
  const out = ['ERRORE: content.json non è un JSON valido.', `Messaggio di JSON.parse: ${messaggio}`];
  if (pos !== null) {
    pos = Math.min(pos, testo.length);
    const prima = testo.slice(0, pos).split('\n');
    const riga = prima.length;
    const colonna = prima[prima.length - 1].length + 1;
    const inizio = Math.max(0, colonna - 1 - 60);
    const frammento = righe[riga - 1].slice(inizio, colonna - 1 + 60);
    out.push(`Posizione: riga ${riga}, colonna ${colonna}.`, 'Testo vicino all\'errore:');
    if (riga > 1) out.push(`  ${String(riga - 1).padStart(4)} | ${righe[riga - 2].slice(0, 100)}`);
    out.push(`  ${String(riga).padStart(4)} | ${frammento}`);
    out.push(`       | ${' '.repeat(colonna - 1 - inizio)}^ qui`);
  }
  out.push('Controllare: virgole mancanti o in più, virgolette doppie dentro un testo, due punti, parentesi.');
  return out;
}

function leggiContenuto() {
  const file = path.join(RADICE, 'content.json');
  if (!fs.existsSync(file)) esci(['ERRORE: manca il file content.json nella radice del repository.']);
  const testo = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(testo);
  } catch (e) {
    return esci(descriviErroreJson(testo, e));
  }
}

// Forma attesa di content.json: S = testo semplice, N = numero, T = testo tradotto {it, en}.
const S = 'stringa';
const N = 'numero';
const T = 'tradotto';
const FORMA = {
  site: {
    dominio: S, nome: S, indirizzo: S,
    indirizzoSchema: { via: S, localita: S, provincia: S, paese: S },
    telefoni: [S], email: S, latitudine: N, longitudine: N, googleMapsUrl: S, osmUrl: S,
  },
  lingue: [{ codice: S, sigla: S, nome: S }],
  meta: { title: T, description: T },
  immagini: { altHero: T, altLogo: T },
  interfaccia: {
    vaiAlContenuto: T, menuPrincipale: T, selettoreLingua: T, chiama: T,
    nuovaScheda: T, copyright: T, privacy: T,
  },
  hero: { titolo: T, sottotitolo: T, pulsante: T },
  disponibilita: T,
  sezioni: {
    struttura: { titolo: T, testo: T },
    appartamenti: {
      titolo: T, fotoInArrivo: T, fotoPrecedente: T, fotoSuccessiva: T, galleria: T, altFoto: T,
    },
    servizi: { titolo: T, voci: [T] },
    dintorni: { titolo: T, voci: [{ titolo: T, testo: T }] },
    mappa: { titolo: T, pulsante: T, nota: T, titoloIframe: T, apriGoogle: T, apriOsm: T },
    contatti: { titolo: T, telefono: T, email: T, indirizzo: T },
  },
  appartamenti: [{ id: S, nome: S, dettagli: T, descrizione: T }],
};

function verifica(forma, valore, perc, problemi) {
  const figlio = (k) => (perc ? `${perc}.${k}` : k);
  if (forma === S) {
    if (typeof valore !== 'string' || !valore.trim()) problemi.push(`${perc}: testo mancante o vuoto`);
  } else if (forma === N) {
    if (typeof valore !== 'number' || !Number.isFinite(valore)) problemi.push(`${perc}: deve essere un numero`);
  } else if (forma === T) {
    if (!valore || typeof valore !== 'object' || Array.isArray(valore)) {
      problemi.push(`${perc}: mancano le chiavi "it" e "en"`);
      return;
    }
    for (const l of ['it', 'en']) {
      if (typeof valore[l] !== 'string' || !valore[l].trim()) problemi.push(`${perc}.${l}: testo mancante o vuoto`);
    }
  } else if (Array.isArray(forma)) {
    if (!Array.isArray(valore) || valore.length === 0) {
      problemi.push(`${perc}: elenco mancante o vuoto`);
      return;
    }
    valore.forEach((v, i) => verifica(forma[0], v, `${perc}[${i}]`, problemi));
  } else {
    if (!valore || typeof valore !== 'object' || Array.isArray(valore)) {
      problemi.push(`${perc || 'content.json'}: sezione mancante`);
      return;
    }
    for (const k of Object.keys(forma)) verifica(forma[k], valore[k], figlio(k), problemi);
  }
}

function controllaContenuto(c) {
  const problemi = [];
  verifica(FORMA, c, '', problemi);
  const sito = c.site || {};
  const lista = (x) => (Array.isArray(x) ? x : []);
  if (typeof sito.dominio === 'string' && sito.dominio.trim() && !/^https:\/\/[^/\s]+/.test(sito.dominio)) {
    problemi.push('site.dominio: deve iniziare con https://');
  }
  lista(sito.telefoni).forEach((n, i) => {
    if (typeof n === 'string' && n.trim() && !/^\+\d{8,15}$/.test(n)) {
      problemi.push(`site.telefoni[${i}]: usare il formato +393331234567 (senza spazi)`);
    }
  });
  if (Array.isArray(c.lingue)) {
    for (const l of LINGUE) {
      if (!c.lingue.some((x) => x && x.codice === l.codice)) problemi.push(`lingue: manca la lingua "${l.codice}"`);
    }
  }
  const visti = new Set();
  lista(c.appartamenti).forEach((a, i) => {
    if (!a || typeof a.id !== 'string' || !a.id.trim()) return;
    if (!/^[A-Za-z0-9_-]+$/.test(a.id)) problemi.push(`appartamenti[${i}].id: usare solo lettere, numeri, - e _`);
    if (visti.has(a.id)) problemi.push(`appartamenti[${i}].id: "${a.id}" è già usato`);
    visti.add(a.id);
  });
  return problemi;
}

// ---------- template (segnaposto, cicli, condizioni) ----------
// {{percorso}} testo con escape HTML    {{{percorso}}} HTML già pronto
// {{#each elenco}}...{{/each}}          {{#if valore}}...{{else}}...{{/if}}    {{this}} elemento corrente

function compila(sorgente) {
  const re = /\{\{\{\s*([^{}]+?)\s*\}\}\}|\{\{\s*([^{}]+?)\s*\}\}/g;
  const radice = { tipo: 'radice', ramo: 'corpo', corpo: [] };
  const pila = [radice];
  const aggiungi = (nodo) => {
    const n = pila[pila.length - 1];
    n[n.ramo].push(nodo);
  };
  let ultimo = 0;
  let m;
  while ((m = re.exec(sorgente))) {
    if (m.index > ultimo) aggiungi({ tipo: 'testo', valore: sorgente.slice(ultimo, m.index) });
    ultimo = re.lastIndex;
    if (m[1] !== undefined) {
      aggiungi({ tipo: 'var', path: m[1], grezzo: true });
      continue;
    }
    const tag = m[2];
    if (tag.startsWith('#each ')) {
      const n = { tipo: 'each', path: tag.slice(6).trim(), ramo: 'corpo', corpo: [] };
      aggiungi(n);
      pila.push(n);
    } else if (tag.startsWith('#if ')) {
      const n = { tipo: 'if', path: tag.slice(4).trim(), ramo: 'si', si: [], no: [] };
      aggiungi(n);
      pila.push(n);
    } else if (tag === 'else') {
      const n = pila[pila.length - 1];
      if (n.tipo !== 'if') throw new Error('{{else}} fuori da un blocco {{#if}}');
      n.ramo = 'no';
    } else if (tag === '/each' || tag === '/if') {
      const n = pila.pop();
      if (n.tipo === 'radice' || n.tipo !== tag.slice(1)) throw new Error(`chiusura inattesa: {{${tag}}}`);
    } else {
      aggiungi({ tipo: 'var', path: tag, grezzo: false });
    }
  }
  if (ultimo < sorgente.length) aggiungi({ tipo: 'testo', valore: sorgente.slice(ultimo) });
  if (pila.length !== 1) throw new Error(`blocco {{#${pila[pila.length - 1].tipo}}} non chiuso`);
  return radice.corpo;
}

function cerca(nome, scope) {
  if (nome === 'this') return scope[scope.length - 1];
  const parti = nome.split('.');
  for (let i = scope.length - 1; i >= 0; i--) {
    const s = scope[i];
    if (s !== null && typeof s === 'object' && parti[0] in s) {
      let v = s;
      for (const p of parti) {
        if (v === null || typeof v !== 'object' || !(p in v)) return undefined;
        v = v[p];
      }
      return v;
    }
  }
  return undefined;
}

function render(nodi, scope, mancanti) {
  let out = '';
  for (const n of nodi) {
    if (n.tipo === 'testo') {
      out += n.valore;
    } else if (n.tipo === 'var') {
      const v = cerca(n.path, scope);
      if (v === undefined || v === null) mancanti.add(n.path);
      else out += n.grezzo ? String(v) : esc(v);
    } else if (n.tipo === 'if') {
      const v = cerca(n.path, scope);
      if (v === undefined) mancanti.add(n.path);
      const vero = Array.isArray(v) ? v.length > 0 : Boolean(v);
      out += render(vero ? n.si : n.no, scope, mancanti);
    } else if (n.tipo === 'each') {
      const v = cerca(n.path, scope);
      if (!Array.isArray(v)) mancanti.add(n.path);
      else for (const el of v) out += render(n.corpo, scope.concat([el]), mancanti);
    }
  }
  return out;
}

// ---------- immagini ----------

function leggiFoto(id) {
  const cartella = path.join(RADICE, 'images', id);
  if (!fs.existsSync(cartella)) {
    avvisi.push(`Cartella images/${id}/ non trovata: nella scheda comparirà "Foto in arrivo".`);
    return [];
  }
  const foto = fs
    .readdirSync(cartella, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith('.') && EST_GALLERIA.includes(path.extname(d.name).toLowerCase()))
    .map((d) => d.name)
    .sort(ordineNaturale.compare);
  if (foto.length === 0) avvisi.push(`Nessuna foto in images/${id}/: nella scheda comparirà "Foto in arrivo".`);
  return foto;
}

function copiaImmagini(origine, destinazione) {
  if (!fs.existsSync(origine)) return;
  for (const voce of fs.readdirSync(origine, { withFileTypes: true })) {
    if (voce.name.startsWith('.')) continue; // .gitkeep e file nascosti
    const da = path.join(origine, voce.name);
    const a = path.join(destinazione, voce.name);
    if (voce.isDirectory()) {
      copiaImmagini(da, a);
    } else if (voce.isFile() && EST_IMMAGINI.includes(path.extname(voce.name).toLowerCase())) {
      fs.mkdirSync(destinazione, { recursive: true });
      fs.copyFileSync(da, a);
    }
  }
}

// ---------- contesto di una pagina ----------

function costruisciContesto(c, lingua, stato) {
  const t = risolvi(c, lingua.codice);
  const dominio = c.site.dominio.replace(/\/+$/, '');
  const urlDi = (l) => dominio + l.percorso;
  const anno = new Date().getFullYear();
  const { latitudine: lat, longitudine: lon } = c.site;
  const bbox = [lon - 0.0041, lat - 0.002, lon + 0.0041, lat + 0.002].map((x) => x.toFixed(6)).join('%2C');
  const imgHero = `${dominio}/images/hero.jpg`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: c.site.nome,
    url: urlDi(lingua),
    description: t.meta.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: c.site.indirizzoSchema.via,
      addressLocality: c.site.indirizzoSchema.localita,
      addressRegion: c.site.indirizzoSchema.provincia,
      addressCountry: c.site.indirizzoSchema.paese,
    },
    telephone: c.site.telefoni,
    email: c.site.email,
    geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lon },
  };
  if (stato.haHero) jsonld.image = imgHero;
  jsonld.amenityFeature = t.sezioni.servizi.voci.map((nome) => ({
    '@type': 'LocationFeatureSpecification',
    name: nome,
    value: true,
  }));
  jsonld.inLanguage = lingua.codice;

  const appartamenti = t.appartamenti.map((a) => {
    const foto = stato.foto[a.id];
    return {
      id: a.id,
      nome: a.nome,
      dettagli: a.dettagli,
      descrizione: a.descrizione,
      haFoto: foto.length > 0,
      etichettaGalleria: riempi(t.sezioni.appartamenti.galleria, { nome: a.nome }),
      foto: foto.map((file, i) => ({
        src: `/images/${encodeURIComponent(a.id)}/${encodeURIComponent(file)}`,
        alt: riempi(t.sezioni.appartamenti.altFoto, { nome: a.nome, n: i + 1, m: foto.length }),
      })),
    };
  });

  return Object.assign({}, t, {
    site: Object.assign({}, t.site, {
      telefoni: t.site.telefoni.map((n) => ({ numero: n, visualizzato: formattaTelefono(n) })),
    }),
    lingue: LINGUE.map((l) => {
      const voce = t.lingue.find((x) => x.codice === l.codice);
      return { codice: l.codice, sigla: voce.sigla, nome: voce.nome, href: l.percorso, corrente: l.codice === lingua.codice };
    }),
    alternate: LINGUE.map((l) => ({ codice: l.codice, url: urlDi(l) })),
    urlPredefinita: urlDi(LINGUE[0]),
    codiceLingua: lingua.codice,
    locale: lingua.locale,
    percorsoHome: lingua.percorso,
    canonical: urlDi(lingua),
    ogImmagine: stato.haHero ? imgHero : '',
    haHero: stato.haHero,
    haLogo: stato.haLogo,
    haFavicon: stato.haFavicon,
    copyright: riempi(t.interfaccia.copyright, { anno, nome: c.site.nome }),
    appartamenti,
    mappaSrc: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lon.toFixed(6)}`,
    jsonld: JSON.stringify(jsonld, null, 2).replace(/</g, '\\u003c'),
  });
}

// ---------- file di servizio ----------

function creaSitemap(dominio, data) {
  const alternate = LINGUE.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.codice}" href="${esc(dominio + l.percorso)}"/>`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(dominio + LINGUE[0].percorso)}"/>`)
    .join('\n');
  const url = LINGUE.map(
    (l) => `  <url>\n    <loc>${esc(dominio + l.percorso)}</loc>\n    <lastmod>${data}</lastmod>\n${alternate}\n  </url>`
  ).join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    `${url}\n</urlset>\n`
  );
}

function scrivi(relativo, contenuto) {
  const file = path.join(DIST, relativo);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contenuto, 'utf8');
}

// ---------- programma principale ----------

function main() {
  const c = leggiContenuto();
  const problemi = controllaContenuto(c);
  if (problemi.length) {
    esci([`ERRORE: content.json contiene ${problemi.length} problema/i:`, ...problemi.map((p) => `  - ${p}`), 'La versione online precedente resta invariata.']);
  }

  if (!esiste('template.html')) esci(['ERRORE: manca il file template.html nella radice del repository.']);
  let nodi;
  try {
    nodi = compila(fs.readFileSync(path.join(RADICE, 'template.html'), 'utf8'));
  } catch (e) {
    esci([`ERRORE nel template.html: ${e.message}`]);
  }

  const stato = {
    haHero: esiste('images/hero.jpg'),
    haLogo: esiste('images/logo.png'),
    haFavicon: esiste('favicon.png'),
    foto: {},
  };
  if (!stato.haHero) avvisi.push('Manca images/hero.jpg: lo sfondo della prima sezione sarà blu notte.');
  if (!stato.haLogo) avvisi.push('Manca images/logo.png: al posto del logo comparirà il nome.');
  if (!stato.haFavicon) avvisi.push('Manca favicon.png nella radice.');
  if (!esiste('privacy.html')) avvisi.push('Manca privacy.html: i link alla privacy porteranno a una pagina inesistente.');
  for (const a of c.appartamenti) stato.foto[a.id] = leggiFoto(a.id);

  // Prima si genera tutto in memoria: se qualcosa non va, dist/ non viene toccata.
  const pagine = [];
  const mancanti = new Set();
  for (const lingua of LINGUE) {
    pagine.push({ lingua, html: render(nodi, [costruisciContesto(c, lingua, stato)], mancanti) });
  }
  if (mancanti.size) {
    esci(['ERRORE: il template.html usa segnaposto che non esistono:', ...[...mancanti].map((m) => `  - {{${m}}}`)]);
  }

  const dominio = c.site.dominio.replace(/\/+$/, '');
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  for (const p of pagine) scrivi(p.lingua.file, p.html);
  scrivi('sitemap.xml', creaSitemap(dominio, new Date().toISOString().slice(0, 10)));
  scrivi('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${dominio}/sitemap.xml\n`);
  copiaImmagini(path.join(RADICE, 'images'), path.join(DIST, 'images'));
  for (const f of ['favicon.png', 'privacy.html']) {
    if (esiste(f)) fs.copyFileSync(path.join(RADICE, f), path.join(DIST, f));
  }

  console.log('Build completata: dist/ contiene index.html, en/index.html, sitemap.xml, robots.txt.');
  console.log('Foto trovate per appartamento:');
  for (const a of c.appartamenti) console.log(`  - ${a.nome}: ${stato.foto[a.id].length}`);
  if (avvisi.length) {
    console.log(`Avvisi (${avvisi.length}):`);
    for (const a of avvisi) console.log(`  ! ${a}`);
  } else {
    console.log('Nessun avviso.');
  }
}

main();
