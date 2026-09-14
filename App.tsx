import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { onAuthStateChanged, ConfirmationResult } from 'firebase/auth';
import { 
  auth, 
  firebaseInitializationError,
  loginWithGoogle, 
  loginWithGithub, 
  addTransaction as firebaseAddTx, 
  deleteTransaction as firebaseDeleteTx, 
  subscribeToTransactions,
  registerWithEmail,
  loginWithEmail,
  resetPassword,
  loginWithPhone,
  setupRecaptcha,
  subscribeToStats,
  addGoal as firebaseAddGoal,
  updateGoal as firebaseUpdateGoal,
  deleteGoal as firebaseDeleteGoal,
  subscribeToGoals,
  markAIUsage,
  verifyLoginCode,
  getUserProfileData,
  logout as firebaseLogout,
  saveUserProfileToDB
} from './services/firebase';
import { 
  UserProfile, Transaction, TransactionType, Achievement, UserStats, 
  FinancialGoal, AIAnalysisResult, AppSettings, ToastMessage
} from './types';
import { generateFinancialInsights } from './services/geminiService';
import { 
  TrendingUp, Github, Chrome, Plus, AlertTriangle, 
  Mail, Lock, Smartphone, ArrowRight, ArrowLeft, X, Target,
  KeyRound, Clock, WifiOff, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';

// Import Components
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import AIInsights from './components/AIInsights';
import Achievements from './components/Achievements';
import Goals from './components/Goals';
import Settings from './components/Settings';
import Profile from './components/Profile';

import { LogoIcon } from './components/LogoIcon';

// --- Constants ---
const DEFAULT_SETTINGS: AppSettings = {
  performance: {
    fps: 'low',
    highPerformanceMode: false
  },
  visual: {
    theme: 'default',
    layoutMode: 'default',
    scale: 1.0
  },
  account: {
    autoLogin: true
  }
};

type AuthMode = 'login' | 'register' | 'forgot-pass' | 'phone' | 'phone-otp' | 'login-code';

// --- Custom Hooks for Logic Separation ---

/**
 * Hook to manage Toast Notifications
 */
const useToast = () => {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    // Auto dismiss
    setTimeout(() => {
      setToast(current => current?.id === id ? null : current);
    }, 5000);
  }, []);

  const closeToast = useCallback(() => setToast(null), []);

  return { toast, showToast, closeToast };
};

/**
 * Hook to manage Authentication Logic
 */
const useAuthSystem = (showToast: (msg: string, type: any) => void) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const baseUser: UserProfile = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Usuário',
          email: firebaseUser.email || null,
          emailVerified: firebaseUser.emailVerified,
          photoURL: firebaseUser.photoURL || null,
        };
        setUser(baseUser);
        
        // Save initial to DB & fetch extended
        saveUserProfileToDB(firebaseUser);
        getUserProfileData(firebaseUser.uid).then(dbProfile => {
          if (dbProfile && dbProfile.displayName !== 'Offline') {
            setUser(prev => prev ? { ...prev, ...dbProfile } : baseUser);
          }
        }).catch(() => {});
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginEmail = useCallback(async (email: string, pass: string) => {
     setProcessing(true);
     setError(null);
     try {
         await loginWithEmail(email, pass);
     } catch (err: any) {
         console.error("Login Error:", err);
         setError(err.message || "Credenciais inválidas");
     } finally {
         setProcessing(false);
     }
  }, []);

  const registerEmail = useCallback(async (email: string, pass: string) => {
     setProcessing(true);
     setError(null);
     try {
         await registerWithEmail(email, pass);
         showToast("Conta criada! Verifique seu e-mail.", 'success');
     } catch (err: any) {
         console.error("Register Error:", err);
         setError(err.message || "Erro ao criar conta");
     } finally {
         setProcessing(false);
     }
  }, [showToast]);

  const startPhoneAuth = useCallback(async (phone: string) => {
     setError("SMS e Código não suportados via Firebase sem App Check no momento.");
  }, []);

  const verifyOtp = useCallback(async (otp: string) => {}, []);
  const loginWithCode = useCallback(async (code: string) => {}, []);
  
  const sendPasswordReset = useCallback(async (email: string) => { 
     try {
         await resetPassword(email);
         return true;
     } catch(err: any) {
         setError(err.message || "Erro ao recuperar senha");
         return false;
     }
  }, []);

  const loginSocial = useCallback(async (provider: 'google' | 'github') => {
      setProcessing(true);
      setError(null);
      try {
          if (provider === 'google') await loginWithGoogle();
          if (provider === 'github') await loginWithGithub();
      } catch (err: any) {
          setError(err.message || `Erro no login com ${provider}`);
      } finally {
          setProcessing(false);
      }
  }, []);

  const performLogout = useCallback(async () => {
     await firebaseLogout();
  }, []);

  return {
    user, setUser, loading, authMode, setAuthMode, error, setError,
    processing, loginSocial, loginEmail, registerEmail,
    startPhoneAuth, verifyOtp, loginWithCode, sendPasswordReset,
    performLogout
  };
};

