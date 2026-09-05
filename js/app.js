/* ==========================================================================
   AL-MUALIJ CLINIC - PATIENT PORTAL APPLICATION LOGIC
   SPA Screen Transitions, Firebase Auth & Cooldown, 16 Form Fields,
   Background Blur, Scroll Lock & Responsive Layout
   ========================================================================== */

// 16 Form Fields Schema
const N8N_PRODUCTION_WEBHOOK_URL = "https://white7319.app.n8n.cloud/webhook/bec6264f-d14f-4efb-ba09-5a06a06f202f";

const INPUT_FIELDS_JSON = [
  { "id": "mrNumber", "label": "MR #", "type": "text", "required": true },
  { "id": "patientName", "label": "Name", "type": "text", "required": true },
  { "id": "fatherName", "label": "Father Name", "type": "text", "required": true },
  { "id": "visitNumber", "label": "Visit #", "type": "number", "required": true },
  { "id": "age", "label": "Age", "type": "number", "required": true },
  { "id": "gender", "label": "Gender", "type": "select", "options": ["Male", "Female", "Other"], "required": true },
  { "id": "cnic", "label": "CNIC", "type": "text", "digitsOnly": true, "fixedLength": 13, "required": true },
  { "id": "contact", "label": "Contact", "type": "tel", "digitsOnly": true, "required": true },
  { "id": "address", "label": "Address", "type": "text", "required": true },
  { "id": "diagnosis", "label": "Diagnosis", "type": "textarea", "uncapped": true, "required": true },
  { "id": "treatment", "label": "Treatment", "type": "textarea", "uncapped": true, "required": true },
  { "id": "consultationPrice", "label": "Consultation", "type": "text", "digitsOnly": true, "required": true },
  { "id": "servicesPrice", "label": "Services", "type": "text", "digitsOnly": true, "required": true },
  { "id": "medicinePrice", "label": "Medicine price", "type": "text", "digitsOnly": true, "required": true },
  { "id": "totalPrice", "label": "Total", "type": "text", "digitsOnly": true, "required": true },
  { "id": "enteredBy", "label": "Entered by", "type": "text", "required": true }
];

// App State
const AppState = {
  currentScreen: 1,
  activeUser: null,
  appointments: [],
  cooldownTimerInterval: null
};

// Security Constants
const MAX_LOGIN_ATTEMPTS = 5;
const COOLDOWN_DURATION_MS = 60 * 1000; // 60 seconds

// DOM Content Loaded Initialization
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  // 1. Initialize Firebase Bridge
  if (window.AlMualijFirebase && window.AlMualijFirebase.init) {
    window.AlMualijFirebase.init();
  }

  // 2. Load the stored active user session
  loadSavedState();

  // 3. Set minimum date for appointment picker to today
  setupDateConstraints();

  // 4. Attach Event Listeners
  setupNavigationListeners();
  setupAuthListeners();
  setupAppointmentFormListeners();
  setupChatbotGuide();

  // 5. Initialize Cooldown state if any
  checkAndApplyCooldown();

  // 6. Initial render of Dashboard screen
  renderDashboard();

  // 7. Navigate to initial screen
  navigateToScreen(1);
}

/* ==========================================================================
   STATE MANAGEMENT & LOCAL SYNC
   ========================================================================== */
function loadSavedState() {
  if (window.AlMualijFirebase && window.AlMualijFirebase.localStore) {
    AppState.activeUser = window.AlMualijFirebase.localStore.getCurrentUser();
  }

  // Sync Firebase Auth current user if already signed in
  if (typeof firebase !== "undefined" && firebase.auth) {
    try {
      firebase.auth().onAuthStateChanged((user) => {
        if (user && !AppState.activeUser) {
          const syncedUser = {
            id: user.uid,
            email: user.email,
            fullName: user.displayName || user.email.split("@")[0],
            phone: ""
          };
          AppState.activeUser = syncedUser;
          if (window.AlMualijFirebase && window.AlMualijFirebase.localStore) {
            window.AlMualijFirebase.localStore.setCurrentUser(syncedUser);
          }
          updateHeaderState(AppState.currentScreen);
        }
      });
    } catch (e) {
      console.warn("Firebase Auth listener notice:", e);
    }
  }
}

function setupDateConstraints() {
  const dateInput = document.getElementById("appointmentDate");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.min = today;
    if (!dateInput.value) {
      dateInput.value = today;
    }
  }
}

/* ==========================================================================
   SCREEN NAVIGATION (SPA ROUTER) WITH BACKGROUND BLUR & SCROLL LOCK
   ========================================================================== */
