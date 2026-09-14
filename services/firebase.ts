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
  getDatabase, 
  ref, 
  push, 
  onValue, 
  remove, 
  set, 
  off, 
  update, 
  get, 
  Database,
  DataSnapshot 
} from "firebase/database";
import { Transaction, UserStats, FinancialGoal, UserProfile } from "../types";

// --- Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCdAoxxkk9asrhoXJB-iySix-gG14B6qlI",
  authDomain: "gestaoapp-baac6.firebaseapp.com",
  databaseURL: "https://gestaoapp-baac6-default-rtdb.firebaseio.com",
  projectId: "gestaoapp-baac6",
  storageBucket: "gestaoapp-baac6.firebasestorage.app",
  messagingSenderId: "965601428152",
  appId: "1:965601428152:web:3c25d32c111e03c6f32a4d",
  measurementId: "G-2BXS6KL8JK"
};

// --- Singleton Instances ---
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Database | undefined;
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
        dbInstance = getDatabase(app);
        
        // Tentar configurar idioma, falha silenciosa se não suportado
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
// O consumidor (App.tsx) deve verificar a existência dessas instâncias
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
  // Limpa verificador existente se houver para evitar conflitos de re-render
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
  const userCodeRef = ref(db, `users/${uid}/security/loginCode`);
  const snapshot = await get(userCodeRef);
  const now = Date.now();

  // Verifica Cooldown de 24 horas
  if (snapshot.exists()) {
    const existingData = snapshot.val();
    if (existingData.createdAt && (now - existingData.createdAt < 24 * 60 * 60 * 1000)) {
        throw new Error("COOLDOWN");
    }
    // Remove código antigo do índice global
    if (existingData.code) {
        await remove(ref(db, `login_codes/${existingData.code}`));
    }
  }

  // Gera novo código
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 dias
  
  // Salva no índice global (para busca rápida no login)
  await set(ref(db, `login_codes/${code}`), { uid, expiresAt });

  // Salva no perfil do usuário
  const codeData: LoginCodeData = { code, expiresAt, createdAt: now };
  await set(userCodeRef, codeData);

  return codeData;
};

export const getStoredLoginCode = async (uid: string): Promise<LoginCodeData | null> => {
  ensureDb();
  const snapshot = await get(ref(db, `users/${uid}/security/loginCode`));
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
};

export const verifyLoginCode = async (code: string): Promise<{ uid: string, expiresAt: number } | null> => {
  ensureDb();
  const snapshot = await get(ref(db, `login_codes/${code}`));
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    // Verifica validade
    if (Date.now() < data.expiresAt) {
      return data;
    } else {
      // Código expirado, limpa
      await remove(ref(db, `login_codes/${code}`));
      return null;
    }
  }
  return null;
};

// --- User Profile Management ---

export const saveUserProfileToDB = async (user: User): Promise<void> => {
    if (!db) return;
    try {
        const profileRef = ref(db, `users/${user.uid}/profile`);
        // Atualiza apenas campos essenciais para não sobrescrever dados customizados
        await update(profileRef, {
            email: user.email,
            emailVerified: user.emailVerified,
            lastLogin: Date.now(),
            ...(user.displayName ? { displayName: user.displayName } : {}),
            ...(user.photoURL ? { photoURL: user.photoURL } : {})
        });
    } catch(e) {
        console.warn("Background profile sync failed (possibly offline):", e);
    }
};

export const updateUserProfileData = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
    ensureAuth();
    ensureDb();
    if (!auth.currentUser) throw new Error("Você precisa estar autenticado.");
    if (auth.currentUser.uid !== uid) throw new Error("Permissão negada: ID incompatível.");

    const profileRef = ref(db, `users/${uid}/profile`);
    
    // Sanitiza undefined para evitar erros do Firebase
    const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
    }, {} as any);

    await update(profileRef, sanitizedData);
    
    // Sincroniza Auth Profile se necessário
    if (auth.currentUser && auth.currentUser.uid === uid) {
        const authUpdates: any = {};
        if (sanitizedData.displayName) authUpdates.displayName = sanitizedData.displayName;
        if (sanitizedData.photoURL && !sanitizedData.photoURL.startsWith('data:')) {
             authUpdates.photoURL = sanitizedData.photoURL;
        }
        if (Object.keys(authUpdates).length > 0) {
            try { 
                await updateProfile(auth.currentUser, authUpdates); 
            } catch (e) { 
                console.warn("Auth profile sync failed (minor issue):", e); 
            }
        }
    }
};

