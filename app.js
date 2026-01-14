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
const APP_NAME = "TheGC";

const $ = id => document.getElementById(id);

const screenInvite = $("screenInvite");
const screenAuth   = $("screenAuth");
const screenChat   = $("screenChat");

const inviteErr = $("inviteErr");
const authErr   = $("authErr");

const googleBtn  = $("googleBtn");
const email      = $("email");
const password   = $("password");
const signInBtn  = $("signInBtn");
const signUpBtn  = $("signUpBtn");
const signOutBtn = $("signOutBtn");

const whoEl      = $("who");
const messagesEl = $("messages");
const sendForm   = $("sendForm");
const msgInput   = $("msgInput");

function showOnly(el){
  screenInvite.classList.add("hidden");
  screenAuth.classList.add("hidden");
  screenChat.classList.add("hidden");
  el.classList.remove("hidden");
}

function getInvite(){
  return new URLSearchParams(location.hash.replace("#","")).get("invite");
}
function inviteOk(){
  return getInvite() === REQUIRED_INVITE;
}

function isNearBottom(el){
  return (el.scrollHeight - el.scrollTop - el.clientHeight) < 160;
}
function scrollToBottom(){
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function fmtTime(ts){
  const d = ts?.toDate?.();
  return d ? d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";
}

/* ---------------- Desktop Notifications ---------------- */
function canNotify(){
  return "Notification" in window;
}

// Ask permission only during a user click (browsers require this)
async function requestNotifyPermission(){
  if (!canNotify()) return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch {}
  }
}

// Notify when you are not actively looking at the page
function shouldNotifyNow(){
  // notify if tab is hidden OR window not focused
  return document.hidden || !document.hasFocus();
}

function showDesktopNotification(title, body){
  if (!canNotify()) return;
  if (Notification.permission !== "granted") return;
  if (!shouldNotifyNow()) return;

  try {
    const n = new Notification(title, {
      body,
      tag: "thegc-new-message", // replaces previous notif instead of spamming
      silent: false
    });

    n.onclick = () => {
      try { window.focus(); } catch {}
      n.close();
    };
  } catch {}
}

/* ---------------- UI Rendering ---------------- */
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
  row.appendChild(bubble);
  messagesEl.appendChild(row);
}

/* ---------------- Invite Gate ---------------- */
if (!inviteOk()){
  showOnly(screenInvite);
  inviteErr.textContent = "Missing or invalid invite link.";
} else {
  showOnly(screenAuth);
}

/* ---------------- Firebase ---------------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------------- Auth ---------------- */
googleBtn.onclick = async () => {
  authErr.textContent = "";
  await requestNotifyPermission();
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    authErr.textContent = e?.message || "Google sign-in failed.";
  }
};

signUpBtn.onclick = async () => {
  authErr.textContent = "";
  await requestNotifyPermission();
  try {
    await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    authErr.textContent = e?.message || "Sign-up failed.";
  }
};

signInBtn.onclick = async () => {
  authErr.textContent = "";
  await requestNotifyPermission();
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    authErr.textContent = e?.message || "Sign-in failed.";
  }
};

signOutBtn.onclick = () => signOut(auth);

/* ---------------- Chat ---------------- */
let unsub = null;
let haveLoadedOnce = false;

// prevent duplicate notifications across snapshots
const notifiedIds = new Set();

onAuthStateChanged(auth, (user) => {
  if (!inviteOk()){
    if (unsub) unsub();
    unsub = null;
    showOnly(screenInvite);
    return;
  }

  if (!user){
    if (unsub) unsub();
    unsub = null;
    showOnly(screenAuth);
    return;
  }

  showOnly(screenChat);
  whoEl.textContent = user.email;

  if (unsub) unsub();

  const q = query(collection(db, "messages"), orderBy("ts"), limit(400));
  unsub = onSnapshot(q, (snap) => {
    const atBottom = isNearBottom(messagesEl);

    // Notify only after initial load, and only for real remote adds
    if (haveLoadedOnce) {
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;

        // Ignore local pending writes (your own sends)
        if (ch.doc.metadata.hasPendingWrites) continue;

        // Avoid duplicates
        if (notifiedIds.has(ch.doc.id)) continue;
        notifiedIds.add(ch.doc.id);

        const m = ch.doc.data();

        // Only notify for other people's messages
        if (m.uid !== user.uid) {
          showDesktopNotification(APP_NAME, `${m.name}: ${m.text}`);
        }
      }
    }

    // Re-render UI
    messagesEl.innerHTML = "";
    snap.forEach(d => addMessage(d.data(), user.uid));

    // Auto-scroll if user was already near bottom
    if (atBottom) scrollToBottom();

    haveLoadedOnce = true;

    // keep the set from growing forever
    if (notifiedIds.size > 1000) {
      notifiedIds.clear();
    }
  });
});

/* ---------------- Send ---------------- */
sendForm.onsubmit = async (e) => {
  e.preventDefault();

  // In case you were already signed in and never clicked a sign-in button:
  await requestNotifyPermission();

  const user = auth.currentUser;
  if (!user) return;

  const text = msgInput.value.trim();
  if (!text) return;

  await addDoc(collection(db, "messages"), {
    uid: user.uid,
    name: user.email,
    text: text.slice(0, 400),
    ts: serverTimestamp()
  });

  msgInput.value = "";
  scrollToBottom();
};