function navigateToScreen(screenNumber) {
  const allScreens = document.querySelectorAll(".screen");
  const screen1 = document.getElementById("screen-1");
  const screen2 = document.getElementById("screen-2");
  const screen3 = document.getElementById("screen-3");
  const screen4 = document.getElementById("screen-4");

  // Reset scroll lock and blur layers first
  allScreens.forEach(s => s.classList.remove("screen-blurred"));
  document.body.classList.remove("body-unscrollable");

  if (screenNumber === 1) {
    // Landing Screen Active
    allScreens.forEach(s => {
      s.classList.remove("active", "overlay-screen");
    });
    if (screen1) screen1.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });

  } else if (screenNumber === 2) {
    // Auth Screen opens as an overlay over Screen 1
    // Screen 1 in background is blurred and unscrollable
    if (screen1) {
      screen1.classList.add("active", "screen-blurred");
    }
    if (screen3) screen3.classList.remove("active");
    if (screen4) screen4.classList.remove("active", "overlay-screen");

    if (screen2) {
      screen2.classList.add("active", "overlay-screen");
      screen2.scrollTop = 0;
    }
    document.body.classList.add("body-unscrollable");

    // Check cooldown state upon opening login screen
    checkAndApplyCooldown();

  } else if (screenNumber === 3) {
    // Patient Dashboard Active
    allScreens.forEach(s => {
      s.classList.remove("active", "overlay-screen", "screen-blurred");
    });
    if (screen3) screen3.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderDashboard();

  } else if (screenNumber === 4) {
    // Appointment / Intake Form opens as an overlay over Dashboard
    // Dashboard (Screen 3) is blurred and unscrollable
    if (screen3) {
      screen3.classList.add("active", "screen-blurred");
    }
    if (screen1) screen1.classList.remove("active");
    if (screen2) screen2.classList.remove("active", "overlay-screen");

    if (screen4) {
      screen4.classList.add("active", "overlay-screen");
      screen4.scrollTop = 0;
    }
    document.body.classList.add("body-unscrollable");

    // Pre-fill fields if user is logged in
    if (AppState.activeUser) {
      prefillAppointmentForm(AppState.activeUser);
    }
  }

  AppState.currentScreen = screenNumber;
  updateHeaderState(screenNumber);
}

function updateHeaderState(screenNumber) {
  const userBadge = document.getElementById("headerUserBadge");
  const signOutBtn = document.getElementById("headerSignOutBtn");

  if (AppState.activeUser && screenNumber >= 3) {
    if (userBadge) {
      userBadge.style.display = "inline-flex";
      userBadge.textContent = AppState.activeUser.fullName || AppState.activeUser.name || "Patient";
    }
    if (signOutBtn) signOutBtn.style.display = "inline-flex";
  } else {
    if (userBadge) userBadge.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "none";
  }
}

function setupNavigationListeners() {
  // Brand Click -> Return to Hero or Dashboard
  const brandLogo = document.getElementById("brandNavHome");
  if (brandLogo) {
    brandLogo.addEventListener("click", () => {
      if (AppState.activeUser) {
        navigateToScreen(3);
      } else {
        navigateToScreen(1);
      }
    });
  }

  // Screen 1 Hero -> "Get Started"
  const heroGetStartedBtn = document.getElementById("heroGetStartedBtn");
  if (heroGetStartedBtn) {
    heroGetStartedBtn.addEventListener("click", () => {
      if (AppState.activeUser) {
        navigateToScreen(3);
      } else {
        navigateToScreen(2);
      }
    });
  }

  // Screen 2 Auth -> Return to Landing
  const authBackBtn = document.getElementById("authBackToLandingBtn");
  if (authBackBtn) {
    authBackBtn.addEventListener("click", () => {
      navigateToScreen(1);
    });
  }

  // Screen 3 Dashboard -> "Schedule an Appointment"
  const dashboardBookBtn = document.getElementById("dashboardBookBtn");
  if (dashboardBookBtn) {
    dashboardBookBtn.addEventListener("click", () => {
      navigateToScreen(4);
    });
  }

  // Screen 4 Form -> "Cancel" / Back to Dashboard
  const backToDashboardBtn = document.getElementById("backToDashboardBtn");
  if (backToDashboardBtn) {
    backToDashboardBtn.addEventListener("click", () => {
      navigateToScreen(3);
    });
  }

  // Header Sign Out
  const signOutBtn = document.getElementById("headerSignOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      handleSignOut();
    });
  }
}

function setupChatbotGuide() {
  const modal = document.getElementById("chatbotModalOverlay");
  const openButtons = [
    document.getElementById("dashboardOpenChatbotBtn"),
    document.getElementById("formChatbotRedirectBtn"),
    document.getElementById("chatbotFloatingBtn")
  ].filter(Boolean);
  const closeButton = document.getElementById("closeChatbotModalBtn");

  const openBotpressChat = () => {
    if (window.botpress && typeof window.botpress.open === "function") {
      window.botpress.open();
      return;
    }

    showToast("The appointment assistant is still loading. Please try again shortly.", "info");
  };

  if (!modal && openButtons.length === 0) return;

  const closeGuide = () => {
    modal.classList.remove("active");
    document.body.classList.remove("body-unscrollable");
  };

  openButtons.forEach(button => {
    button.addEventListener("click", openBotpressChat);
  });

  if (modal) {
    if (closeButton) closeButton.addEventListener("click", closeGuide);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeGuide();
    });
  }

  ["chatOptSchedule", "chatOptReschedule", "chatOptCancel"].forEach(optionId => {
    const option = document.getElementById(optionId);
    if (option) {
      option.addEventListener("click", openBotpressChat);
    }
  });
}

