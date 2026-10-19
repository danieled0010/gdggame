# GDG Tech Challenge online

Il gioco funziona con una partita condivisa, fino a **60 giocatori**, guidata da un organizzatore. Chi partecipa apre un link nel browser e inserisce nickname e PIN. Può usare Wi-Fi o dati mobili, anche da reti e luoghi diversi. L'organizzatore avvia le domande, mostra le soluzioni e gestisce la classifica.

## Pubblicazione da GitHub su Render

1. Il codice è nel repository [danieled0010/gdggame](https://github.com/danieled0010/gdggame). GitHub Pages non può eseguire il server Node.js necessario a sincronizzare la partita.
2. Accedi a [Render](https://dashboard.render.com/) con il tuo account. Se non ne hai uno, crealo. Se colleghi GitHub, autorizza l'accesso al repository del gioco.
3. Apri [Deploy to Render](https://render.com/deploy?repo=https://github.com/danieled0010/gdggame), oppure scegli **New → Blueprint** e seleziona il repository. Il file `render.yaml` contiene la configurazione completa. Verifica che il piano selezionato sia **Free** e avvia la creazione del servizio.
4. Attendi che il servizio risulti **Live**. Usa l'indirizzo HTTPS effettivo mostrato da Render; il nome disponibile potrebbe avere un suffisso. Non occorre inserire un IP, aprire porte sul router o lasciare acceso il Mac.
5. Nel servizio apri **Environment**, trova `ADMIN_TOKEN` e copia il valore generato. È il codice privato dell'organizzatore: non inserirlo nel codice, nei commit o nei link condivisi.
6. Apri `https://INDIRIZZO-DEL-SERVIZIO/host` e inserisci il codice. Apri `/screen` per proiettare lobby, QR e domande. Condividi `/join` con i partecipanti, che inseriscono il PIN mostrato sullo schermo.
7. Quando i partecipanti sono entrati, premi **START GAME**. I nuovi ingressi si chiudono all'avvio; chi è già entrato può riconnettersi dallo stesso browser. Usa **RESET GAME** per aprire una nuova partita.

Il link principale `/` apre la pagina per i giocatori in modalità online. Il pannello `/host` richiede sempre il codice privato. Anche l'esportazione CSV è riservata all'organizzatore. Il server non pubblica i file con soluzioni, filtro nickname, salvataggi o variabili d'ambiente. Se il repository GitHub è pubblico, le domande e le soluzioni nel repository sono invece leggibili: per un evento competitivo puoi mantenere il codice in un repository privato e collegarlo dall'account Render.

## Limiti del piano gratuito e salvataggi

Il piano Free di Render può sospendere un servizio inattivo, impiegare circa un minuto a riavviarlo e perdere i file locali dopo una sospensione, un riavvio o una nuova pubblicazione. Un'interruzione del server può quindi azzerare una partita sul piano gratuito. Non è una garanzia di disponibilità continua. Vedi i [limiti ufficiali](https://render.com/docs/free).

Per un evento in cui serve continuità, scegli un'istanza a pagamento con disco persistente. Imposta `DATA_DIR` sul percorso di montaggio del disco (per esempio `/var/data/gdg`). Il gioco scrive `session.json` in quella cartella e conserva giocatori, punteggi e PIN; dopo un riavvio ripristina la domanda in pausa. Un piano o disco a pagamento va scelto e attivato esplicitamente nel tuo account.

Esegui **una sola istanza del server**: la partita è mantenuta in memoria e non è condivisa tra istanze diverse. Il Blueprint disattiva i deploy automatici. Dopo una modifica su GitHub, avvia manualmente un nuovo deploy quando non c'è una partita in corso. Esporta il CSV prima di chiudere l'evento.

## Configurazione per altri hosting o un dominio personale

Il server funziona anche su altri servizi che supportano Node.js, HTTPS e connessioni SSE. Il comando di avvio è `npm start`; il controllo di salute è `GET /healthz`. Il servizio deve inoltrare il traffico alla porta `PORT` e non deve memorizzare in cache o bufferizzare `/events`.

| Variabile | Utilizzo |
| --- | --- |
| `NODE_ENV` | `production` sull'hosting. |
| `ADMIN_TOKEN` | Codice segreto stabile, da 32 a 256 caratteri Base64 o URL-safe (lettere, numeri, `+`, `/`, `=`, `-`, `_`). Compatibile con il valore generato da Render. Obbligatorio in produzione. |
| `PUBLIC_BASE_URL` | Origine pubblica, per esempio `https://quiz.example.com`. Senza percorsi, credenziali, query o frammenti. Su Render è facoltativa. |
| `RENDER_EXTERNAL_URL` | Fornita automaticamente da Render; usata se `PUBLIC_BASE_URL` non è impostata. |
| `PORT` | Porta fornita dall'hosting; in locale è `3000`. |
| `DATA_DIR` | Cartella dei salvataggi; predefinita: `./data`. Usa un volume persistente per conservarli dopo i riavvii dell'hosting. |

Per generare un codice sicuro da inserire **nelle impostazioni dell'hosting**:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`.env.example` documenta le variabili; il server non carica automaticamente un file `.env`. Se configuri un dominio personale, impostalo in `PUBLIC_BASE_URL` così link e QR puntano a quel dominio. Il codice host resta lo stesso dopo i riavvii finché non modifichi `ADMIN_TOKEN`.

## Prova prima dell'evento

Apri `/host` e `/screen`, poi collega almeno due telefoni: uno tramite Wi-Fi e uno tramite dati mobili. Verifica QR, ingresso con PIN, una risposta, classifica e riconnessione dopo un cambio di rete. Prova anche l'esportazione CSV. Questa verifica sul servizio pubblicato completa i test automatici: una simulazione locale con 60 connessioni non misura le condizioni della rete o la capacità effettiva del piano di hosting.

Per giocare senza Internet rimangono disponibili `START-MAC.command` e `node server.js`, senza impostare le variabili dell'hosting. Le istruzioni sono in [LEGGIMI-PRIMA.md](LEGGIMI-PRIMA.md).