/**
 * Hook to manage Data (Transactions, Goals, Stats)
 */
const useFinancialData = (user: UserProfile | null) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [stats, setStats] = useState<UserStats>({});

  useEffect(() => {
    if (user) {
      const unsubTx = subscribeToTransactions(user.uid, setTransactions);
      const unsubGoals = subscribeToGoals(user.uid, setGoals);
      const unsubStats = subscribeToStats(user.uid, setStats);
      return () => { unsubTx(); unsubGoals(); unsubStats(); };
    } else {
      setTransactions([]);
      setGoals([]);
      setStats({});
    }
  }, [user?.uid]);

  // Actions wrapped in callbacks
  const addTx = useCallback(async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
      if(user) await firebaseAddTx(user.uid, { ...data, createdAt: Date.now() });
  }, [user]);

  const removeTx = useCallback(async (id: string) => {
      if(user) await firebaseDeleteTx(user.uid, id);
  }, [user]);

  const addGoal = useCallback(async (data: Omit<FinancialGoal, 'id'>) => {
      if(user) await firebaseAddGoal(user.uid, data);
  }, [user]);

  const updateGoal = useCallback(async (id: string, updates: Partial<FinancialGoal>) => {
      if(user) await firebaseUpdateGoal(user.uid, id, updates);
  }, [user]);

  const removeGoal = useCallback(async (id: string) => {
      if(user) await firebaseDeleteGoal(user.uid, id);
  }, [user]);

  return { transactions, goals, stats, addTx, removeTx, addGoal, updateGoal, removeGoal };
};

// --- Main Component ---