function handleSignOut() {
  if (typeof firebase !== "undefined" && firebase.auth) {
    try {
      firebase.auth().signOut();
    } catch (e) {
      console.warn("Sign out warning:", e);
    }
  }

  AppState.activeUser = null;
  if (window.AlMualijFirebase && window.AlMualijFirebase.localStore) {
    window.AlMualijFirebase.localStore.setCurrentUser(null);
  }
  showToast("You have been signed out safely.", "info");
  navigateToScreen(1);
}

/* ==========================================================================
   SECURITY: COOLDOWN & ATTEMPTS MANAGEMENT
   ========================================================================== */
function getCooldownRemainingSeconds() {
  const cooldownUntil = parseInt(localStorage.getItem("almualij_cooldown_until") || "0", 10);
  const now = Date.now();
  if (cooldownUntil > now) {
    return Math.ceil((cooldownUntil - now) / 1000);
  }
  return 0;
}

function checkAndApplyCooldown() {
  const remainingSeconds = getCooldownRemainingSeconds();
  const banner = document.getElementById("loginCooldownBanner");
  const secondsSpan = document.getElementById("cooldownSecondsLeft");
  const submitBtn = document.getElementById("loginSubmitBtn");
  const attemptMsg = document.getElementById("loginAttemptMsg");

  if (remainingSeconds > 0) {
    // Cooldown active
    if (banner) banner.style.display = "flex";
    if (secondsSpan) secondsSpan.textContent = remainingSeconds;
    if (attemptMsg) attemptMsg.style.display = "none";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = `Security Cooldown (${remainingSeconds}s)`;
    }

    // Start interval timer if not already running
    if (!AppState.cooldownTimerInterval) {
      AppState.cooldownTimerInterval = setInterval(() => {
        const secs = getCooldownRemainingSeconds();
        if (secs > 0) {
          if (secondsSpan) secondsSpan.textContent = secs;
          if (submitBtn) submitBtn.textContent = `Security Cooldown (${secs}s)`;
        } else {
          // Cooldown finished
          clearInterval(AppState.cooldownTimerInterval);
          AppState.cooldownTimerInterval = null;
          localStorage.removeItem("almualij_cooldown_until");

          if (banner) banner.style.display = "none";
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Sign In to Portal";
          }
          showToast("Cooldown ended. You may try logging in now.", "info");
        }
      }, 1000);
    }
    return true;
  } else {
    // Cooldown not active
    if (banner) banner.style.display = "none";
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In to Portal";
    }
    if (AppState.cooldownTimerInterval) {
      clearInterval(AppState.cooldownTimerInterval);
      AppState.cooldownTimerInterval = null;
    }
    return false;
  }
}

function triggerSecurityCooldown() {
  const cooldownEnd = Date.now() + COOLDOWN_DURATION_MS;
  localStorage.setItem("almualij_cooldown_until", cooldownEnd.toString());
  checkAndApplyCooldown();
  showToast("Maximum 5 failed attempts reached. A 60-second security cooldown has been activated.", "error");
}

function getFailedAttempts(email) {
  const key = "almualij_login_attempts_" + (email || "").toLowerCase();
  return parseInt(sessionStorage.getItem(key) || "0", 10);
}

function incrementFailedAttempts(email) {
  const key = "almualij_login_attempts_" + (email || "").toLowerCase();
  const count = getFailedAttempts(email) + 1;
  sessionStorage.setItem(key, count.toString());
  return count;
}

function resetFailedAttempts(email) {
  const key = "almualij_login_attempts_" + (email || "").toLowerCase();
  sessionStorage.removeItem(key);
  const attemptMsg = document.getElementById("loginAttemptMsg");
  if (attemptMsg) {
    attemptMsg.style.display = "none";
    attemptMsg.textContent = "";
  }
}

/* ==========================================================================
   AUTHENTICATION: SIGN UP & LOGIN WITH FIREBASE & REGISTERED ACCOUNTS
   ========================================================================== */
