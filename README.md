# Registro Famiglia

PWA in italiano per condividere lista della spesa, promemoria, agenda e note veloci tra Android e iPhone. L'app non richiede ChatGPT: ogni familiare usa il proprio accesso email e password.

## Stato

L'app usa Firebase Authentication per gli account e Cloud Firestore per i dati in tempo reale. L'accesso ai dati è limitato alle persone collegate a una famiglia; i controlli sono nelle regole `firestore.rules`. La configurazione Firebase è specifica del proprietario e non è inclusa nel repository.

## Configurazione Firebase richiesta una sola volta

1. Crea un progetto in [Firebase Console](https://console.firebase.google.com/) e aggiungi un'app Web.
2. In **Authentication → Sign-in method**, abilita **Email/Password**.
3. Crea Cloud Firestore scegliendo una località europea (ad esempio `europe-west3`, Francoforte), se disponibile per il progetto.
4. In **Authentication → Settings → Authorized domains**, aggiungi `artiginet-gif.github.io`.
5. Incolla i valori della configurazione Web nei campi corrispondenti di `firebase-config.js`.
6. Pubblica `firestore.rules` dalla scheda **Firestore → Rules** oppure con Firebase CLI (`firebase deploy --only firestore:rules`). Non usare regole aperte come `allow read, write: if true`.
7. In GitHub, apri **Settings → Pages** e imposta la sorgente su **GitHub Actions**. Il workflow `.github/workflows/pages.yml` pubblica il contenuto del repository a ogni aggiornamento di `main`.

La configurazione Web Firebase è visibile nel codice client: è normale. La protezione dei dati dipende dalle regole Firestore e dall'autenticazione, non dal nascondere la chiave Web. Non inserire mai chiavi di servizio o credenziali amministrative in questo repository.

## Accesso della famiglia

- La prima persona crea l'account e il nome della famiglia.
- Il proprietario seleziona **Invita**, crea un codice monouso e lo invia in privato.
- La persona invitata crea il proprio account email/password e inserisce il codice. Non le serve un account ChatGPT.
- Il codice scade dopo 7 giorni. Il proprietario può generarne un altro se necessario.

## PWA

L'app è installabile da browser su Android e iOS tramite `manifest.webmanifest`, service worker e l'icona `icons/icon.svg` già presente nel repository. Serve HTTPS; GitHub Pages lo fornisce.
