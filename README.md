# Registro Famiglia

Applicazione web installabile per condividere lista della spesa, promemoria, agenda e note rapide tra Android e iPhone. Funziona con un accesso email e password indipendente da ChatGPT.

**App:** https://artiginet-gif.github.io/registro-famiglia/

## Funzioni

- Spesa, promemoria, agenda e note familiari.
- Aggiornamento in tempo reale tramite Cloud Firestore.
- Account familiari separati con invito monouso valido 7 giorni.
- PWA con icone PNG dedicate per Android e iOS.

## Configurazione attiva

- Firebase project: registro-famiglia.
- Firestore: regione europe-west8; piano Firebase Spark.
- Accesso: Authentication Email/Password.
- Dominio autorizzato: artiginet-gif.github.io.
- Le regole in firestore.rules limitano i dati ai membri autenticati della famiglia.
- GitHub Pages pubblica il branch main tramite GitHub Actions.

La configurazione Web Firebase presente in firebase-config.js è pubblica per natura nelle app client. La sicurezza dei dati è affidata all'autenticazione e alle regole Firestore. Non aggiungere mai chiavi di servizio o credenziali amministrative al repository.

## Primo accesso e invito

1. Apri l'app e scegli **Crea il primo account familiare**.
2. Inserisci email, password e nome della famiglia.
3. Dopo l'accesso, premi **Invita** e crea il codice.
4. Invia il codice privatamente alla persona invitata.
5. Eleonora apre l'app, seleziona **Ho un codice invito**, crea il suo account email/password e inserisce il codice. Non serve ChatGPT.

Il codice è utilizzabile una volta e scade dopo 7 giorni. Per sicurezza, non pubblicarlo o inviarlo in gruppi aperti.

## Installazione

- **Android/Pixel:** apri il link in Chrome, menu ⋮ → **Installa app** oppure **Aggiungi a schermata Home**.
- **iPhone:** apri il link in Safari, Condividi → **Aggiungi alla schermata Home**. Se compare l'opzione, attiva **Apri come app web**.

GitHub Pages fornisce HTTPS, necessario per il service worker e l'installazione PWA. Il service worker aggiorna la cache quando cambia la versione dell'app.