function setupAuthListeners() {
  // Tab switching between Login and Sign Up
  const loginTab = document.getElementById("tabLoginBtn");
  const signupTab = document.getElementById("tabSignupBtn");
  const loginFormWrap = document.getElementById("loginFormContainer");
  const signupFormWrap = document.getElementById("signupFormContainer");
  const attemptMsg = document.getElementById("loginAttemptMsg");

  if (loginTab && signupTab) {
    loginTab.addEventListener("click", () => {
      loginTab.classList.add("active");
      signupTab.classList.remove("active");
      loginFormWrap.style.display = "block";
      signupFormWrap.style.display = "none";
      checkAndApplyCooldown();
    });

    signupTab.addEventListener("click", () => {
      signupTab.classList.add("active");
      loginTab.classList.remove("active");
      loginFormWrap.style.display = "none";
      signupFormWrap.style.display = "block";
    });
  }

  // Real-time digit restriction on phone number in sign up
  const signupPhone = document.getElementById("signupPhone");
  if (signupPhone) {
    signupPhone.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "");
    });
  }

  // SIGN UP FORM SUBMISSION
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("signupFullName").value.trim();
      const email = document.getElementById("signupEmail").value.trim().toLowerCase();
      const phone = document.getElementById("signupPhone").value.trim();
      const password = document.getElementById("signupPassword").value;

      if (!name || !email || !phone || !password) {
        showToast("Please fill in all required sign-up fields.", "error");
        return;
      }

      if (password.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
      }

      const submitBtn = document.getElementById("signupSubmitBtn");
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating Account...";

      try {
        let createdUser = null;

        // Sign Up using Firebase Auth
        if (typeof firebase !== "undefined" && firebase.auth) {
          try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            createdUser = userCredential.user;

            // Update user profile with display name
            if (createdUser && createdUser.updateProfile) {
              await createdUser.updateProfile({ displayName: name });
            }

            // Save patient profile record in Firestore
            if (window.AlMualijFirebase && window.AlMualijFirebase.isConfigured() && firebase.firestore) {
              try {
                await firebase.firestore().collection("users").doc(createdUser.uid).set({
                  fullName: name,
                  email: email,
                  phone: phone,
                  role: "patient",
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              } catch (dbErr) {
                console.warn("Firestore profile write warning:", dbErr);
              }
            }
          } catch (fbErr) {
            console.warn("Firebase Auth sign-up error:", fbErr);

            if (fbErr.code === "auth/email-already-in-use") {
              showToast("This email is already registered. Please use Patient Login.", "error");
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
              loginTab.click();
              document.getElementById("loginEmail").value = email;
              return;
            } else if (fbErr.code === "auth/invalid-email") {
              showToast("Please enter a valid email address.", "error");
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
              return;
            } else if (fbErr.code === "auth/weak-password") {
              showToast("Password is too weak. Please use at least 6 characters.", "error");
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
              return;
            }
          }
        }

        // Mirror registered account locally
        const userObj = {
          fullName: name,
          email: email,
          phone: phone,
          id: createdUser ? createdUser.uid : "PAT-" + Math.floor(100000 + Math.random() * 900000)
        };

        saveRegisteredAccount(email, userObj);

        // Set active session
        AppState.activeUser = userObj;
        if (window.AlMualijFirebase && window.AlMualijFirebase.localStore) {
          window.AlMualijFirebase.localStore.setCurrentUser(userObj);
        }

        resetFailedAttempts(email);
        showToast("Account created successfully! Welcome to Al-Mualij.", "success");
        signupForm.reset();
        navigateToScreen(3);

      } catch (err) {
        console.error("Sign up error:", err);
        showToast("Unable to complete sign-up. Please try again.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // LOGIN FORM SUBMISSION (STRICT FIREBASE AUTH & REGISTERED EMAIL CHECK)
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Check if cooldown is currently active
      if (checkAndApplyCooldown()) {
        const secs = getCooldownRemainingSeconds();
        showToast(`Cooldown in progress. Please wait ${secs}s before trying again.`, "error");
        return;
      }

      const email = document.getElementById("loginEmail").value.trim().toLowerCase();
      const password = document.getElementById("loginPassword").value;

      if (!email || !password) {
        showToast("Please enter both email and password.", "error");
        return;
      }

      const submitBtn = document.getElementById("loginSubmitBtn");
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Verifying Credentials...";

      try {
        let authPassed = false;
        let authUserObj = null;

        // Try Firebase Authentication
        if (typeof firebase !== "undefined" && firebase.auth) {
          try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const fbUser = userCredential.user;

            authPassed = true;
            authUserObj = {
              fullName: fbUser.displayName || email.split("@")[0].replace(/[._]/g, " "),
              email: fbUser.email,
              phone: "",
              id: fbUser.uid
            };

            // Attempt to enrich with Firestore data if available
            if (firebase.firestore) {
              try {
                const userDoc = await firebase.firestore().collection("users").doc(fbUser.uid).get();
                if (userDoc.exists) {
                  const data = userDoc.data();
                  if (data.fullName) authUserObj.fullName = data.fullName;
                  if (data.phone) authUserObj.phone = data.phone;
                }
              } catch (docErr) {
                console.warn("User doc lookup notice:", docErr);
              }
            }

          } catch (fbErr) {
            console.warn("Firebase sign-in error code:", fbErr.code, fbErr.message);

            // CASE 1: Email was NEVER registered on sign-up page
            if (fbErr.code === "auth/user-not-found" || fbErr.code === "auth/invalid-email") {
              if (attemptMsg) {
                attemptMsg.textContent = "No account found with this email. Only emails registered on the sign up page can log in.";
                attemptMsg.style.display = "block";
              }
              showToast("No account found with this email. Please create an account on the Sign Up tab first.", "error");
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
              return;
            }

            // CASE 2: Password does not match (wrong password) or invalid credential
            if (fbErr.code === "auth/wrong-password" || fbErr.code === "auth/invalid-credential" || fbErr.code === "auth/invalid-login-credentials") {
              const attempts = incrementFailedAttempts(email);
              const remaining = MAX_LOGIN_ATTEMPTS - attempts;

              if (attempts < MAX_LOGIN_ATTEMPTS) {
                if (attemptMsg) {
                  attemptMsg.textContent = `Password does not match. Attempt ${attempts} of ${MAX_LOGIN_ATTEMPTS}. ${remaining} attempt(s) remaining before security cooldown.`;
                  attemptMsg.style.display = "block";
                }
                showToast(`Password incorrect! Attempt ${attempts} of ${MAX_LOGIN_ATTEMPTS}. (${remaining} remaining)`, "error");
              } else {
                // 5 failed attempts reached -> trigger security cooldown
                if (attemptMsg) attemptMsg.style.display = "none";
                triggerSecurityCooldown();
              }

              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
              return;
            }

            // CASE 3: Firebase rate limiting (too many requests)
            if (fbErr.code === "auth/too-many-requests") {
              triggerSecurityCooldown();
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
              return;
            }

            // Fallback check with local registered mirror
            const registeredAccount = getRegisteredAccount(email);
            if (!registeredAccount) {
              if (attemptMsg) {
                attemptMsg.textContent = "No account found with this email. Only emails registered on the sign up page can log in.";
                attemptMsg.style.display = "block";
              }
              showToast("Unregistered email. Please sign up first.", "error");
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
              return;
            }
          }
        } else {
          // If Firebase is completely offline, check local registered accounts
          const registeredAccount = getRegisteredAccount(email);
          if (!registeredAccount) {
            if (attemptMsg) {
              attemptMsg.textContent = "No account found with this email. Only emails registered on the sign up page can log in.";
              attemptMsg.style.display = "block";
            }
            showToast("Unregistered email. Please create an account on the Sign Up tab first.", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
          }
        }

        // If credentials verified successfully
        if (authPassed && authUserObj) {
          resetFailedAttempts(email);
          AppState.activeUser = authUserObj;

          if (window.AlMualijFirebase && window.AlMualijFirebase.localStore) {
            window.AlMualijFirebase.localStore.setCurrentUser(authUserObj);
          }

          if (attemptMsg) attemptMsg.style.display = "none";
          showToast(`Welcome back, ${authUserObj.fullName}.`, "success");
          loginForm.reset();
          navigateToScreen(3);
        }

      } catch (err) {
        console.error("Login handling error:", err);
        showToast("Sign in failed. Please verify credentials.", "error");
      } finally {
        if (!getCooldownRemainingSeconds()) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }
}

// Local registry helpers to ensure only registered users can log in
function saveRegisteredAccount(email, data) {
  try {
    const list = JSON.parse(localStorage.getItem("almualij_registered_users") || "[]");
    const existingIndex = list.findIndex(item => item.email.toLowerCase() === email.toLowerCase());
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...data };
    } else {
      list.push(data);
    }
    localStorage.setItem("almualij_registered_users", JSON.stringify(list));
  } catch (e) {
    console.warn("Could not save to local registered cache:", e);
  }
}

