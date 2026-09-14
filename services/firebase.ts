import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithPopup, 
  signOut, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  User,
  verifyBeforeUpdateEmail,
  updateProfile,
  Auth,
  UserCredential,
  ConfirmationResult
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  query,
  orderBy,
  Firestore
} from "firebase/firestore";
import { Transaction, UserStats, FinancialGoal, UserProfile } from "../types";

// --- Configuration ---
const firebaseConfig = {
  projectId: "steadfast-prism-4vxch",
  appId: "1:319238617745:web:2b3ceb2d2988ca7f459d30",
  apiKey: "AIzaSyCIqOzZ2KSYUFXVkSSfyKraEtnaysaPy-w",
  authDomain: "steadfast-prism-4vxch.firebaseapp.com",
  storageBucket: "steadfast-prism-4vxch.firebasestorage.app",
  messagingSenderId: "319238617745",
  measurementId: ""
};

// --- Singleton Instances ---
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let initError: Error | null = null;

// --- Defensive Initialization ---
try {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        console.log("🔥 Firebase initialized successfully.");
    } else {
        app = getApp();
        console.log("🔥 Firebase app retrieved from cache.");
    }
    
    if (app) {
        authInstance = getAuth(app);
        dbInstance = getFirestore(app);
        
        try {
            authInstance.languageCode = 'pt';
        } catch (langError) {
            console.warn("Could not set Auth language to PT:", langError);
        }
    }
} catch (e: any) {
    console.error("🚨 CRITICAL: Failed to initialize Firebase Services", e);
    initError = e;
}

// --- Safe Exports ---
export const auth = authInstance!;
export const db = dbInstance!;
export const firebaseInitializationError = initError;

// Providers
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// --- Internal Safety Helpers ---
const ensureAuth = (): void => {
    if (!auth) throw new Error("Serviço de Autenticação indisponível (Erro de Inicialização).");
};
const ensureDb = (): void => {
    if (!db) throw new Error("Banco de Dados indisponível (Erro de Inicialização).");
};

// --- Authentication Services ---

export const loginWithGoogle = async (): Promise<void> => {
  ensureAuth();
  await signInWithPopup(auth, googleProvider);
};

export const loginWithGithub = async (): Promise<void> => {
  ensureAuth();
  await signInWithPopup(auth, githubProvider);
};

export const registerWithEmail = async (email: string, pass: string): Promise<User> => {
  ensureAuth();
  const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, pass);
  try { 
      await sendEmailVerification(userCredential.user); 
  } catch(e) { 
      console.warn("Failed to send verification email on registration:", e); 
  }
  return userCredential.user;
};

export const loginWithEmail = async (email: string, pass: string): Promise<UserCredential> => {
  ensureAuth();
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const resetPassword = async (email: string): Promise<void> => {
  ensureAuth();
  return await sendPasswordResetEmail(auth, email);
};

export const resendVerificationEmail = async (user: User): Promise<void> => {
  await sendEmailVerification(user);
};

export const updateUserEmail = async (user: User, newEmail: string): Promise<void> => {
  await verifyBeforeUpdateEmail(user, newEmail); 
};

export const logout = async (): Promise<void> => {
    if(auth) await signOut(auth);
};

// --- Phone Authentication ---
export const setupRecaptcha = (containerId: string): RecaptchaVerifier => {
  ensureAuth();
  if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = undefined;
  }
  
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    'size': 'invisible',
    'callback': () => { console.log("Recaptcha verified"); },
    'expired-callback': () => { console.log("Recaptcha expired"); }
  });
  return window.recaptchaVerifier;
};

export const loginWithPhone = async (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
  ensureAuth();
  return await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
};

// --- Login Code System (Passwordless for secondary devices) ---
export interface LoginCodeData {
  code: string;
  expiresAt: number;
  createdAt: number;
}

export const generateLoginCode = async (uid: string): Promise<LoginCodeData> => {
  ensureDb();
  const userCodeRef = doc(db, `users/${uid}/security/loginCode`);
  const snapshot = await getDoc(userCodeRef);
  const now = Date.now();

  if (snapshot.exists()) {
    const existingData = snapshot.data();
    if (existingData.createdAt && (now - existingData.createdAt < 24 * 60 * 60 * 1000)) {
        throw new Error("COOLDOWN");
    }
    if (existingData.code) {
        await deleteDoc(doc(db, `login_codes/${existingData.code}`));
    }
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 dias
  
  await setDoc(doc(db, `login_codes/${code}`), { uid, expiresAt });

  const codeData: LoginCodeData = { code, expiresAt, createdAt: now };
  await setDoc(userCodeRef, codeData);

  return codeData;
};

export const getStoredLoginCode = async (uid: string): Promise<LoginCodeData | null> => {
  ensureDb();
  const snapshot = await getDoc(doc(db, `users/${uid}/security/loginCode`));
  if (snapshot.exists()) {
    return snapshot.data() as LoginCodeData;
  }
  return null;
};

export const verifyLoginCode = async (code: string): Promise<{ uid: string, expiresAt: number } | null> => {
  ensureDb();
  const snapshot = await getDoc(doc(db, `login_codes/${code}`));
  
  if (snapshot.exists()) {
    const data = snapshot.data();
    if (Date.now() < data.expiresAt) {
      return data as { uid: string, expiresAt: number };
    } else {
      await deleteDoc(doc(db, `login_codes/${code}`));
      return null;
    }
  }
  return null;
};

// --- User Profile Management ---
export const saveUserProfileToDB = async (user: User): Promise<void> => {
    if (!db) return;
    try {
        const profileRef = doc(db, `users/${user.uid}/profile/data`);
        await setDoc(profileRef, {
            email: user.email,
            emailVerified: user.emailVerified,
            lastLogin: Date.now(),
            ...(user.displayName ? { displayName: user.displayName } : {}),
            ...(user.photoURL ? { photoURL: user.photoURL } : {})
        }, { merge: true });
    } catch(e) {
        console.warn("Background profile sync failed:", e);
    }
};

export const updateUserProfileData = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
    ensureAuth();
    ensureDb();
    if (!auth.currentUser) throw new Error("Você precisa estar autenticado.");
    if (auth.currentUser.uid !== uid) throw new Error("Permissão negada: ID incompatível.");

    const profileRef = doc(db, `users/${uid}/profile/data`);
    const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
    }, {} as any);

    await setDoc(profileRef, sanitizedData, { merge: true });
    
    if (auth.currentUser && auth.currentUser.uid === uid) {
        const authUpdates: any = {};
        if (sanitizedData.displayName) authUpdates.displayName = sanitizedData.displayName;
        if (sanitizedData.photoURL && !sanitizedData.photoURL.startsWith('data:')) {
             authUpdates.photoURL = sanitizedData.photoURL;
        }
        if (Object.keys(authUpdates).length > 0) {
            try { 
                await updateProfile(auth.currentUser, authUpdates); 
            } catch (e) {}
        }
    }
};

