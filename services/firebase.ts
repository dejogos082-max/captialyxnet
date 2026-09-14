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
  ConfirmationResult,
  onAuthStateChanged
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc 
} from "firebase/firestore";
import { Transaction, UserStats, FinancialGoal, UserProfile } from "../types";
import firebaseConfig from "../firebase-applet-config.json";

// --- Configuration MyCloud Storage ---
const myCloudApiKey = "mk_ca27b27d3b372836763b1ba744a3d9a8c8045fba73c0bc83";
const bucketId = "ff8983b2-b94b-4b5e-8e49-0653905ee563";

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: any;
let initError: Error | null = null;

try {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    
    if (app) {
        authInstance = getAuth(app);
        dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
        try { authInstance.languageCode = 'pt'; } catch (e) {}
    }
} catch (e: any) {
    console.error("Failed to initialize Firebase Auth/Firestore", e);
    initError = e;
}

export const auth = authInstance!;
export const db = dbInstance!;
export const firebaseInitializationError = initError;
export { onAuthStateChanged };

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// --- Authentication Services (Firebase Auth) ---

export const loginWithGoogle = async (): Promise<void> => {
  await signInWithPopup(auth, googleProvider);
};

export const loginWithGithub = async (): Promise<void> => {
  await signInWithPopup(auth, githubProvider);
};

export const registerWithEmail = async (email: string, pass: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  try { await sendEmailVerification(userCredential.user); } catch(e) {}
  return userCredential.user;
};

export const loginWithEmail = async (email: string, pass: string): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const resetPassword = async (email: string): Promise<void> => {
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

export const setupRecaptcha = (containerId: string): RecaptchaVerifier => {
  if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = undefined;
  }
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    'size': 'invisible',
  });
  return window.recaptchaVerifier;
};

export const loginWithPhone = async (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
  return await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
};

export interface LoginCodeData {
  code: string;
  expiresAt: number;
  createdAt: number;
}
export const generateLoginCode = async (uid: string): Promise<LoginCodeData> => { throw new Error("Código não suportado"); };
export const getStoredLoginCode = async (uid: string): Promise<LoginCodeData | null> => { return null; };
export const verifyLoginCode = async (code: string): Promise<any> => { throw new Error("Código não suportado"); };


// --- Data Management (Firestore) ---

export const saveUserProfileToDB = async (user: any): Promise<void> => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    try {
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) {
            await setDoc(ref, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'Usuário',
                photoURL: user.photoURL || null,
                createdAt: Date.now(),
                lastLogin: Date.now()
            });
        } else {
            await updateDoc(ref, { lastLogin: Date.now() });
        }
    } catch (e) {
        console.error("Erro ao salvar perfil no Firestore:", e);
    }
};

export const updateUserProfileData = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
    try {
        const ref = doc(db, 'users', uid);
        await updateDoc(ref, data);
        
        // Sincroniza Auth Profile do Firebase
        if (auth.currentUser && auth.currentUser.uid === uid) {
            const authUpdates: any = {};
            if (data.displayName) authUpdates.displayName = data.displayName;
            if (data.photoURL && !data.photoURL.startsWith('data:')) {
                 authUpdates.photoURL = data.photoURL;
            }
            if (Object.keys(authUpdates).length > 0) {
                try { 
                    await updateProfile(auth.currentUser, authUpdates); 
                } catch (e) {}
            }
        }
    } catch (e) {
        console.error("Erro ao atualizar perfil no Firestore:", e);
    }
};

export const getUserProfileData = async (uid: string): Promise<UserProfile> => {
    try {
        const ref = doc(db, 'users', uid);
        const docSnap = await getDoc(ref);
        if (docSnap.exists()) {
            return docSnap.data() as UserProfile;
        }
    } catch(e) {
        console.error("Erro ao ler perfil no Firestore:", e);
    }
    return { uid, displayName: 'Usuário', email: 'N/A', emailVerified: true, photoURL: null };
};

export const addTransaction = async (uid: string, transaction: Omit<Transaction, 'id'>): Promise<void> => {
    try {
        const ref = doc(collection(db, 'users', uid, 'transactions'));
        await setDoc(ref, { ...transaction, id: ref.id });
    } catch(e) { console.error(e); }
};

export const deleteTransaction = async (uid: string, transactionId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'users', uid, 'transactions', transactionId));
    } catch(e) { console.error(e); }
};

type Unsubscribe = () => void;

export const subscribeToTransactions = (uid: string, callback: (data: Transaction[]) => void): Unsubscribe => {
    const q = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(docSnap => docSnap.data() as Transaction);
        callback(data);
    }, (error) => {
        console.error("Erro no listener de transactions:", error);
        callback([]);
    });
};

export const addGoal = async (uid: string, goal: Omit<FinancialGoal, 'id'>): Promise<void> => {
    try {
        const ref = doc(collection(db, 'users', uid, 'goals'));
        await setDoc(ref, { ...goal, id: ref.id, createdAt: Date.now() });
    } catch(e) { console.error(e); }
};

export const updateGoal = async (uid: string, goalId: string, updates: Partial<FinancialGoal>): Promise<void> => {
    try {
        await updateDoc(doc(db, 'users', uid, 'goals', goalId), updates);
    } catch(e) { console.error(e); }
};

export const deleteGoal = async (uid: string, goalId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'users', uid, 'goals', goalId));
    } catch(e) { console.error(e); }
};

export const subscribeToGoals = (uid: string, callback: (data: FinancialGoal[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, 'users', uid, 'goals'), (snapshot) => {
        const data = snapshot.docs.map(docSnap => docSnap.data() as FinancialGoal);
        callback(data);
    }, (error) => {
        console.error("Erro no listener de goals:", error);
        callback([]);
    });
};

export const markAIUsage = async (uid: string): Promise<void> => {
    try {
        const ref = doc(db, 'users', uid, 'stats', 'data');
        await setDoc(ref, { hasUsedAI: true, lastAnalysisDate: Date.now() }, { merge: true });
    } catch(e) { console.error(e); }
};

export const subscribeToStats = (uid: string, callback: (stats: UserStats) => void): Unsubscribe => {
    return onSnapshot(doc(db, 'users', uid, 'stats', 'data'), (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as UserStats);
        } else {
            callback({});
        }
    }, (error) => {
        console.error("Erro no listener de stats:", error);
        callback({});
    });
};

// --- Storage API (MyCloud Object Storage) ---
export const storageAPI = {
    list: async () => {
        const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects`, {
            headers: { 'X-API-Key': myCloudApiKey }
        });
        return await res.json();
    },
    upload: async (file: File) => {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects`, {
            method: 'POST',
            headers: { 'X-API-Key': myCloudApiKey },
            body: fd
        });
        return await res.json();
    },
    getStreamUrl: (fileId: string) => {
        return `https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects/${fileId}/stream`;
    },
    delete: async (fileId: string) => {
        const res = await fetch(`https://streamx.frontmk.online/api/storage/v1/buckets/${bucketId}/objects/${fileId}`, {
            method: 'DELETE',
            headers: { 'X-API-Key': myCloudApiKey }
        });
        return await res.json();
    }
};
