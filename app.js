import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, Timestamp, runTransaction, writeBatch } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const $ = selector => document.querySelector(selector);
const sectionNames = {
  shopping: { title: 'Lista della spesa', intro: 'Le modifiche si aggiornano sui telefoni della famiglia.', name: 'Prodotto', placeholder: 'Aggiungi alla lista', detail: 'Quantità', detailPlaceholder: 'Es. 2 confezioni', date: false },
  reminders: { title: 'Promemoria familiari', intro: 'Scadenze e cose da ricordare, condivise con la famiglia.', name: 'Promemoria', placeholder: 'Cosa dobbiamo ricordare?', detail: 'Dettagli', detailPlaceholder: 'Facoltativo', date: true },
  agenda: { title: 'Agenda condivisa', intro: 'Impegni e appuntamenti di tutti.', name: 'Impegno', placeholder: 'Aggiungi un appuntamento', detail: 'Luogo o dettagli', detailPlaceholder: 'Es. visita, Borgosesia', date: true },
  notes: { title: 'Note veloci', intro: 'Informazioni e idee utili per tutti in famiglia.', name: 'Nota', placeholder: 'Scrivi una nota', detail: 'Dettagli', detailPlaceholder: 'Aggiungi un dettaglio', date: false }
};
let auth, db, currentUser, familyId, familyName = '', activeTab = 'shopping', authMode = 'login', unsubscribeItems, allItems = [], toastTimer;
let unsubscribeMembers;
const inviteParams = new URLSearchParams(location.search);
const inviteCodeFromUrl = (inviteParams.get('invite') || inviteParams.get('invito') || '').trim().toUpperCase();
const validInviteCodeFromUrl = /^[A-Z0-9]{20,40}$/.test(inviteCodeFromUrl) ? inviteCodeFromUrl : '';
const setMessage = (id, text = '') => { $(id).textContent = text; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
function formatDate(value) {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(date);
}
function showToast(text) {
  const toast = $('#toast'); toast.textContent = text; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function setSync(status, label) {
  $('#syncStatus').textContent = label;
  $('#syncDot').className = `sync-dot ${status}`;
}
function clearSubscription() {
  if (unsubscribeItems) unsubscribeItems();
  unsubscribeItems = null; allItems = [];
}
function clearMembersSubscription() {
  if (unsubscribeMembers) unsubscribeMembers();
  unsubscribeMembers = null;
  $('#memberList').replaceChildren();
  $('#memberCount').textContent = 'Caricamento…';
  $('#displayName').value = '';
  setMessage('#membersMessage');
  setMessage('#profileMessage');
}
function subscribeMembers() {
  clearMembersSubscription();
  const membersRef = query(collection(db, 'users'), where('familyId', '==', familyId));
  unsubscribeMembers = onSnapshot(membersRef, { includeMetadataChanges: true }, snapshot => {
    const members = snapshot.docs.map(member => ({ ...member.data(), uid: member.id }));
    members.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'it'));
    $('#memberCount').textContent = `${members.length} ${members.length === 1 ? 'membro' : 'membri'}`;
    $('#memberList').innerHTML = members.map(member => `<li class="member"><div class="member-info"><span class="member-name">${escapeHtml(member.displayName || member.email || 'Account familiare')}</span><span class="member-role">${member.role === 'owner' ? 'Proprietario' : 'Membro'}</span></div>${member.uid === currentUser.uid ? '<span class="member-self">Tu</span>' : ''}</li>`).join('');
    const ownProfile = members.find(member => member.uid === currentUser.uid);
    if (ownProfile && document.activeElement !== $('#displayName')) $('#displayName').value = ownProfile.displayName || '';
    setMessage('#membersMessage', snapshot.metadata.fromCache ? 'Elenco locale: in attesa di conferma dal cloud.' : '');
  }, error => {
    $('#memberCount').textContent = 'Elenco non disponibile';
    $('#memberList').replaceChildren();
    setMessage('#membersMessage', 'Non riesco a caricare le persone collegate. Controlla la connessione e le regole di accesso.');
    console.error(error);
  });
}
function showAuth() {
  $('#authScreen').classList.remove('hidden'); $('#appScreen').classList.add('hidden'); $('#logout').classList.add('hidden');
}
function showApp() {
  $('#authScreen').classList.add('hidden'); $('#appScreen').classList.remove('hidden'); $('#logout').classList.remove('hidden');
  $('#familyLabel').textContent = familyName || 'Spazio familiare condiviso';
  $('#userLabel').textContent = currentUser?.email || '';
  $('#inviteButton').classList.toggle('hidden', !currentUser || currentUser.role !== 'owner');
  subscribeMembers(); subscribeItems(); render();
}
async function activateProfile(user) {
  const profileSnap = await getDoc(doc(db, 'users', user.uid));
  if (!profileSnap.exists()) throw new Error('Account non ancora collegato a una famiglia.');
  const profile = profileSnap.data(); familyId = profile.familyId; currentUser = { ...user, role: profile.role };
  const familySnap = await getDoc(doc(db, 'families', familyId)); familyName = familySnap.exists() ? familySnap.data().name : 'Famiglia'; showApp();
}
function setAuthMode(mode) {
  authMode = mode;
  const creating = mode === 'create', joining = mode === 'join';
  const existingUser = currentUser || auth?.currentUser || null;
  const passwordLabel = $('#password').closest('label');
  if (existingUser && (creating || joining)) {
    $('#email').value = existingUser.email || '';
    $('#email').readOnly = true;
    $('#password').value = '';
    $('#password').required = false;
    passwordLabel.classList.add('hidden');
  } else {
    $('#email').readOnly = false;
    $('#password').required = true;
    passwordLabel.classList.remove('hidden');
  }
  if (creating && !$('#familyName').value) $('#familyName').value = 'Famiglia Garavello';
  $('#authTitle').textContent = creating ? 'Crea lo spazio familiare' : joining ? 'Unisciti alla famiglia' : 'Accedi alla famiglia';
  $('#authIntro').textContent = creating ? (existingUser ? 'Crea lo spazio familiare usando il tuo account già autenticato.' : 'Crea il primo account. Gli altri entreranno con un link personale.') : joining ? (validInviteCodeFromUrl ? 'Invito già riconosciuto. Inserisci la tua email e scegli una password: ti collegheremo automaticamente.' : 'Crea un account personale e inserisci il codice ricevuto.') : 'Accedi con email e password. Non serve un account ChatGPT.';
  $('#familyField').classList.toggle('hidden', !creating); $('#inviteField').classList.toggle('hidden', !joining || Boolean(validInviteCodeFromUrl));
  if (validInviteCodeFromUrl) $('#inviteCode').value = validInviteCodeFromUrl;
  $('#authSubmit').textContent = creating ? 'Crea la famiglia' : joining ? 'Unisciti' : 'Accedi';
  $('#showCreate').classList.toggle('hidden', creating); $('#showJoin').classList.toggle('hidden', joining);
  $('#showLogin').classList.toggle('hidden', !creating && !joining); setMessage('#authMessage');
}
function render() {
  const meta = sectionNames[activeTab];
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === activeTab));
  $('#sectionTitle').textContent = meta.title; $('#sectionIntro').textContent = meta.intro;
  $('#nameLabel').firstChild.textContent = `${meta.name} `;
  $('#itemName').placeholder = meta.placeholder;
  $('#detailLabel').firstChild.textContent = `${meta.detail} `; $('#itemDetail').placeholder = meta.detailPlaceholder;
  $('#detailLabel').classList.toggle('hidden', activeTab === 'notes'); $('#dateLabel').classList.toggle('hidden', !meta.date);
  const sorted = [...allItems].sort((a,b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    const da = a.date || '', db = b.date || '';
    if (da !== db) return da.localeCompare(db);
    const ta = a.createdAt?.toMillis?.() || 0, tb = b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });
  if (!sorted.length) { $('#items').innerHTML = `<div class="empty">${activeTab === 'shopping' ? 'La lista è vuota. Aggiungi il primo prodotto.' : 'Nessun elemento per ora. Aggiungine uno qui sotto.'}</div>`; return; }
  $('#items').innerHTML = sorted.map(item => `<article class="item ${item.done ? 'done' : ''}">
    <input class="check" type="checkbox" aria-label="Segna come completato" data-check="${escapeHtml(item.id)}" ${item.done ? 'checked' : ''}>
    <div class="item-main"><div class="item-name">${escapeHtml(item.name)}</div>${item.detail ? `<div class="item-detail">${escapeHtml(item.detail)}</div>` : ''}${item.date ? `<div class="item-date">📅 ${escapeHtml(formatDate(item.date))}</div>` : ''}</div>
    <button class="delete" type="button" aria-label="Elimina elemento" data-delete="${escapeHtml(item.id)}">×</button></article>`).join('');
  document.querySelectorAll('[data-check]').forEach(input => input.addEventListener('change', () => toggleItem(input.dataset.check, input.checked)));
  document.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => removeItem(button.dataset.delete)));
}
function subscribeItems() {
  clearSubscription();
  const itemsRef = collection(db, 'families', familyId, activeTab);
  setSync(navigator.onLine ? '' : 'offline', navigator.onLine ? 'Collegamento al cloud in corso' : 'Offline · le modifiche si aggiorneranno al ritorno online');
  unsubscribeItems = onSnapshot(itemsRef, { includeMetadataChanges: true }, snapshot => {
    allItems = snapshot.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() })); render();
    setSync(snapshot.metadata.fromCache ? '' : 'online', snapshot.metadata.fromCache ? 'Dati locali · in attesa del cloud' : 'Sincronizzazione cloud attiva');
  }, error => {
    setSync('offline', 'Sincronizzazione non disponibile'); showToast('Errore di sincronizzazione. Controlla la connessione.'); console.error(error);
  });
}
async function toggleItem(id, done) {
  try { await updateDoc(doc(db, 'families', familyId, activeTab, id), { done, updatedAt: serverTimestamp() }); }
  catch (error) { showToast('Non sono riuscito a salvare la modifica.'); console.error(error); }
}
async function removeItem(id) {
  if (!confirm('Eliminare questo elemento?')) return;
  try { await deleteDoc(doc(db, 'families', familyId, activeTab, id)); }
  catch (error) { showToast('Non sono riuscito a eliminare l’elemento.'); console.error(error); }
}
$('#authForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#authSubmit'); button.disabled = true; setMessage('#authMessage');
  const email = $('#email').value.trim().toLowerCase(), password = $('#password').value;
  try {
    if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
    else if (authMode === 'create') {
      const user = auth.currentUser || (await createUserWithEmailAndPassword(auth, email, password)).user;
      if (user.email && user.email.toLowerCase() !== email) throw new Error('Esci e accedi con l’account corretto.');
      const existingProfile = await getDoc(doc(db, 'users', user.uid));
      if (existingProfile.exists() && existingProfile.data().familyId) throw new Error('Questo account è già collegato a una famiglia.');
      const name = $('#familyName').value.trim(); if (!name) throw new Error('Inserisci il nome della famiglia.');
      const familyRef = doc(collection(db, 'families'));
      const userRef = doc(db, 'users', user.uid);
      const batch = writeBatch(db);
      batch.set(familyRef, { name, ownerUid: user.uid, createdAt: serverTimestamp() });
      batch.set(userRef, { familyId: familyRef.id, role: 'owner', email: user.email || email, createdAt: serverTimestamp() });
      await batch.commit();
      await activateProfile(user);
    } else {
      const code = (validInviteCodeFromUrl || $('#inviteCode').value).trim().toUpperCase();
      if (!/^[A-Z0-9]{20,40}$/.test(code)) throw new Error('Il link di invito non è valido. Chiedi a Roberto di crearne uno nuovo.');
      let user = auth.currentUser;
      if (!user) {
        try { user = (await signInWithEmailAndPassword(auth, email, password)).user; }
        catch (error) { if (error.code !== 'auth/user-not-found' && error.code !== 'auth/invalid-credential') throw error; user = (await createUserWithEmailAndPassword(auth, email, password)).user; }
      }
      const inviteRef = doc(db, 'invites', code), profileRef = doc(db, 'users', user.uid);
      await runTransaction(db, async transaction => {
        const invitation = await transaction.get(inviteRef);
        if (!invitation.exists() || invitation.data().status !== 'open') throw new Error('Codice inesistente o già utilizzato.');
        const invite = invitation.data();
        if (invite.expiresAt.toMillis() < Date.now()) throw new Error('Il codice è scaduto. Chiedi un nuovo invito.');
        const profile = await transaction.get(profileRef);
        if (profile.exists() && profile.data().familyId === invite.familyId) throw new Error('Questo account è già collegato a questa famiglia.');
        transaction.update(inviteRef, { status: 'claimed', claimedBy: user.uid });
        if (profile.exists()) {
          transaction.update(profileRef, { familyId: invite.familyId, role: 'member', inviteCode: code });
        } else {
          transaction.set(profileRef, { familyId: invite.familyId, role: 'member', email, inviteCode: code, createdAt: serverTimestamp() });
        }
      });
      await activateProfile(user);
      if (validInviteCodeFromUrl) history.replaceState({}, document.title, location.pathname);
    }
  } catch (error) {
    const messages = {
      'auth/email-already-in-use': 'Questa email ha già un account. Accedi oppure usa quell’account per l’invito.',
      'auth/invalid-credential': 'Email o password non corretti.',
      'auth/weak-password': 'Scegli una password di almeno 8 caratteri.',
      'auth/invalid-email': 'Controlla l’indirizzo email.',
      'auth/too-many-requests': 'Troppi tentativi. Riprova più tardi.',
      'permission-denied': 'Firebase non ha autorizzato il collegamento. Il link potrebbe essere già stato usato o non essere più valido: chiedi a Roberto un nuovo invito.'
    };
    setMessage('#authMessage', messages[error.code] || error.message || 'Non è stato possibile completare l’operazione.');
  } finally { button.disabled = false; }
});
$('#showCreate').addEventListener('click', () => setAuthMode('create'));
$('#showJoin').addEventListener('click', () => setAuthMode('join'));
$('#showLogin').addEventListener('click', () => setAuthMode('login'));
$('#logout').addEventListener('click', async () => { await signOut(auth); });
$('#profileForm').addEventListener('submit', async event => {
  event.preventDefault();
  const displayName = $('#displayName').value.trim();
  if (!currentUser || !familyId) return;
  if (displayName.length > 60) { setMessage('#profileMessage', 'Il nome può contenere al massimo 60 caratteri.'); return; }
  const button = $('#saveDisplayName'); button.disabled = true;
  const uid = currentUser.uid;
  setMessage('#profileMessage', 'Salvataggio in corso…');
  try {
    await updateDoc(doc(db, 'users', uid), { displayName });
    if (currentUser?.uid === uid) setMessage('#profileMessage', 'Nome salvato.');
  } catch (error) {
    if (currentUser?.uid === uid) setMessage('#profileMessage', 'Non riesco a salvare il nome. Controlla la connessione e riprova.');
    console.error(error);
  } finally { button.disabled = false; }
});
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { activeTab = button.dataset.tab; subscribeItems(); render(); }));
$('#addForm').addEventListener('submit', async event => {
  event.preventDefault(); const name = $('#itemName').value.trim(); if (!name || !familyId) return;
  const data = { name, detail: activeTab === 'shopping' || activeTab !== 'notes' ? $('#itemDetail').value.trim() : '', date: sectionNames[activeTab].date ? $('#itemDate').value : '', done: false, createdBy: currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  try { await addDoc(collection(db, 'families', familyId, activeTab), data); event.currentTarget.reset(); $('#itemName').focus(); }
  catch (error) { showToast('Non sono riuscito a salvare. Riprova quando la connessione è attiva.'); console.error(error); }
});
$('#inviteButton').addEventListener('click', () => { $('#inviteResult').classList.add('hidden'); setMessage('#inviteMessage'); $('#inviteDialog').showModal(); });
$('#createInvite').addEventListener('click', async () => {
  const button = $('#createInvite'); button.disabled = true; setMessage('#inviteMessage');
  try {
    const bytes = new Uint8Array(20); crypto.getRandomValues(bytes); const code = Array.from(bytes, value => value.toString(16).padStart(2,'0')).join('').toUpperCase();
    await setDoc(doc(db, 'invites', code), { familyId, createdBy: currentUser.uid, createdAt: serverTimestamp(), expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), status: 'open' });
    const inviteUrl = new URL(location.href);
    inviteUrl.search = '';
    inviteUrl.hash = '';
    inviteUrl.searchParams.set('invite', code);
    $('#inviteCodeOutput').value = code;
    $('#inviteLinkOutput').value = inviteUrl.toString();
    $('#whatsappInviteLink').href = 'https://wa.me/?text=' + encodeURIComponent('Ciao Ele, apri questo link per collegarti direttamente alla famiglia su Registro Famiglia: ' + inviteUrl.toString());
    $('#inviteResult').classList.remove('hidden');
  } catch (error) { setMessage('#inviteMessage', 'Non sono riuscito a creare l’invito. Controlla la connessione.'); console.error(error); }
  finally { button.disabled = false; }
});
$('#copyInviteLink').addEventListener('click', async () => {
  const link = $('#inviteLinkOutput').value;
  try { await navigator.clipboard.writeText(link); showToast('Link copiato. Invialo a Eleonora su WhatsApp.'); }
  catch { $('#inviteLinkOutput').select(); document.execCommand('copy'); showToast('Link selezionato: copialo e invialo a Eleonora.'); }
});
window.addEventListener('online', () => { if (familyId) subscribeItems(); });
window.addEventListener('offline', () => setSync('offline', 'Offline · le modifiche si aggiorneranno al ritorno online'));

