import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  reload
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

/** ✅ PASTE YOUR REAL firebaseConfig HERE */
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

const $ = (id) => document.getElementById(id);

const screenInvite = $("screenInvite");
const screenAuth   = $("screenAuth");
const screenChat   = $("screenChat");

const inviteErr = $("inviteErr");
const authErr   = $("authErr");

const verifyBox  = $("verifyBox");
const resendBtn  = $("resendBtn");
const verifiedBtn = $("verifiedBtn");

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
const jumpBtn    = $("jumpBtn");

function showOnly(which){
  screenInvite.classList.add("hidden");
  screenAuth.classList.add("hidden");
  screenChat.classList.add("hidden");
  which.classList.remove("hidden");
}

function setVerifyUI(on){
  verifyBox.classList.toggle("hidden", !on);
}

function getInvite(){
  const h = (location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(h);
  return (params.get("invite") || "").trim();
}

function inviteOk(){
  return getInvite() === REQUIRED_INVITE;
}

function fmtTime(ts){
  const d = ts?.toDate?.();
  if (!d) return "";
  return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}

function isNearBottom(el){
  return (el.scrollHeight - el.scrollTop - el.clientHeight) < 160;
}

function scrollToBottom(el){
  el.scrollTop = el.scrollHeight;
}

function setJumpVisible(on){
  jumpBtn.classList.toggle("hidden", !on);
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

/* Invite gate */
if (!inviteOk()){
  showOnly(screenInvite);
  inviteErr.textContent = "Missing/invalid invite link.";
} else {
  showOnly(screenAuth);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* AUTH actions */
googleBtn.onclick = async () => {
  authErr.textContent = "";
  setVerifyUI(false);
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    authErr.textContent = e?.message || "Google sign-in failed.";
  }
};

signUpBtn.onclick = async () => {
  authErr.textContent = "";
  setVerifyUI(false);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);

    // Send verification immediately
    await sendEmailVerification(cred.user);

    authErr.textContent = "Verification email sent. Please verify, then click “I’ve verified”.";
    setVerifyUI(true);
  } catch (e) {
    authErr.textContent = e?.message || "Sign-up failed.";
  }
};

signInBtn.onclick = async () => {
  authErr.textContent = "";
  setVerifyUI(false);
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    authErr.textContent = e?.message || "Sign-in failed.";
  }
};

signOutBtn.onclick = () => signOut(auth);

/* Verification buttons */
resendBtn.onclick = async () => {
  authErr.textContent = "";
  try {
    const user = auth.currentUser;
    if (!user) {
      authErr.textContent = "Sign in first, then resend.";
      return;
    }
    await sendEmailVerification(user);
    authErr.textContent = "Verification email resent. Check your inbox/spam.";
  } catch (e) {
    authErr.textContent = e?.message || "Could not resend email.";
  }
};

verifiedBtn.onclick = async () => {
  authErr.textContent = "";
  try {
    const user = auth.currentUser;
    if (!user) return;

    await reload(user); // refresh emailVerified flag

    if (user.emailVerified) {
      authErr.textContent = "";
      setVerifyUI(false);
      // onAuthStateChanged will handle moving to chat
    } else {
      authErr.textContent = "Still not verified yet. After verifying, try again.";
      setVerifyUI(true);
    }
  } catch (e) {
    authErr.textContent = e?.message || "Could not re-check verification.";
  }
};

/* Chat realtime */
let unsub = null;

onAuthStateChanged(auth, async (user) => {
  // Invite required no matter what
  if (!inviteOk()){
    if (unsub) unsub();
    unsub = null;
    clearMessages();
    setVerifyUI(false);
    showOnly(screenInvite);
    return;
  }

  // Not signed in -> auth screen
  if (!user){
    if (unsub) unsub();
    unsub = null;
    clearMessages();
    setVerifyUI(false);
    showOnly(screenAuth);
    return;
  }

  // Enforce verification for email/password users
  // (Google users are typically already verified)
  if (!user.emailVerified) {
    if (unsub) unsub();
    unsub = null;
    clearMessages();

    showOnly(screenAuth);
    setVerifyUI(true);
    authErr.textContent = "Please verify your email to enter the chat. Then click “I’ve verified”.";
    return;
  }

  // Verified -> chat
  showOnly(screenChat);
  setVerifyUI(false);

  // Username locked to email
  whoEl.textContent = user.email || user.uid;

  if (unsub) unsub();

  const q = query(collection(db, "messages"), orderBy("ts", "asc"), limit(400));

  unsub = onSnapshot(q, (snap) => {
    const shouldAutoScroll = isNearBottom(messagesEl);

    clearMessages();
    snap.forEach((doc) => addMessage(doc.data(), user.uid));

    if (shouldAutoScroll) {
      scrollToBottom(messagesEl);
      setJumpVisible(false);
    } else {
      setJumpVisible(true);
    }
  });
});

/* User scroll: hide jump button when back at bottom */
messagesEl.addEventListener("scroll", () => {
  if (isNearBottom(messagesEl)) setJumpVisible(false);
});

/* Jump button */
jumpBtn.addEventListener("click", () => {
  scrollToBottom(messagesEl);
  setJumpVisible(false);
});

/* Send */
sendForm.onsubmit = async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  // Double check verification before sending
  if (!user.emailVerified) {
    authErr.textContent = "Please verify your email before chatting.";
    showOnly(screenAuth);
    setVerifyUI(true);
    return;
  }

  const text = (msgInput.value || "").trim();
  if (!text) return;

  await addDoc(collection(db, "messages"), {
    uid: user.uid,
    name: user.email || user.uid, // 🔒 locked username
    text: text.slice(0, 400),
    ts: serverTimestamp()
  });

  msgInput.value = "";
  msgInput.focus();
  setTimeout(() => scrollToBottom(messagesEl), 0);
};