function App() {
  // 1. Critical Error Check
  if (firebaseInitializationError || !auth) {
      return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center text-white font-sans">
              <div className="max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
                  <div className="bg-rose-500/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                      <WifiOff className="text-rose-500" size={40} />
                  </div>
                  <h1 className="text-2xl font-bold mb-4">Sistema Indisponível</h1>
                  <p className="text-slate-400 mb-6 leading-relaxed">
                      Não foi possível conectar aos servidores de dados. Isso geralmente ocorre devido a bloqueadores de rede, firewalls corporativos ou falha na conexão.
                  </p>
                  <button onClick={() => window.location.reload()} className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold w-full transition-all">
                      Recarregar Aplicação
                  </button>
              </div>
          </div>
      );
  }

  // 2. State & Hooks Initialization
  const { toast, showToast, closeToast } = useToast();
  const { 
    user, loading: authLoading, authMode, setAuthMode, error: authError, processing, 
    loginSocial, loginEmail, registerEmail, startPhoneAuth, verifyOtp, loginWithCode, performLogout, setUser, sendPasswordReset
  } = useAuthSystem(showToast);
  
  const { transactions, goals, stats: userStats, addTx, removeTx, addGoal, updateGoal, removeGoal } = useFinancialData(user);
  
  // App Specific State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [aiInsight, setAiInsight] = useState<AIAnalysisResult | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  
  // Settings with Local Storage persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('capitalyx_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  useEffect(() => {
    localStorage.setItem('capitalyx_settings', JSON.stringify(settings));
  }, [settings]);

  // Auth Inputs State (Local to App for simplicity in form binding)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loginCode, setLoginCode] = useState('');

  // Goal Form Inputs
  const [newGoalData, setNewGoalData] = useState({ title: '', amount: '', date: '' });

  // --- Logic for AI ---
  const handleGenerateAI = useCallback(async () => {
    if(user && transactions.length > 0) {
        try {
            const result = await generateFinancialInsights(transactions, goals);
            setAiInsight(result);
            markAIUsage(user.uid);
        } catch(e) { console.error("AI Gen failed", e); }
    }
  }, [user, transactions, goals]);

  // --- Logic for Achievements (Memoized) ---
  const achievements = useMemo<Achievement[]>(() => [
    {
      id: 'first_expense',
      title: 'Poupador Iniciante',
      description: 'Adicione sua primeira despesa no aplicativo.',
      iconName: 'FirstExpense',
      isUnlocked: transactions.some(t => t.type === TransactionType.EXPENSE)
    },
    {
      id: 'first_income',
      title: 'Renda Extra',
      description: 'Adicione sua primeira fonte de renda.',
      iconName: 'FirstIncome',
      isUnlocked: transactions.some(t => t.type === TransactionType.INCOME)
    },
    {
      id: 'first_ai',
      title: 'Visão do Futuro',
      description: 'Gere seu primeiro relatório de inteligência artificial.',
      iconName: 'FirstAI',
      isUnlocked: !!userStats.hasUsedAI
    },
    {
      id: 'data_master',
      title: 'Mestre dos Dados',
      description: 'Acumule mais de 10 transações na plataforma.',
      iconName: 'DataMaster',
      isUnlocked: transactions.length >= 10
    },
    {
      id: 'saver_king',
      title: 'Grande Poupador',
      description: 'Tenha mais entradas do que saídas registradas.',
      iconName: 'Saver',
      isUnlocked: transactions.length > 5 && 
                  transactions.filter(t => t.type === TransactionType.INCOME).length > 
                  transactions.filter(t => t.type === TransactionType.EXPENSE).length
    }
  ], [transactions, userStats]);

  // --- Form Handlers ---
  const handleTransactionSubmit = useCallback((data: any) => {
    addTx(data);
    showToast("Transação adicionada!", 'success');
  }, [addTx, showToast]);

  const handleGoalSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if(newGoalData.title && newGoalData.amount && newGoalData.date) {
        addGoal({
            title: newGoalData.title,
            targetAmount: parseFloat(newGoalData.amount),
            currentAmount: 0,
            deadline: newGoalData.date,
            isAI: false,
            isCompleted: false
        });
        setIsGoalFormOpen(false);
        setNewGoalData({ title: '', amount: '', date: '' });
        showToast("Meta criada com sucesso!", 'success');
    }
  }, [newGoalData, addGoal, showToast]);

  const handleLogout = useCallback(() => {
    performLogout();
    setActiveTab('dashboard');
    setAiInsight(null);
  }, [performLogout]);

  // --- Motion Configuration ---
  const motionConfig = useMemo(() => {
    if (settings.performance.fps === 'low') return { reducedMotion: "always" as const, transition: { duration: 0 } };
    if (settings.performance.fps === 'high') return { transition: { type: "spring", stiffness: 500, damping: 35, mass: 0.5 } };
    return { transition: { type: "spring", stiffness: 100, damping: 20 } };
  }, [settings.performance.fps]);

  // --- Loading Screen ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse">Carregando Capitalyx...</p>
        </div>
      </div>
    );
  }

  // --- Auth Screens ---
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-primary/30">
        {/* iOS style ambient glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="z-10 w-full max-w-[340px] md:max-w-[380px]">
          {/* iOS Style Header */}
          <div className="flex flex-col mb-8 text-center md:text-left">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}
              className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[18px] shadow-lg mb-6 flex items-center justify-center mx-auto md:mx-0"
            >
              <LogoIcon size={36} className="text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-1">
              {authMode === 'login' ? 'Bem-vindo' : authMode === 'register' ? 'Criar Conta' : authMode === 'forgot-pass' ? 'Recuperar' : 'Acesso'}
            </h1>
            <p className="text-slate-400 text-[15px]">Capitalyx Finance AI</p>
          </div>

          <div className="w-full">
            <AnimatePresence mode='wait'>
              
              {/* Login/Register Form */}
              {(authMode === 'login' || authMode === 'register') && (
                <motion.div 
                  key="email-auth"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="space-y-5"
                >
                  {/* iOS Segmented Control */}
                  <div className="flex bg-[#767680]/24 p-0.5 rounded-[9px] mb-4">
                    <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 py-1.5 text-[13px] font-semibold rounded-[7px] transition-all ${authMode === 'login' ? 'bg-[#636366] text-white shadow-sm' : 'text-white/60 hover:text-white'}`}>Entrar</button>
                    <button type="button" onClick={() => setAuthMode('register')} className={`flex-1 py-1.5 text-[13px] font-semibold rounded-[7px] transition-all ${authMode === 'register' ? 'bg-[#636366] text-white shadow-sm' : 'text-white/60 hover:text-white'}`}>Cadastrar</button>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); authMode === 'login' ? loginEmail(email, password) : registerEmail(email, password); }} className="space-y-5">
                    {/* iOS Grouped Inputs */}
                    <div className="bg-[#1c1c1e] rounded-xl overflow-hidden border border-white/[0.05]">
                        <div className="relative border-b border-white/[0.05]">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent py-3.5 pl-12 pr-4 text-[17px] text-white placeholder-slate-500 focus:outline-none" placeholder="E-mail" required />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent py-3.5 pl-12 pr-4 text-[17px] text-white placeholder-slate-500 focus:outline-none" placeholder="Senha" required minLength={6} />
                        </div>
                    </div>
                    
                    {authMode === 'login' && (
                      <div className="flex justify-end mt-[-8px]">
                        <button type="button" onClick={() => setAuthMode('forgot-pass')} className="text-[13px] text-blue-500 hover:text-blue-400 font-medium transition-colors">Esqueceu a senha?</button>
                      </div>
                    )}

                    <button type="submit" disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[17px] py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
                      {processing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : (authMode === 'login' ? 'Entrar' : 'Continuar')}
                    </button>
                  </form>

                  {/* Alternative Login Options (iOS List Style) */}
                  <div className="bg-[#1c1c1e] rounded-xl overflow-hidden border border-white/[0.05] mt-6">
                     <button type="button" onClick={() => loginSocial('google')} className="w-full relative border-b border-white/[0.05] flex items-center justify-between p-3.5 active:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-[8px] bg-red-500/10 flex items-center justify-center">
                                <Chrome size={16} className="text-red-500" />
                            </div>
                            <span className="text-[17px] text-white">Google</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-500" />
                     </button>
                     <button type="button" onClick={() => loginSocial('github')} className="w-full relative border-b border-white/[0.05] flex items-center justify-between p-3.5 active:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-[8px] bg-slate-500/10 flex items-center justify-center">
                                <Github size={16} className="text-slate-200" />
                            </div>
                            <span className="text-[17px] text-white">GitHub</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-500" />
                     </button>
                     <button type="button" onClick={() => setAuthMode('phone')} className="w-full relative border-b border-white/[0.05] flex items-center justify-between p-3.5 active:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-[8px] bg-emerald-500/10 flex items-center justify-center">
                                <Smartphone size={16} className="text-emerald-500" />
                            </div>
                            <span className="text-[17px] text-white">Entrar com SMS</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-500" />
                     </button>
                     <button type="button" onClick={() => setAuthMode('login-code')} className="w-full relative flex items-center justify-between p-3.5 active:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-[8px] bg-blue-500/10 flex items-center justify-center">
                                <KeyRound size={16} className="text-blue-500" />
                            </div>
                            <span className="text-[17px] text-white">Usar Código</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-500" />
                     </button>
                  </div>
                </motion.div>
              )}

              {/* Other Auth Modes (Phone, Code, Forgot Pass) */}
              {authMode === 'login-code' && (
                <motion.div key="code-auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                   <button onClick={() => setAuthMode('login')} className="text-blue-500 hover:text-blue-400 flex items-center gap-1 text-[15px] mb-2 -ml-2 p-2"><ArrowLeft size={18}/> Voltar</button>
                   <div>
                       <h2 className="text-2xl font-bold text-white mb-2">Login com Código</h2>
                       <p className="text-[15px] text-slate-400">Digite o código de 6 dígitos gerado em seu dispositivo autenticado.</p>
                   </div>
                   <form onSubmit={(e) => { e.preventDefault(); loginWithCode(loginCode); }} className="space-y-5">
                    <div className="bg-[#1c1c1e] rounded-xl border border-white/[0.05] p-1">
                      <input type="text" value={loginCode} onChange={(e) => setLoginCode(e.target.value)} className="w-full bg-transparent py-4 text-white focus:outline-none tracking-[0.4em] text-center font-mono text-2xl font-bold" required maxLength={6} placeholder="000000" />
                    </div>
                    <button type="submit" disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[17px] py-3.5 rounded-xl transition-all active:scale-[0.98]">{processing ? 'Verificando...' : 'Acessar'}</button>
                   </form>
                </motion.div>
              )}

              {/* Phone Auth */}
              {authMode === 'phone' && (
                <motion.div key="phone-auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                   <button onClick={() => setAuthMode('login')} className="text-blue-500 hover:text-blue-400 flex items-center gap-1 text-[15px] mb-2 -ml-2 p-2"><ArrowLeft size={18}/> Voltar</button>
                   <div>
                       <h2 className="text-2xl font-bold text-white mb-2">Celular</h2>
                       <p className="text-[15px] text-slate-400">Enviaremos um código via SMS para confirmar seu número.</p>
                   </div>
                   <form onSubmit={(e) => { e.preventDefault(); startPhoneAuth(phoneNumber); }} className="space-y-5">
                    <div className="bg-[#1c1c1e] rounded-xl border border-white/[0.05] relative overflow-hidden">
                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full bg-transparent py-3.5 pl-12 pr-4 text-[17px] text-white focus:outline-none" placeholder="+55 11 99999-9999" required />
                    </div>
                    <div id="recaptcha-container" className="flex justify-center"></div>
                    <button type="submit" disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[17px] py-3.5 rounded-xl transition-all active:scale-[0.98]">{processing ? 'Enviando...' : 'Receber Código'}</button>
                   </form>
                </motion.div>
              )}

              {/* OTP Verify */}
              {authMode === 'phone-otp' && (
                 <motion.div key="otp-auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <button onClick={() => setAuthMode('phone')} className="text-blue-500 hover:text-blue-400 flex items-center gap-1 text-[15px] mb-2 -ml-2 p-2"><ArrowLeft size={18}/> Corrigir número</button>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Verificação</h2>
                        <p className="text-[15px] text-slate-400">Digite o código que acabamos de enviar para você.</p>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); verifyOtp(otp); }} className="space-y-5">
                        <div className="bg-[#1c1c1e] rounded-xl border border-white/[0.05] p-1">
                            <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full bg-transparent py-4 text-white focus:outline-none tracking-[0.4em] text-center font-mono text-2xl font-bold" placeholder="000000" maxLength={6} required />
                        </div>
                        <button type="submit" disabled={processing} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[17px] py-3.5 rounded-xl transition-all active:scale-[0.98]">{processing ? 'Verificando...' : 'Confirmar'}</button>
                    </form>
                 </motion.div>
              )}
              
              {/* Forgot Pass */}
              {authMode === 'forgot-pass' && (
                 <motion.div key="forgot-auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <button onClick={() => setAuthMode('login')} className="text-blue-500 hover:text-blue-400 flex items-center gap-1 text-[15px] mb-2 -ml-2 p-2"><ArrowLeft size={18}/> Voltar</button>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h2>
                        <p className="text-[15px] text-slate-400">Informe seu e-mail para receber um link de redefinição de senha.</p>
                    </div>
                    <form onSubmit={async (e) => { 
                        e.preventDefault();
                        const success = await sendPasswordReset(email);
                        if (success) {
                            showToast('Link enviado!', 'success');
                            setAuthMode('login');
                        }
                    }} className="space-y-5">
                        <div className="bg-[#1c1c1e] rounded-xl border border-white/[0.05] relative overflow-hidden">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent py-3.5 pl-12 pr-4 text-[17px] text-white focus:outline-none" placeholder="E-mail da conta" required />
                        </div>
                        <button type="submit" disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[17px] py-3.5 rounded-xl transition-all active:scale-[0.98]">{processing ? 'Enviando...' : 'Enviar Link'}</button>
                    </form>
                 </motion.div>
              )}

            </AnimatePresence>

            {/* Error Display */}
            <AnimatePresence>
                {authError && (
                <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 16 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={16} />
                        <p className="text-[13px] text-red-200">{authError}</p>
                    </div>
                </motion.div>
                )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Global Toast in Auth Screen */}
        <AnimatePresence>
            {toast && (
                <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="fixed top-8 max-w-[90%] bg-[#1c1c1e]/90 backdrop-blur-xl text-white px-5 py-3 rounded-2xl border border-white/[0.05] shadow-2xl flex items-center gap-3 z-50">
                    <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="font-medium text-[15px]">{toast.message}</span>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    );
  }

  // --- Main Application UI ---
  return (
    <MotionConfig {...motionConfig}>
      <Layout user={user} activeTab={activeTab} setActiveTab={setActiveTab} settings={settings} onLogout={handleLogout}>
        <div className="space-y-8 pb-24 relative">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 md:relative z-20">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {activeTab === 'dashboard' && 'Visão Geral'}
                {activeTab === 'transactions' && 'Carteira'}
                {activeTab === 'goals' && 'Metas'}
                {activeTab === 'analytics' && 'Inteligência'}
                {activeTab === 'achievements' && 'Conquistas'}
                {activeTab === 'settings' && 'Ajustes'}
                {activeTab === 'profile' && 'Perfil'}
              </h1>
              <p className="text-slate-400 font-medium">
                Olá, {user.displayName?.split(' ')[0] || 'Usuário'}
              </p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              {activeTab === 'dashboard' && (
                  <button onClick={() => setIsGoalFormOpen(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95 flex-1 md:flex-none justify-center border border-slate-700">
                      <Target size={20} className="text-emerald-400" />
                      <span className="hidden md:inline">Nova Meta</span>
                  </button>
              )}
              
              {!['analytics', 'achievements', 'goals', 'settings', 'profile'].includes(activeTab) && (
                  <button onClick={() => setIsFormOpen(true)} className="bg-primary hover:bg-blue-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-primary/25 flex items-center gap-2 transition-all active:scale-95 flex-1 md:flex-none justify-center">
                      <Plus size={20} />
                      <span className="hidden md:inline">Transação</span>
                      <span className="md:hidden">Novo</span>
                  </button>
                )}
            </div>
          </header>

          {/* Content Switching */}
          <div className="min-h-[60vh]">
            {activeTab === 'dashboard' && (
              <Dashboard transactions={transactions} aiInsight={aiInsight} onGenerateAI={handleGenerateAI} goals={goals} />
            )}
            {activeTab === 'transactions' && (
              <TransactionList transactions={transactions} onDelete={removeTx} onAdd={() => setIsFormOpen(true)} />
            )}
            {activeTab === 'goals' && (
              <Goals goals={goals} onAddGoal={addGoal} onUpdateGoal={updateGoal} onDeleteGoal={removeGoal} suggestions={aiInsight?.suggestedGoals} />
            )}
            {activeTab === 'analytics' && <AIInsights transactions={transactions} goals={goals} />}
            {activeTab === 'achievements' && <Achievements achievements={achievements} />}
            {activeTab === 'profile' && <Profile user={user} transactions={transactions} onUpdateUser={setUser} onShowToast={(msg) => showToast(msg, 'success')} />}
            {activeTab === 'settings' && <Settings user={user} settings={settings} onUpdateSettings={setSettings} onShowToast={(msg) => showToast(msg, 'info')} />}
          </div>
        </div>

        {/* Modals */}
        <TransactionForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSubmit={handleTransactionSubmit} />

        {isGoalFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-surface w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                    <h2 className="text-xl font-bold text-white">Nova Meta Financeira</h2>
                    <button onClick={() => setIsGoalFormOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>
                <form onSubmit={handleGoalSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400 uppercase">Título</label>
                        <input type="text" value={newGoalData.title} onChange={(e) => setNewGoalData({...newGoalData, title: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none" placeholder="Ex: Viagem" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400 uppercase">Valor Alvo (R$)</label>
                        <input type="number" value={newGoalData.amount} onChange={(e) => setNewGoalData({...newGoalData, amount: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none" placeholder="0.00" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400 uppercase">Prazo</label>
                        <input type="date" value={newGoalData.date} onChange={(e) => setNewGoalData({...newGoalData, date: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none" required />
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl mt-4 shadow-lg shadow-emerald-500/20">Criar Meta</button>
                </form>
            </motion.div>
          </div>
        )}

        {/* Global Toast */}
        <AnimatePresence>
            {toast && (
                <motion.div initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 50, x: '-50%' }} className="fixed bottom-8 left-1/2 z-50 bg-slate-800 text-white px-6 py-4 rounded-xl border border-slate-600 shadow-2xl flex items-center gap-3 min-w-[300px]">
                    <Clock className={toast.type === 'success' ? "text-emerald-400" : toast.type === 'error' ? "text-rose-400" : "text-blue-400"} size={20} />
                    <span className="flex-1 font-medium">{toast.message}</span>
                    <button onClick={closeToast} className="text-slate-400 hover:text-white"><X size={16} /></button>
                </motion.div>
            )}
        </AnimatePresence>

      </Layout>
    </MotionConfig>
  );
}

export default App;