function getRegisteredAccount(email) {
  try {
    const list = JSON.parse(localStorage.getItem("almualij_registered_users") || "[]");
    return list.find(item => item.email.toLowerCase() === (email || "").toLowerCase());
  } catch (e) {
    return null;
  }
}

/* ==========================================================================
   SCREEN 3: PATIENT DASHBOARD / RECORD VIEW
   ========================================================================== */
async function renderDashboard() {
  const patientWelcomeName = document.getElementById("dashboardPatientName");
  const recordContainer = document.getElementById("dashboardRecordArea");
  const emptyStateCard = document.getElementById("dashboardEmptyState");

  // Update greeting name
  if (patientWelcomeName) {
    patientWelcomeName.textContent = AppState.activeUser 
      ? AppState.activeUser.fullName || AppState.activeUser.name 
      : "Esteemed Patient";
  }

  // Always read appointment history from Firestore so it follows the patient across devices.
  if (AppState.activeUser && window.AlMualijFirebase && window.AlMualijFirebase.patientService) {
    AppState.appointments = await window.AlMualijFirebase.patientService.getPatientAppointments(AppState.activeUser.id);
  } else {
    AppState.appointments = [];
  }

  if (!AppState.appointments || AppState.appointments.length === 0) {
    if (emptyStateCard) emptyStateCard.style.display = "block";
    if (recordContainer) recordContainer.style.display = "none";
  } else {
    if (emptyStateCard) emptyStateCard.style.display = "none";
    if (recordContainer) {
      recordContainer.style.display = "block";
      renderPatientRecords(AppState.appointments);
    }
  }
}