export const getUserProfileData = async (uid: string): Promise<UserProfile> => {
    if (!db) return { uid, displayName: 'Offline', email: 'N/A', emailVerified: false, photoURL: null };
    try {
        const snapshot = await getDoc(doc(db, `users/${uid}/profile/data`));
        if (snapshot.exists()) {
            const data = snapshot.data();
            return {
                uid,
                displayName: data.displayName || 'Usuário',
                email: data.email || 'email@oculto.com',
                photoURL: data.photoURL || null,
                emailVerified: data.emailVerified || false,
                bio: data.bio || null,
                phoneNumber: data.phoneNumber || null,
                jobTitle: data.jobTitle || null,
                website: data.website || null,
                createdAt: data.createdAt || Date.now(),
                lastLogin: data.lastLogin || Date.now()
            };
        }
    } catch (e) {
        console.warn("Erro ao buscar perfil:", e);
    }

    return { uid, displayName: 'Usuário', email: 'N/A', emailVerified: true, photoURL: null };
};

// --- Transaction Management ---
export const addTransaction = async (uid: string, transaction: Omit<Transaction, 'id'>): Promise<void> => {
  ensureDb();
  const txCol = collection(db, `users/${uid}/transactions`);
  await addDoc(txCol, transaction);
};

export const deleteTransaction = async (uid: string, transactionId: string): Promise<void> => {
  ensureDb();
  await deleteDoc(doc(db, `users/${uid}/transactions/${transactionId}`));
};

type Unsubscribe = () => void;

export const subscribeToTransactions = (uid: string, callback: (data: Transaction[]) => void): Unsubscribe => {
  if (!db) return () => {};
  const txCol = collection(db, `users/${uid}/transactions`);
  
  return onSnapshot(txCol, (snapshot) => {
    const data: Transaction[] = [];
    snapshot.forEach(docSnap => {
      data.push({ ...docSnap.data(), id: docSnap.id } as Transaction);
    });
    data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    callback(data);
  }, (error) => {
    console.warn("Transaction subscription error:", error);
    callback([]);
  });
};

// --- Goal Management ---
export const addGoal = async (uid: string, goal: Omit<FinancialGoal, 'id'>): Promise<void> => {
  ensureDb();
  const goalCol = collection(db, `users/${uid}/goals`);
  await addDoc(goalCol, { ...goal, createdAt: Date.now() });
};

export const updateGoal = async (uid: string, goalId: string, updates: Partial<FinancialGoal>): Promise<void> => {
  ensureDb();
  await updateDoc(doc(db, `users/${uid}/goals/${goalId}`), updates);
};

export const deleteGoal = async (uid: string, goalId: string): Promise<void> => {
  ensureDb();
  await deleteDoc(doc(db, `users/${uid}/goals/${goalId}`));
};

export const subscribeToGoals = (uid: string, callback: (data: FinancialGoal[]) => void): Unsubscribe => {
  if (!db) return () => {};
  const goalCol = collection(db, `users/${uid}/goals`);
  
  return onSnapshot(goalCol, (snapshot) => {
    const data: FinancialGoal[] = [];
    snapshot.forEach(docSnap => {
      data.push({ ...docSnap.data(), id: docSnap.id } as FinancialGoal);
    });
    callback(data);
  }, (err) => callback([]));
};

// --- User Stats ---
export const markAIUsage = async (uid: string): Promise<void> => {
  if (!db) return;
  try {
     await setDoc(doc(db, `users/${uid}/stats/data`), { 
         hasUsedAI: true,
         lastAnalysisDate: Date.now() 
     }, { merge: true });
  } catch (e) { console.warn("Failed to mark AI usage", e); }
};

export const subscribeToStats = (uid: string, callback: (stats: UserStats) => void): Unsubscribe => {
  if (!db) return () => {};
  const statsDoc = doc(db, `users/${uid}/stats/data`);
  
  return onSnapshot(statsDoc, (snapshot) => {
    callback((snapshot.data() as UserStats) || {});
  }, (err) => callback({}));
};
