# Come avviare il quiz (guida rapida)

**Per giocare via Internet:** segui [ONLINE.md](ONLINE.md). Il progetto include la configurazione per Render: i partecipanti possono usare qualsiasi connessione, anche i dati mobili. GitHub ospita il codice; il server di gioco viene eseguito sull'hosting. La guida seguente resta valida per la modalità locale.

**GDG Tech Challenge** è già pronto: non devi programmare né installare librerie npm. Occorre soltanto Node.js 22+ sul Mac, installato in anticipo quando hai Internet.

1. Estrai la cartella dal file ZIP.
2. Apri il **Terminale** e verifica `node -v`. Se il comando non esiste, installa Node.js prima dell'evento.
3. Nella cartella del quiz fai doppio clic su **START-MAC.command**, oppure lancia `node server.js` dal Terminale nella cartella.
4. Il Terminale stampa due link: **Host control** (PRIVATO, solo per te) e **Projector** (`http://localhost:3000/screen`). Apri entrambi in due finestre sul Mac.
5. Per mostrare le domande sul proiettore, imposta **Monitor esteso** nelle impostazioni schermi del Mac. Metti `/screen` sul proiettore, `/host` sul display del Mac.
6. Collega Mac e telefoni **alla stessa rete Wi-Fi** della sala. La rete può non avere Internet, ma deve permettere la comunicazione tra i dispositivi.
7. Sulla schermata proiettata seleziona l'IP Wi-Fi corretto (es. `192.168.x.x` o `10.x.x.x`) dal menu. I ragazzi scansionano il QR code, inseriscono nickname e PIN.
8. Dalla finestra `/host` premi **START GAME**. Quando il timer finisce, viene mostrata la risposta; tu fai avanzare il gioco. La classifica **non appare automaticamente**: scegli tu quando mostrarla con **SHOW LEADERBOARD** nel pannello host, disponibile dopo la soluzione di ogni domanda. Premi **HIDE LEADERBOARD** per tornare alla soluzione oppure **NEXT QUESTION** per proseguire. Dopo la dodicesima domanda appare il podio.
9. Scarica la classifica con **EXPORT CSV**. Termina premendo `Control+C` nel Terminale.

**Attenzione**: il test riuscito sul Wi-Fi di casa non garantisce la rete dell'università. Ripeti la prova **nell'aula della presentazione**. Alcune reti universitarie isolano gli utenti e impediscono il gioco multiplayer locale.

**Piano B**: apri il file `OFFLINE-BACKUP.html` con doppio clic sul Mac. È una presentazione offline con tutte le domande e le soluzioni; i ragazzi votano alzando la mano o mostrando schede A/B/C/D. Il punteggio in questo caso va gestito manualmente.

Per modificare le domande, apri `questions.json`: le risposte corrette sono numerate da 0 a 3 (0=A, 1=B, 2=C, 3=D). Riavvia il server dopo ogni modifica. Per rigenerare anche il file di backup dopo una modifica, esegui `python3 build_backup.py`.

**Nota sul brand**: il design usa colori, forme e linguaggio visivo delle guidelines GDG on Campus. Non include copie dei loghi ufficiali né i file dei font Google Sans. Se il chapter universitario non è ancora ufficialmente confermato, verifica con gli organizzatori la dicitura pubblica.

Leggi anche `README.md` per guida completa, rete e risoluzione problemi.

## Modifiche v2 (modalità anti-cheat facoltativa)

Nel pannello `/host`, **prima di START GAME**, puoi impostare **Page-switch deterrent**: `Warnings only` (consigliato) oppure `After 3 warnings, −500 pts`. Gli avvisi sono basati sul fatto che il browser venga messo in background **per almeno 2,5 secondi mentre la domanda è ancora senza risposta**; massimo una segnalazione per domanda. Dalla quarta segnalazione si sottraggono fino a 500 punti per segnalazione **solo se scegli esplicitamente la seconda modalità**. Il partecipante vede un avviso in alto quando torna alla pagina.

Non è un vero rilevatore di cheating: non vede screenshot, app AI, siti visitati né altri dispositivi; può segnalare anche telefonate/notifiche. Per un evento informale con premi consiglierei **Warnings only**, annunciando comunque agli studenti di non abbandonare la pagina durante il quiz.

Per applicare questa versione, **chiudi la precedente con Control+C**, estrai il nuovo ZIP in una cartella nuova e rilancia `START-MAC.command`. Le sessioni salvate nella vecchia cartella non vengono copiate: è preferibile ripartire da una lobby nuova.

## v3: filtro nickname

I nickname sono verificati **sul server**, senza Internet. Il filtro limita riferimenti espliciti a conflitti, estremismi e insulti discriminatori; mantiene un messaggio neutro quando rifiuta un nome e non salva i tentativi rifiutati.

Per personalizzare le parole vietate apri `nickname-rules.json` nella cartella del quiz, modifica gli elenchi e **riavvia il server**. I controlli gestiscono molte varianti con spazi, punti, accenti e numeri al posto delle lettere, ma non possono riconoscere ogni aggiramento. Non aggiungere frammenti troppo corti: potrebbero bloccare nickname innocui. Alcuni riferimenti identitari nel file sono esclusi solo per evitare provocazioni durante questo evento, non perché costituiscano di per sé insulti.

Il filtro agisce quando si entra nella lobby; non modifica i nickname di eventuali sessioni già salvate. Per partire con una lobby pulita usa RESET GAME prima che arrivino i partecipanti.
