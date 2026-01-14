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

/* 🔴 YOUR REAL CONFIG */
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
const APP_TITLE = "TheGC";

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

const whoEl      = $("who");
const messagesEl = $("messages");
const sendForm   = $("sendForm");
const msgInput   = $("msgInput");

let unreadCount = 0;
let lastSeenTs = null;

/* ---------- helpers ---------- */
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

function isNearBottom(){
  return (messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight) < 120;
}

function scrollToBottom(){
  messagesEl.scrollTop = messagesEl.scrollHeight;
  clearUnread();
}

function updateTitle(){
  document.title = unreadCount > 0
    ? `New Tab (${unreadCount})`
    : APP_TITLE;
}

function clearUnread(){
  unreadCount = 0;
  updateTitle();
}

/* ---------- UI ---------- */
function addMessage({ text, ts, uid, name }, myUid){
  const row = document.createElement("div");
  row.className = `msgRow ${uid === myUid ? "me" : "recv"}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${uid === myUid ? "me" : "recv"}`;

  bubble.innerHTML = `
    <div class="name">${name}</div>
    <div>${text}</div>
    <div class="time">${ts?.toDate?.().toLocaleTimeString([],{
      hour:"2-digit",minute:"2-digit"
    }) || ""}</div>
  `;

  row.appendChild(bubble);
  messagesEl.appendChild(row);
}

/* ---------- Invite gate ---------- */
if (!inviteOk()){
  showOnly(screenInvite);
  inviteErr.textContent = "Missing or invalid invite link.";
} else {
  showOnly(screenAuth);
}

/* ---------- Firebase ---------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- Auth ---------- */
googleBtn.onclick = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch(e){ authErr.textContent = e.message; }
};

signUpBtn.onclick = async () => {
  try {
    await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch(e){
    authErr.textContent = e.message;
  }
};

signInBtn.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch(e){
    authErr.textContent = e.message;
  }
};

signOutBtn.onclick = () => signOut(auth);

/* ---------- Chat ---------- */
let unsub = null;

onAuthStateChanged(auth, (user) => {
  if (!inviteOk()){
    showOnly(screenInvite);
    return;
  }

  if (!user){
    showOnly(screenAuth);
    return;
  }

  showOnly(screenChat);
  whoEl.textContent = user.email;
  document.title = APP_TITLE;

  if (unsub) unsub();

  const q = query(collection(db,"messages"), orderBy("ts"), limit(400));
  unsub = onSnapshot(q, snap => {
    const atBottom = isNearBottom();
    messagesEl.innerHTML = "";

    snap.forEach(doc => {
      const data = doc.data();
      addMessage(data, user.uid);

      if (
        data.uid !== user.uid &&
        data.ts &&
        (!atBottom || document.hidden) &&
        (!lastSeenTs || data.ts.toMillis() > lastSeenTs)
      ){
        unreadCount++;
      }
    });

    if (atBottom){
      scrollToBottom();
    }

    updateTitle();

    const last = snap.docs.at(-1)?.data()?.ts;
    if (last) lastSeenTs = last.toMillis();
  });
});

/* ---------- Send ---------- */
sendForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!auth.currentUser) return;

  const text = msgInput.value.trim();
  if (!text) return;

  await addDoc(collection(db,"messages"),{
    uid:auth.currentUser.uid,
    name:auth.currentUser.email,
    text,
    ts:serverTimestamp()
  });

  msgInput.value="";
  scrollToBottom();
};

/* ---------- Focus / scroll handling ---------- */
messagesEl.addEventListener("scroll", () => {
  if (isNearBottom()) clearUnread();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) clearUnread();
});
