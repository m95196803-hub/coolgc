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

const inviteCard = $("inviteCard");
const authCard   = $("authCard");
const chatCard   = $("chatCard");
const messagesEl = $("messages");

const googleBtn  = $("googleBtn");
const email      = $("email");
const password   = $("password");
const signInBtn  = $("signInBtn");
const signUpBtn  = $("signUpBtn");
const signOutBtn = $("signOutBtn");
const authErr    = $("authErr");
const inviteErr  = $("inviteErr");

const sendForm   = $("sendForm");
const msgInput   = $("msgInput");

function showOnly(el){
  inviteCard.classList.add("hidden");
  authCard.classList.add("hidden");
  chatCard.classList.add("hidden");
  el.classList.remove("hidden");
}

function getInvite(){
  const h = location.hash.replace("#","");
  return new URLSearchParams(h).get("invite");
}

function inviteOk(){
  return getInvite() === REQUIRED_INVITE;
}

function addMessage({text,ts,uid,name}, myUid){
  const row = document.createElement("div");
  row.className = `msgRow ${uid===myUid?"me":"recv"}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${uid===myUid?"me":"recv"}`;

  const n = document.createElement("div");
  n.className = "name";
  n.textContent = name;

  const body = document.createElement("div");
  body.textContent = text;

  const t = document.createElement("div");
  t.className = "time";
  t.textContent = ts?.toDate?.().toLocaleTimeString([],{
    hour:"2-digit",minute:"2-digit"
  }) || "";

  bubble.append(n,body,t);
  row.append(bubble);
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* Invite gate */
if(!inviteOk()){
  showOnly(inviteCard);
}else{
  showOnly(authCard);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* Auth */
googleBtn.onclick = async () => {
  try{await signInWithPopup(auth,new GoogleAuthProvider())}
  catch(e){authErr.textContent=e.message}
};

signUpBtn.onclick = async () => {
  try{await createUserWithEmailAndPassword(auth,email.value,password.value)}
  catch(e){authErr.textContent=e.message}
};

signInBtn.onclick = async () => {
  try{await signInWithEmailAndPassword(auth,email.value,password.value)}
  catch(e){authErr.textContent=e.message}
};

signOutBtn.onclick = ()=>signOut(auth);

/* Chat */
let unsub=null;
onAuthStateChanged(auth,user=>{
  if(!user){showOnly(authCard);return}
  showOnly(chatCard);

  if(unsub)unsub();
  const q=query(collection(db,"messages"),orderBy("ts"),limit(200));
  unsub=onSnapshot(q,s=>{
    messagesEl.innerHTML="";
    s.forEach(d=>addMessage(d.data(),user.uid));
  });
});

sendForm.onsubmit = async e=>{
  e.preventDefault();
  if(!auth.currentUser)return;
  const text=msgInput.value.trim();
  if(!text)return;

  await addDoc(collection(db,"messages"),{
    uid:auth.currentUser.uid,
    name:auth.currentUser.email,   // 🔒 username = email
    text,
    ts:serverTimestamp()
  });

  msgInput.value="";
};
