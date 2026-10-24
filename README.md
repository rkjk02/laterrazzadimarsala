# La Terrazza – sito web

Il sito è composto da due pagine (italiano `/` e inglese `/en/`). Ogni volta che una modifica viene salvata su GitHub, Netlify ricostruisce e pubblica il sito da solo, in uno o due minuti. Non serve installare nulla.

## Foto

Le foto di ogni appartamento stanno nella cartella con il suo nome: `images/suite/`, `images/marettimo/`, `images/levanzo/`, `images/favignana/`, `images/pantelleria/`.

- **Aggiungere una foto**: su GitHub aprire la cartella, premere *Add file → Upload files* e caricare l'immagine. Il numero di foto non è fisso: tutto quello che c'è nella cartella compare nel sito.
- **Togliere una foto**: aprire il file su GitHub e premere l'icona del cestino (*Delete file*).
- **Riordinare le foto**: compaiono in ordine di nome. Chiamarle `01.jpg`, `02.jpg`, `03.jpg`… (con lo zero davanti fino a 09) e cambiare i numeri per cambiare l'ordine.
- Formati accettati: `.jpg`, `.jpeg`, `.png`, `.webp`. Gli altri file vengono ignorati.
- L'immagine grande in cima alla pagina è `images/hero.jpg`, il logo è `images/logo.png`.

## Testi

Tutti i testi del sito sono in `content.json`. Ogni testo ha due righe: `"it"` (italiano) e `"en"` (inglese). Cambiare solo le parole tra le virgolette.

```json
"dettagli": {
  "it": "Fino a 4 ospiti · Terzo piano",
  "en": "Up to 4 guests · Third floor"
},
```

Per non rompere il file:

- non toccare virgolette, virgole, due punti e parentesi graffe o quadre;
- non andare a capo dentro un testo: ogni testo sta su una sola riga;
- dentro un testo non usare le virgolette doppie `"`: usare `'` oppure « »;
- i numeri di telefono si scrivono senza spazi, con il prefisso (`+393313248361`).

Dopo la modifica, salvare con *Commit changes*: Netlify pubblica il sito aggiornato.

## Se la pubblicazione non riesce

1. Su Netlify aprire il sito, poi *Deploys*, e premere sull'ultimo tentativo (segnato *Failed*).
2. Leggere il *Deploy log* e cercare la riga che inizia con `ERRORE`.
3. L'errore dice che cosa non va e dove, per esempio:
   - `Posizione: riga 142, colonna 22` → c'è una virgola mancante o una virgoletta di troppo vicino a quel punto di `content.json`;
   - `appartamenti[2].descrizione.en: testo mancante o vuoto` → manca il testo inglese della descrizione del terzo appartamento (Levanzo).
4. Correggere `content.json` e salvare di nuovo.

Finché la build non riesce, il sito online resta la versione precedente: nessun danno ai visitatori. Le righe che iniziano con `!` sono solo avvisi (per esempio una foto mancante) e non bloccano nulla.

## Link a Google Maps

Quando esisterà la scheda dell'attività su Google, aprire `content.json` e sostituire il valore di `googleMapsUrl` (nel blocco `site`) con il nuovo link. È l'unico campo da cambiare.

