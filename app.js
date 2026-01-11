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

/* 🔴 PASTE YOUR REAL CONFIG HERE */
const firebaseConfig = {
  apiKey: "AIzaSyCPOrxuMh2TqmY7JI4Pky-4VtWwEg5qN7A",
  authDomain: "coolgc-e5af0.firebaseapp.com",
  projectId: "coolgc-e5af0",
  storageBucket: "coolgc-e5af0.firebasestorage.app",
  messagingSenderId: "99545732120",
  appId: "1:99545732120:web:2486fbe2f4439d8498df6d",
  measurementId: "G-VJC07ML3K9"
};

const REQUIRED_INVITE = "friends2026";

const $ = id => document.getElementById(id);

const screenInvite = $("screenInvite");
const screenAuth   = $("screenAuth");
const screenChat   = $("screenChat");

const inviteErr = $("inviteErr");
const authErr   = $("authErr");

const googleBtn = $("googleBtn");
const email     = $("email");
const password  = $("password");
const signInBtn = $("signInBtn");
const signUpBtn = $("signUpBtn");
const signOutBtn = $("signOutBtn");

const whoEl = $("who");
const messagesEl = $("messages");
const sendForm = $("sendForm");
const msgInput = $("msgInput");
const jumpBtn = $("jumpBtn");

function showOnly(el){
  screenInvite.classList.add("hidden");
  screenAuth.classList.add("hidden");
  screenChat.classList.add("hidden");
  el.classList.remove("hidden");
}

function getInvite(){
  const h = (location.hash || "").replace(/^#/, "");
  return new URLSearchParams(h).get("invite");
}

function inviteOk(){
  return getInvite() === REQUIRED_INVITE;
}

function fmtTime(ts){
  const d = ts?.toDate?.();
  return d
    ? d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
    : "";
}

function isNearBottom(el){
  return (el.scrollHeight - el.scrollTop - el.clientHeight) < 160;
}

function scrollToBottom(){
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearMessages(){
  messagesEl.innerHTML = "";
}

function addMessage({ text, ts, uid, name }, myUid){
  const mine = uid === myUid;

  const row = document.createElement("div");
  row.className = `msgRow ${mine ? "me" : "recv"}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${mine ? "me" : "recv"}`;

  const n = document.createElement("div");
  n.className = "name";
  n.textContent = name;

  const body = document.createElement("div");
  body.textContent = text;

  const t = document.createElement("div");
  t.className = "time";
  t.textContent = fmtTime(ts);

  bubble.append(n, body, t);
  row.append(bubble);
  messagesEl.append(row);
}

/* 🚨 INVITE GATE — FIXED */
if (!inviteOk()){
  showOnly(screenInvite);
  inviteErr.textContent = "Missing or invalid invite link.";
} else {
  // VALID invite → go straight to AUTH
  showOnly(screenAuth);
}

/* Firebase init */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* AUTH */
googleBtn.onclick = async () => {
  authErr.textContent = "";
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    authErr.textContent = e?.message || "Google sign-in failed.";
  }
};

signUpBtn.onclick = async () => {
  authErr.textContent = "";
  try {
    await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    authErr.textContent = e?.message || "Sign-up failed.";
  }
};

signInBtn.onclick = async () => {
  authErr.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    authErr.textContent = e?.message || "Sign-in failed.";
  }
};

signOutBtn.onclick = () => signOut(auth);

/* CHAT */
let unsub = null;

onAuthStateChanged(auth, (user) => {
  if (!inviteOk()){
    if (unsub) unsub();
    clearMessages();
    showOnly(screenInvite);
    return;
  }

  if (!user){
    if (unsub) unsub();
    clearMessages();
    showOnly(screenAuth);
    return;
  }

  showOnly(screenChat);
  whoEl.textContent = user.email;

  if (unsub) unsub();

  const q = query(collection(db, "messages"), orderBy("ts", "asc"), limit(400));

  unsub = onSnapshot(q, (snap) => {
    const autoScroll = isNearBottom(messagesEl);
    clearMessages();
    snap.forEach(d => addMessage(d.data(), user.uid));
    if (autoScroll) scrollToBottom();
  });
});

/* SEND */
sendForm.onsubmit = async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const text = msgInput.value.trim();
  if (!text) return;

  await addDoc(collection(db, "messages"), {
    uid: user.uid,
    name: user.email, // 🔒 username locked to email
    text,
    ts: serverTimestamp()
  });

  msgInput.value = "";
  scrollToBottom();
};
