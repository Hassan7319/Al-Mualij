/* ==========================================================================
   AL-MUALIJ CLINIC - FIREBASE CONFIGURATION & SERVICE LAYER
   Prepared for Firebase Authentication & Cloud Firestore
   ========================================================================== */

/**
 * ============================================================================
 * STEP 1: FIREBASE CONFIG OBJECT PLACEHOLDER
 * ============================================================================
 * Replace the placeholder values below with your Firebase Project credentials
 * found in the Firebase Console: Project Settings > General > Your apps.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCXQMckQdiv7ollKfX-Aj1QUp0fbUMf788",
  authDomain: "al-mualij-5e715.firebaseapp.com",
  projectId: "al-mualij-5e715",
  storageBucket: "al-mualij-5e715.firebasestorage.app",
  messagingSenderId: "286020465973",
  appId: "1:286020465973:web:c5b676fc72206a4da5c87c",
  measurementId: "G-GZHM044C7P"
};

/**
 * State flag to check if Firebase credentials are provided.
 */
const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" && 
         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
};

// Global references for Firebase instances
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

/**
 * ============================================================================
 * STEP 2: FIREBASE SDK INITIALIZATION SNIPPET
 * ============================================================================
 * When ready, include the Firebase SDK scripts in index.html (or use modular imports)
 * and call initializeFirebaseService().
 */
function initializeFirebaseService() {
  if (isFirebaseConfigured() && typeof window.firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
        console.log("🌿 [Al-Mualij] Firebase initialized successfully with project:", firebaseConfig.projectId);
        return true;
      }
    } catch (err) {
      console.warn("⚠️ [Al-Mualij] Firebase initialization error:", err);
      return false;
    }
  } else {
    console.info("ℹ️ [Al-Mualij] Running in Mock Local Storage mode. Ready for Firebase credentials.");
    return false;
  }
}

/**
 * Local State / In-Memory Mock Store
 * Automatically syncs with localStorage so the user can test all portal flows immediately!
 */
const LOCAL_STORAGE_KEY_USER = "almualij_active_patient";
const LOCAL_STORAGE_KEY_APPTS = "almualij_patient_appointments";

const LocalStore = {
  getCurrentUser() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
    }
  },

  getAppointments(patientId) {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY_APPTS);
      const list = data ? JSON.parse(data) : [];
      if (!patientId) return list;
      return list.filter(item => item.patientId === patientId || !item.patientId);
    } catch (e) {
      return [];
    }
  },

  saveAppointment(appointment) {
    try {
      const list = this.getAppointments();
      const newRecord = {
        id: "APPT-" + Date.now().toString(36).toUpperCase(),
        createdAt: new Date().toISOString(),
        status: "Confirmed",
        ...appointment
      };
      list.unshift(newRecord);
      localStorage.setItem(LOCAL_STORAGE_KEY_APPTS, JSON.stringify(list));
      return newRecord;
    } catch (e) {
      console.error("LocalStore save error:", e);
      return appointment;
    }
  }
};

/**
 * ============================================================================
 * DATABASE & AUTH SERVICE BRIDGE
 * Seamlessly interfaces with either Live Firebase or Local Mock State
 * ============================================================================
 */
const PatientService = {
  /**
   * Save appointment record to Firestore or fallback store
   */
  async recordAppointment(appointmentData) {
    if (firebaseDb && isFirebaseConfigured()) {
      try {
        const docRef = await firebaseDb.collection("appointments").add({
          ...appointmentData,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: "Pending Review",
          source: "Al-Mualij Patient Portal"
        });
        
        // Also keep local record for instant UI rendering
        LocalStore.saveAppointment({ ...appointmentData, id: docRef.id });
        return { success: true, id: docRef.id, mode: "firestore" };
      } catch (error) {
        console.error("Firestore write failed, falling back to local storage:", error);
        const record = LocalStore.saveAppointment(appointmentData);
        return { success: true, id: record.id, mode: "local_fallback", error: error.message };
      }
    } else {
      // Local storage mock execution
      const record = LocalStore.saveAppointment(appointmentData);
      return { success: true, id: record.id, mode: "local_mock" };
    }
  },

  /**
   * Fetch appointment history for patient
   */
  async getPatientAppointments(patientId) {
    if (!firebaseDb || !isFirebaseConfigured() || !patientId) {
      return [];
    }

    try {
      const snapshot = await firebaseDb.collection("appointments")
        .where("patientId", "==", patientId)
        .orderBy("createdAt", "desc")
        .get();
      const records = [];
      snapshot.forEach(doc => records.push({ id: doc.id, ...doc.data() }));
      return records;
    } catch (err) {
      console.warn("Firestore appointment read failed:", err);
      return [];
    }
  }
};

// Export to window scope for SPA access
window.AlMualijFirebase = {
  config: firebaseConfig,
  isConfigured: isFirebaseConfigured,
  init: initializeFirebaseService,
  localStore: LocalStore,
  patientService: PatientService
};
