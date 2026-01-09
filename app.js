import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/** 1) PASTE YOUR firebaseConfig BETWEEN THE BRACES */
const firebaseConfig = {
  apiKey: "AIzaSyCPOrxuMh2TqmY7JI4Pky-4VtWwEg5qN7A",
  authDomain: "coolgc-e5af0.firebaseapp.com",
  projectId: "coolgc-e5af0",
  storageBucket: "coolgc-e5af0.firebasestorage.app",
  messagingSenderId: "99545732120",
  appId: "1:99545732120:web:2486fbe2f4439d8498df6d",
  measurementId: "G-VJC07ML3K9"
};

/** 2) SET YOUR INVITE SECRET (used in the URL hash) */
const REQUIRED_INVITE = "friends2026"; // <-- change this to your secret

const $ = (id) => document.getElementById(id);

const inviteCard = $("inviteCard");
const inviteErr  = $("inviteErr");
const authCard   = $("authCard");
const chatCard   = $("chatCard");

const googleBtn  = $("googleBtn");
const email      = $("email");
const password   = $("password");
const signInBtn  = $("signInBtn");
const signUpBtn  = $("signUpBtn");
const authErr    = $("authErr");

const who        = $("who");
const signOutBtn = $("signOutBtn");

const displayName = $("displayName");
const messagesEl  = $("messages");
const sendForm    = $("sendForm");
const msgInput    = $("msgInput");
const sendBtn     = $("sendBtn");

function showInviteError(msg){ inviteErr.textContent = msg || ""; }
function showAuthError(msg){ authErr.textContent = msg || ""; }

function showOnly(which){
  inviteCard.classList.add("hidden");
  authCard.classList.add("hidden");
  chatCard.classList.add("hidden");
  which.classList.remove("hidden");
}

function safeName(v){
  return (v || "").trim().replace(/\s+/g, " ").slice(0, 20);
}

function getInviteFromHash(){
  // expects URL like: https://site/#invite=party123
  const h = (location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(h);
  return (params.get("invite") || "").trim();
}

function inviteOk(){
  return getInviteFromHash() === REQUIRED_INVITE;
}

function fmtTime(date){
  try {
    return new Intl.DateTimeFormat(undefined, { hour:"2-digit", minute:"2-digit" }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

function clearMessages(){ messagesEl.innerHTML = ""; }

function addMessage({name,text,ts,uid}, myUid){
  const wrap = document.createElement("div");
  wrap.className = `msg ${uid === myUid ? "me" : ""}`;

  const top = document.createElement("div");
  top.className = "row2";

  const n = document.createElement("div");
  n.className = "name";
  n.textContent = name;

  const t = document.createElement("div");
  t.className = "time";
  t.textContent = ts ? fmtTime(ts) : "";

  const body = document.createElement("div");
  body.className = "text";
  body.textContent = text;

  top.appendChild(n);
  top.appendChild(t);
  wrap.appendChild(top);
  wrap.appendChild(body);
  messagesEl.appendChild(wrap);

  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 180;
  if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function validateConfig(){
  return !!(firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.appId);
}

// Invite gate check (UI-only)
if (!inviteOk()){
  showOnly(inviteCard);
  showInviteError("Missing/invalid invite link. Use the link you were given.");
} else {
  showOnly(authCard);
}

if (!validateConfig()){
  showAuthError("Paste your firebaseConfig into app.js (top of file).");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let unsubMessages = null;

// Prefill chat name if previously set
displayName.value = safeName(localStorage.getItem("chat_display_name") || "");

// Save chat name as you type
displayName.addEventListener("input", () => {
  localStorage.setItem("chat_display_name", safeName(displayName.value));
});

// AUTH UI
googleBtn.addEventListener("click", async () => {
  showAuthError("");
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
    showAuthError("Google sign-in failed. Check Authorized domains + popup blocking.");
  }
});

signUpBtn.addEventListener("click", async () => {
  showAuthError("");
  try {
    await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    console.error(e);
    showAuthError(e?.message || "Sign-up failed.");
  }
});

signInBtn.addEventListener("click", async () => {
  showAuthError("");
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    console.error(e);
    showAuthError(e?.message || "Sign-in failed.");
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Realtime listener (ONE ROOM = one "messages" collection)
onAuthStateChanged(auth, (user) => {
  if (!inviteOk()){
    // If they remove the invite hash, kick them back to invite screen
    showOnly(inviteCard);
    if (unsubMessages) unsubMessages();
    unsubMessages = null;
    clearMessages();
    return;
  }

  if (!user){
    showOnly(authCard);
    who.textContent = "";
    if (unsubMessages) unsubMessages();
    unsubMessages = null;
    clearMessages();
    return;
  }

  showOnly(chatCard);
  who.textContent = user.email || user.displayName || user.uid;

  // Ensure a default chat name
  if (!safeName(displayName.value)) {
    const defaultName = safeName(user.displayName || user.email?.split("@")[0] || "Friend");
    displayName.value = defaultName;
    localStorage.setItem("chat_display_name", defaultName);
  }

  if (unsubMessages) unsubMessages();

  const q = query(collection(db, "messages"), orderBy("ts", "asc"), limit(200));
  unsubMessages = onSnapshot(q, (snap) => {
    clearMessages();
    snap.docs.forEach(d => {
      const m = d.data();
      addMessage({
        name: m.name,
        text: m.text,
        uid: m.uid,
        ts: m.ts?.toDate ? m.ts.toDate() : null
      }, user.uid);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, (err) => {
    console.error(err);
    showAuthError("Firestore read failed. Check Firestore rules + Auth sign-in.");
    showOnly(authCard);
  });
});

// SEND
sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  if (!inviteOk()){
    showOnly(inviteCard);
    showInviteError("Invite link missing/invalid.");
    return;
  }

  const name = safeName(displayName.value) || "Friend";
  const text = (msgInput.value || "").trim().slice(0, 400);
  if (!text) return;

  sendBtn.disabled = true;
  setTimeout(() => (sendBtn.disabled = false), 600);

  try {
    await addDoc(collection(db, "messages"), {
      uid: user.uid,
      name,
      text,
      ts: serverTimestamp()
    });
    msgInput.value = "";
    msgInput.focus();
  } catch (err) {
    console.error(err);
    showAuthError("Send failed. Check Firestore rules.");
  }
});