function renderPatientRecords(appointments) {
  const container = document.getElementById("dashboardRecordArea");
  if (!container) return;

  const latest = appointments[0] || {};
  const patientProfile = AppState.activeUser || latest;

  let html = `
    <div class="patient-profile-summary">
      <div>
        <div class="profile-field-label">Active Patient</div>
        <div class="profile-field-val">${escapeHtml(patientProfile.fullName || latest.patientName || "Valued Patient")}</div>
      </div>
      <div>
        <div class="profile-field-label">CNIC / ID (13 Digits)</div>
        <div class="profile-field-val">${latest.cnic || patientProfile.cnic || "Pending Intake"}</div>
      </div>
      <div>
        <div class="profile-field-label">Contact Phone</div>
        <div class="profile-field-val">${latest.contact || patientProfile.phone || "Not specified"}</div>
      </div>
      <div>
        <div class="profile-field-label">Age / Gender</div>
        <div class="profile-field-val">${latest.age ? latest.age + " yrs" : "-"} · ${latest.gender || "-"}</div>
      </div>
    </div>

    <h4 style="font-size: 1.15rem; margin-bottom: 1rem; color: var(--color-primary-dark);">
      Recorded Consultations & Intake History (${appointments.length})
    </h4>
  `;

  appointments.forEach(appt => {
    const formattedDate = appt.appointmentDate || "Date TBD";
    const status = appt.status || "Confirmed";
    const badgeClass = status === "Confirmed" ? "badge-live" : "badge-unani";

    html += `
      <div class="appointment-card">
        <div class="appt-info-main" style="width: 100%;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.35rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <h4>${escapeHtml(appt.patientName || appt.fullName || "Patient Consultation")}</h4>
              <span class="badge ${badgeClass}">${status}</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              <strong>MR #:</strong> <code>${escapeHtml(appt.mrNumber || "N/A")}</code> · <strong>Visit #:</strong> ${escapeHtml(String(appt.visitNumber || 1))}
            </div>
          </div>

          <div class="appt-meta-pills">
            <span class="appt-meta-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${formattedDate}
            </span>
            <span class="appt-meta-pill">
              <strong>Father:</strong> ${escapeHtml(appt.fatherName || "—")}
            </span>
            <span class="appt-meta-pill">
              <strong>Address:</strong> ${escapeHtml(appt.address || "—")}
            </span>
            <span class="appt-meta-pill">
              <strong>Entered By:</strong> ${escapeHtml(appt.enteredBy || "Staff")}
            </span>
          </div>

          <div style="margin-top: 0.75rem; display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
            <p class="appt-reason" style="margin: 0;">
              <strong>Diagnosis:</strong> ${escapeHtml(appt.diagnosis || appt.reason || "General assessment")}
            </p>
            <p class="appt-reason" style="margin: 0;">
              <strong>Treatment:</strong> ${escapeHtml(appt.treatment || "Standard herbal protocol")}
            </p>
          </div>

          <!-- Financial Breakdown -->
          <div style="display: flex; gap: 1rem; margin-top: 0.85rem; padding-top: 0.65rem; border-top: 1px dashed var(--border-subtle); flex-wrap: wrap; font-size: 0.82rem; color: var(--text-secondary);">
            <span>Consultation: <strong>PKR ${escapeHtml(String(appt.consultationPrice || 0))}</strong></span>
            <span>Services: <strong>PKR ${escapeHtml(String(appt.servicesPrice || 0))}</strong></span>
            <span>Medicine: <strong>PKR ${escapeHtml(String(appt.medicinePrice || 0))}</strong></span>
            <span style="color: var(--color-primary-dark);">Total: <strong>PKR ${escapeHtml(String(appt.totalPrice || 0))}</strong></span>
          </div>

        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function prefillAppointmentForm(user) {
  if (!user) return;
  const nameEl = document.getElementById("patientName");
  const contactEl = document.getElementById("contact");
  const enteredByEl = document.getElementById("enteredBy");

  if (nameEl && !nameEl.value) nameEl.value = user.fullName || "";
  if (contactEl && !contactEl.value && user.phone) contactEl.value = user.phone;
  if (enteredByEl && !enteredByEl.value) {
    enteredByEl.value = user.fullName || "Clinical Staff";
  }
}

/* ==========================================================================
   SCREEN 4: CLINICAL INTAKE FORM (VALIDATION & SUBMISSION)
   ========================================================================== */
function setupAppointmentFormListeners() {
  const form = document.getElementById("appointmentForm");
  if (!form) return;

  // 1. Enforce strict digits-only and character restrictions on real-time inputs
  const cnicInput = document.getElementById("cnic");
  if (cnicInput) {
    cnicInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 13);
      cnicInput.classList.remove("is-invalid");
    });
  }

  const contactInput = document.getElementById("contact");
  if (contactInput) {
    contactInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "");
      contactInput.classList.remove("is-invalid");
    });
  }

  // Price inputs: digits only & auto-sum into Total
  const consultInput = document.getElementById("consultationPrice");
  const servicesInput = document.getElementById("servicesPrice");
  const medicineInput = document.getElementById("medicinePrice");
  const totalInput = document.getElementById("totalPrice");

  const priceInputs = [consultInput, servicesInput, medicineInput];

  priceInputs.forEach(input => {
    if (input) {
      input.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/\D/g, "");
        input.classList.remove("is-invalid");

        // Auto calculate Total
        const cVal = parseInt(consultInput.value || "0", 10);
        const sVal = parseInt(servicesInput.value || "0", 10);
        const mVal = parseInt(medicineInput.value || "0", 10);
        if (totalInput) {
          totalInput.value = (cVal + sVal + mVal).toString();
          totalInput.classList.remove("is-invalid");
        }
      });
    }
  });

  if (totalInput) {
    totalInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "");
      totalInput.classList.remove("is-invalid");
    });
  }

  // Remove error states on any input
  const allInputs = form.querySelectorAll("input, select, textarea");
  allInputs.forEach(input => {
    input.addEventListener("input", () => input.classList.remove("is-invalid"));
    input.addEventListener("change", () => input.classList.remove("is-invalid"));
  });

  // 2. Form Submission Handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Gather all fields
    const mrNumber = document.getElementById("mrNumber").value.trim();
    const patientName = document.getElementById("patientName").value.trim();
    const fatherName = document.getElementById("fatherName").value.trim();
    const visitNumberVal = document.getElementById("visitNumber").value.trim();
    const ageVal = document.getElementById("age").value.trim();
    const gender = document.getElementById("gender").value;
    const cnic = document.getElementById("cnic").value.trim();
    const contact = document.getElementById("contact").value.trim();
    const address = document.getElementById("address").value.trim();
    const diagnosis = document.getElementById("diagnosis").value.trim();
    const treatment = document.getElementById("treatment").value.trim();
    const consultationPrice = document.getElementById("consultationPrice").value.trim();
    const servicesPrice = document.getElementById("servicesPrice").value.trim();
    const medicinePrice = document.getElementById("medicinePrice").value.trim();
    const totalPrice = document.getElementById("totalPrice").value.trim();
    const appointmentDate = document.getElementById("appointmentDate").value;
    const enteredBy = document.getElementById("enteredBy").value.trim();

    // Strict Validation
    let isValid = true;

    // Field 1: MR # (manual input, required)
    if (!mrNumber) {
      markInvalid("mrNumber", "Please enter the MR #.");
      isValid = false;
    }

    // Field 2: Name (required)
    if (!patientName || patientName.length < 2) {
      markInvalid("patientName", "Please enter the patient's name.");
      isValid = false;
    }

    // Field 3: Father Name (required)
    if (!fatherName || fatherName.length < 2) {
      markInvalid("fatherName", "Please enter the father / guardian name.");
      isValid = false;
    }

    // Field 4: Visit # (number >= 1)
    const visitNumber = parseInt(visitNumberVal, 10);
    if (!visitNumberVal || isNaN(visitNumber) || visitNumber < 1) {
      markInvalid("visitNumber", "Please enter a valid visit number (1 or greater).");
      isValid = false;
    }

    // Field 5: Age (number between 1 and 120)
    const age = parseInt(ageVal, 10);
    if (!ageVal || isNaN(age) || age < 1 || age > 120) {
      markInvalid("age", "Please enter an age between 1 and 120.");
      isValid = false;
    }

    // Field 6: Gender (Male, Female, Other)
    if (!gender || !["Male", "Female", "Other"].includes(gender)) {
      markInvalid("gender", "Please select a valid gender.");
      isValid = false;
    }

    // Field 7: CNIC (strictly 13 digits only, no more no less)
    const cnicClean = cnic.replace(/\D/g, "");
    if (!cnicClean || cnicClean.length !== 13) {
      markInvalid("cnic", "CNIC must be exactly 13 digits (digits only, no dashes).");
      isValid = false;
    }

    // Field 8: Contact (phone - digits only)
    const contactClean = contact.replace(/\D/g, "");
    if (!contactClean || contactClean.length < 8) {
      markInvalid("contact", "Please provide a valid contact phone number (digits only).");
      isValid = false;
    }

    // Field 9: Address (specific or vague, city name or street)
    if (!address || address.length < 2) {
      markInvalid("address", "Please provide a residential address or city.");
      isValid = false;
    }

    // Field 10: Diagnosis (uncapped text, required)
    if (!diagnosis) {
      markInvalid("diagnosis", "Please enter the clinical diagnosis.");
      isValid = false;
    }

    // Field 11: Treatment (uncapped text, required)
    if (!treatment) {
      markInvalid("treatment", "Please enter the prescribed treatment.");
      isValid = false;
    }

    // Field 12: Consultation (price, digits only)
    if (consultationPrice === "" || !/^\d+$/.test(consultationPrice)) {
      markInvalid("consultationPrice", "Consultation fee must be digits only (e.g. 0).");
      isValid = false;
    }

    // Field 13: Services (price, digits only)
    if (servicesPrice === "" || !/^\d+$/.test(servicesPrice)) {
      markInvalid("servicesPrice", "Services price must be digits only (e.g. 0).");
      isValid = false;
    }

    // Field 14: Medicine Price (digits only)
    if (medicinePrice === "" || !/^\d+$/.test(medicinePrice)) {
      markInvalid("medicinePrice", "Medicine price must be digits only (e.g. 0).");
      isValid = false;
    }

    // Field 15: Total (digits only)
    if (totalPrice === "" || !/^\d+$/.test(totalPrice)) {
      markInvalid("totalPrice", "Total amount must be digits only.");
      isValid = false;
    }

    // Appointment Date
    if (!appointmentDate) {
      markInvalid("appointmentDate", "Please select an appointment date.");
      isValid = false;
    }

    // Field 16: Entered By
    if (!enteredBy) {
      markInvalid("enteredBy", "Please enter the name of the person who entered this data.");
      isValid = false;
    }

    if (!isValid) {
      showToast("Please correct the highlighted fields before submitting.", "error");
      return;
    }

    // Construct the Clean JSON Payload
    const appointmentPayload = {
      mrNumber: mrNumber,
      patientName: patientName,
      fatherName: fatherName,
      visitNumber: visitNumber,
      age: age,
      gender: gender,
      cnic: cnicClean,
      contact: contactClean,
      address: address,
      diagnosis: diagnosis,
      treatment: treatment,
      consultationPrice: parseInt(consultationPrice, 10),
      servicesPrice: parseInt(servicesPrice, 10),
      medicinePrice: parseInt(medicinePrice, 10),
      totalPrice: parseInt(totalPrice, 10),
      appointmentDate: appointmentDate,
      enteredBy: enteredBy,
      patientId: AppState.activeUser ? AppState.activeUser.id : "PAT-" + Date.now().toString(36),
      submittedAt: new Date().toISOString()
    };

    // UI Loading State
    const submitBtn = document.getElementById("submitAppointmentBtn");
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="badge-pulse-dot" style="margin-right: 8px;"></span>
      Securing & Saving Clinical Record...
    `;

    try {
      // Temporary direct webhook delivery for the presentation demo.
      try {
        await fetch(N8N_PRODUCTION_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(appointmentPayload)
        });
      } catch (webhookError) {
        console.warn("Production webhook delivery notice:", webhookError);
      }

      // Save record to Firebase Firestore or fallback local store.
      let firestoreResult = { success: true };
      if (window.AlMualijFirebase && window.AlMualijFirebase.patientService) {
        firestoreResult = await window.AlMualijFirebase.patientService.recordAppointment(appointmentPayload);
      }

      // Update in-memory state.
      const newRecord = {
        ...appointmentPayload,
        id: firestoreResult.id || "APPT-" + Date.now().toString(36).toUpperCase(),
        status: "Confirmed"
      };

      AppState.appointments.unshift(newRecord);

      // Trigger modal feedback with background blur and scroll lock.
      showSuccessModal(newRecord);

      // Reset form fields
      form.reset();
      setupDateConstraints();

    } catch (err) {
      console.error("Clinical record submission error:", err);
      showToast("An unexpected error occurred while saving the record. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });
}

function markInvalid(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.add("is-invalid");
  const errorEl = field.parentElement.querySelector(".form-error-msg");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
}

/* ==========================================================================
   FEEDBACK: MODAL & TOAST SYSTEM
   ========================================================================== */
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  `;
  if (type === "error") {
    icon = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    `;
  } else if (type === "info") {
    icon = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    `;
  }

  toast.innerHTML = `
    <span style="display: flex; align-items: center; color: var(--color-primary);">${icon}</span>
    <span style="flex: 1;">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 20);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 350);
  }, 4500);
}

