// ------------------- FIREBASE IMPORTS & INIT -------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDcfDRwuNf6bO5URcbs0hYeWFgcZcY2Bs",
  authDomain: "level21stp.firebaseapp.com",
  projectId: "level21stp",
  storageBucket: "level21stp.appspot.com",
  messagingSenderId: "407052305075",
  appId: "1:407052305075:web:8ccaaf70294c54631826c6",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ------------------- TOAST & LOADER -------------------
const toast = (msg, color = "green") => {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.style.backgroundColor = color;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
};

const loader = (show, msg = "Loading...") => {
  const l = document.getElementById("loader");
  if (!l) return;
  l.style.display = show ? "flex" : "none";
  l.textContent = show ? msg : "";
};

// ------------------- SIGNUP -------------------
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value.trim();
    const role = document.getElementById("userRole").value;

    if (!email || !password || !role) {
      toast("Please fill all fields!", "red");
      return;
    }

    loader(true, "Creating account...");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email,
        role,
        createdAt: new Date().toISOString(),
      });

      toast("Account created successfully!", "green");
      signupForm.reset();
      setTimeout(() => (window.location.href = "login.html"), 1500);
    } catch (err) {
      toast(err.message, "red");
    } finally {
      loader(false);
    }
  });
}

// ------------------- LOGIN -------------------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
      toast("Please enter email and password!", "red");
      return;
    }

    loader(true, "Signing in...");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast("Login successful!", "green");
      loginForm.reset();
      setTimeout(() => (window.location.href = "dashboard.html"), 1000);
    } catch (err) {
      toast(err.message, "red");
    } finally {
      loader(false);
    }
  });
}

// ------------------- DASHBOARD / AUTH -------------------
const dashboard = document.getElementById("dashboardPage");
if (dashboard) {
  loader(true, "Loading dashboard...");

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let role = "";
    if (userSnap.exists()) {
      const userData = userSnap.data();
      document.getElementById("userEmail").textContent = userData.email;
      document.getElementById("userRole").textContent = userData.role;
      role = userData.role;
    } else {
      toast("User data not found!", "red");
      console.warn("⚠️ No user document found for UID:", user.uid);
    }

    const postForm = document.getElementById("postForm");
    if (postForm) postForm.style.display = role === "giver" ? "block" : "none";

    await loadPosts();
    await loadMyRequests();
    await updateStats();

    loader(false);
  });
}

// ------------------- STATS -------------------
async function updateStats() {
  const totalSharedEl = document.getElementById("totalShared");
  const totalHelpedEl = document.getElementById("totalHelped");
  if (!totalSharedEl || !totalHelpedEl) return;

  const postsSnapshot = await getDocs(collection(db, "posts"));
  const posts = postsSnapshot.docs.map(d => d.data());

  totalSharedEl.textContent = posts.length;
  totalHelpedEl.textContent = posts.filter(p => p.requestedBy).length;
}

// ------------------- LOAD POSTS -------------------
async function loadPosts() {
  const postList = document.getElementById("postList");
  if (!postList) return;
  postList.innerHTML = "";

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const postsSnapshot = await getDocs(collection(db, "posts"));
  if (postsSnapshot.empty) {
    postList.innerHTML = `<li class="list-group-item text-muted">No food posts yet.</li>`;
    return;
  }

  postsSnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const li = document.createElement("li");
    li.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");

    let buttonHTML = "";
    const isGiver = document.getElementById("postForm").style.display !== "none";

    if (isGiver && data.sharedBy === currentUser.email) {
      buttonHTML = `<button class="btn btn-danger btn-sm delete-btn" data-id="${docSnap.id}">Delete</button>`;
    } else if (!isGiver) {
      if (!data.requestedBy) {
        buttonHTML = `<button class="btn btn-success btn-sm request-btn" data-id="${docSnap.id}">Request</button>`;
      } else if (data.requestedBy === currentUser.email) {
        buttonHTML = `<button class="btn btn-secondary btn-sm" disabled>Requested</button>`;
      } else {
        buttonHTML = `<button class="btn btn-outline-secondary btn-sm" disabled>Already Requested</button>`;
      }
    }

    li.innerHTML = `
      <div>
        <strong>${data.foodName}</strong> - ${data.location}
        <br><small>Shared by: ${data.sharedBy}</small>
        ${data.requestedBy ? `<br><small>Requested by: ${data.requestedBy}</small>` : ""}
      </div>
      ${buttonHTML}
    `;

    postList.appendChild(li);
  });

  // Request button
  document.querySelectorAll(".request-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const postId = e.target.dataset.id;
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, { requestedBy: auth.currentUser.email });
      toast("Food requested successfully!", "green");
      await loadPosts();
      await loadMyRequests();
      await updateStats();
    });
  });

  // Delete button
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.dataset.id;
      showDeleteModal(id);
    });
  });

  await updateStats();
}

// ------------------- LOAD MY REQUESTS -------------------
async function loadMyRequests() {
  const myRequests = document.getElementById("myRequests");
  if (!myRequests) return;
  myRequests.innerHTML = "";

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const q = query(collection(db, "posts"), where("requestedBy", "==", currentUser.email));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    myRequests.innerHTML = `<li class="list-group-item text-muted">No requests yet.</li>`;
    return;
  }

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const li = document.createElement("li");
    li.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
    li.innerHTML = `
      <div>
        <strong>${data.foodName}</strong> - ${data.location}
        <br><small>Shared by: ${data.sharedBy}</small>
      </div>
      <button class="btn btn-warning btn-sm cancel-btn" data-id="${docSnap.id}">Cancel</button>
    `;
    myRequests.appendChild(li);
  });

  document.querySelectorAll(".cancel-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const postId = e.target.dataset.id;
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, { requestedBy: deleteField() });
      toast("Request cancelled.", "orange");
      await loadPosts();
      await loadMyRequests();
      await updateStats();
    });
  });
}

// ------------------- LOGOUT -------------------
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// ------------------- DELETE MODAL -------------------
function showDeleteModal(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;
  deleteDoc(doc(db, "posts", postId));
  toast("Post deleted.", "red");
  loadPosts();
  updateStats();
}

// ------------------- SHARE FOOD -------------------
const postForm = document.getElementById("postForm");
if (postForm) {
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const foodName = document.getElementById("foodName").value.trim();
    const location = document.getElementById("foodLocation").value.trim();
    const sharedBy = auth.currentUser.email;

    if (!foodName || !location) {
      toast("Please fill all fields!", "red");
      return;
    }

    loader(true, "Sharing food...");
    await addDoc(collection(db, "posts"), { foodName, location, sharedBy });
    toast("Food shared successfully!", "green");
    postForm.reset();
    await loadPosts();
    await updateStats();
    loader(false);
  });
}