export const getUserProfileData = async (uid: string): Promise<UserProfile> => {
    if (!db) return { uid: uid, displayName: 'Offline', email: 'N/A', emailVerified: false, photoURL: null };
    try {
        const snapshot = await get(ref(db, `users/${uid}/profile`));
        if (snapshot.exists()) {
            const data = snapshot.val();
            return {
                uid: uid,
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
        console.warn("Erro ao buscar perfil (offline?):", e);
    }

    return {
        uid: uid,
        displayName: 'Usuário (Offline)',
        email: 'N/A',
        emailVerified: true,
        photoURL: null
    };
};

// --- Transaction Management ---

export const addTransaction = async (uid: string, transaction: Omit<Transaction, 'id'>): Promise<void> => {
  ensureDb();
  const newRef = push(ref(db, `users/${uid}/transactions`));
  await set(newRef, { ...transaction, id: newRef.key });
};

export const deleteTransaction = async (uid: string, transactionId: string): Promise<void> => {
  ensureDb();
  await remove(ref(db, `users/${uid}/transactions/${transactionId}`));
};

// Type definition for Unsubscribe function
type Unsubscribe = () => void;

export const subscribeToTransactions = (uid: string, callback: (data: Transaction[]) => void): Unsubscribe => {
  if (!db) return () => {};
  const q = ref(db, `users/${uid}/transactions`);
  
  const handleValue = (snapshot: DataSnapshot) => {
    const data = snapshot.val();
    const parsedData: Transaction[] = data 
        ? Object.keys(data).map(k => ({ ...data[k], id: k })) 
        : [];
    
    // Sort by Date Descending
    parsedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    callback(parsedData);
  };
  
  onValue(q, handleValue, (error) => {
      console.warn("Transaction subscription error (permissions?):", error);
      callback([]); 
  });
  
  return () => off(q, 'value', handleValue);
};

// --- Goal Management ---

export const addGoal = async (uid: string, goal: Omit<FinancialGoal, 'id'>): Promise<void> => {
  ensureDb();
  const newRef = push(ref(db, `users/${uid}/goals`));
  await set(newRef, { ...goal, id: newRef.key, createdAt: Date.now() });
};

export const updateGoal = async (uid: string, goalId: string, updates: Partial<FinancialGoal>): Promise<void> => {
  ensureDb();
  await update(ref(db, `users/${uid}/goals/${goalId}`), updates);
};

export const deleteGoal = async (uid: string, goalId: string): Promise<void> => {
  ensureDb();
  await remove(ref(db, `users/${uid}/goals/${goalId}`));
};

export const subscribeToGoals = (uid: string, callback: (data: FinancialGoal[]) => void): Unsubscribe => {
  if (!db) return () => {};
  const q = ref(db, `users/${uid}/goals`);
  
  const handleValue = (snapshot: DataSnapshot) => {
    const data = snapshot.val();
    const parsedData: FinancialGoal[] = data 
        ? Object.keys(data).map(k => ({ ...data[k], id: k })) 
        : [];
    callback(parsedData);
  };
  
  onValue(q, handleValue, (err) => callback([]));
  return () => off(q, 'value', handleValue);
};

// --- User Stats & Achievements ---

export const markAIUsage = async (uid: string): Promise<void> => {
  if (!db) return;
  try {
     await update(ref(db, `users/${uid}/stats`), { 
         hasUsedAI: true,
         lastAnalysisDate: Date.now() 
     });
  } catch (e) { console.warn("Failed to mark AI usage", e); }
};

export const subscribeToStats = (uid: string, callback: (stats: UserStats) => void): Unsubscribe => {
  if (!db) return () => {};
  const q = ref(db, `users/${uid}/stats`);
  
  const handleValue = (snapshot: DataSnapshot) => callback(snapshot.val() || {});
  onValue(q, handleValue, (err) => callback({}));
  
  return () => off(q, 'value', handleValue);
};