function showSuccessModal(data) {
  const modalOverlay = document.getElementById("successModalOverlay");
  const modalSummary = document.getElementById("modalAppointmentSummary");
  const confirmBtn = document.getElementById("modalConfirmBtn");
  const screen4 = document.getElementById("screen-4");

  if (modalSummary) {
    modalSummary.innerHTML = `
      <div class="modal-details-row">
        <strong>MR #:</strong> <span>${escapeHtml(data.mrNumber)}</span>
      </div>
      <div class="modal-details-row">
        <strong>Patient Name:</strong> <span>${escapeHtml(data.patientName)}</span>
      </div>
      <div class="modal-details-row">
        <strong>Father Name:</strong> <span>${escapeHtml(data.fatherName)}</span>
      </div>
      <div class="modal-details-row">
        <strong>CNIC (13 Digits):</strong> <span>${escapeHtml(data.cnic)}</span>
      </div>
      <div class="modal-details-row">
        <strong>Contact:</strong> <span>${escapeHtml(data.contact)}</span>
      </div>
      <div class="modal-details-row">
        <strong>Consultation Date:</strong> <span>${data.appointmentDate}</span>
      </div>
      <div class="modal-details-row">
        <strong>Total Amount:</strong> <span>PKR ${data.totalPrice}</span>
      </div>
      <div class="modal-details-row">
        <strong>Entered By:</strong> <span>${escapeHtml(data.enteredBy)}</span>
      </div>
    `;
  }

  // When modal opens, make underlying screen blur and unscrollable
  if (screen4) screen4.classList.add("screen-blurred");
  document.body.classList.add("body-unscrollable");

  if (modalOverlay) {
    modalOverlay.classList.add("active");
  }

  const handleClose = () => {
    if (modalOverlay) modalOverlay.classList.remove("active");
    if (screen4) screen4.classList.remove("screen-blurred");
    document.body.classList.remove("body-unscrollable");
    confirmBtn.removeEventListener("click", handleClose);
    navigateToScreen(3);
    showToast("Dashboard updated with new clinical record.", "success");
  };

  if (confirmBtn) {
    confirmBtn.onclick = handleClose;
  }
}

/* ==========================================================================
   UTILITY HELPERS
   ========================================================================== */
function escapeHtml(string) {
  if (string === null || string === undefined) return "";
  return String(string).replace(/[&<>"']/g, (s) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[s];
  });
}

window.AlMualijApp = {
  navigateTo: navigateToScreen
};