if (validInviteCodeFromUrl) {
  $('#inviteCode').value = validInviteCodeFromUrl;
  setAuthMode('join');
  setMessage('#authMessage', 'Invito riconosciuto: inserisci la tua email e password, poi premi Unisciti.');
} else if (inviteCodeFromUrl) {
  setAuthMode('join');
  setMessage('#authMessage', 'Il link contiene un codice non valido. Chiedi a Roberto un nuovo invito.');
}

if (!isFirebaseConfigured) {
  showAuth(); setAuthMode(validInviteCodeFromUrl ? 'join' : 'login'); setMessage('#authMessage', 'Il database online deve ancora essere collegato a questa app.'); $('#authSubmit').disabled = true;
} else {
  const firebaseApp = initializeApp(firebaseConfig); auth = getAuth(firebaseApp); db = getFirestore(firebaseApp);
  setPersistence(auth, browserLocalPersistence).catch(console.error);
  onAuthStateChanged(auth, async user => {
    clearSubscription();
    clearMembersSubscription();
    if (!user) { currentUser = null; familyId = null; showAuth(); return; }
    try {
      const profileSnap = await getDoc(doc(db, 'users', user.uid));
      if (!profileSnap.exists()) { currentUser = user; showAuth(); setAuthMode('join'); setMessage('#authMessage', validInviteCodeFromUrl ? 'Invito riconosciuto. Premi Unisciti per completare il collegamento.' : 'Questo account non è ancora collegato. Usa il link invito ricevuto o inserisci il codice.'); return; }
      if (validInviteCodeFromUrl) {
        currentUser = user;
        showAuth();
        setAuthMode('join');
        setMessage('#authMessage', 'Hai già un account: useremo questo. Premi Unisciti per collegarlo alla famiglia di Roberto.');
        return;
      }
      await activateProfile(user);
    } catch (error) { console.error(error); showAuth(); setMessage('#authMessage', 'Non riesco a leggere il profilo familiare. Controlla database e regole.'); }
  });
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(console.error);
