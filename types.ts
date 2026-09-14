// --- Enums & Basic Types ---
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export type ThemeType = 'default' | 'cyberpunk' | 'ocean' | 'sunset';
export type LayoutMode = 'default' | 'minimal' | 'advanced';
export type FpsLevel = 'low' | 'medium' | 'high';

// --- Domain Entities ---
export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO string YYYY-MM-DD
  createdAt: number;
  updatedAt?: number;
}

export interface FinancialGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // ISO string YYYY-MM-DD
  isAI: boolean; 
  isCompleted: boolean;
  createdAt?: number;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber?: string | null;
  bio?: string | null;
  jobTitle?: string | null;
  website?: string | null;
  createdAt?: number;
  lastLogin?: number;
}

export interface UserStats {
  hasUsedAI?: boolean;
  totalTransactions?: number;
  lastAnalysisDate?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  iconName: 'FirstIncome' | 'FirstExpense' | 'FirstAI' | 'DataMaster' | 'Saver';
  isUnlocked: boolean;
  unlockedAt?: string;
  progress?: number; // 0 to 100
}

// --- AI Types ---
export interface AIAnalysisResult {
  summary: string;
  savingsTip: string;
  alert: string | null;
  prediction: string;
  cashFlowTip?: string; 
  suggestedGoals?: { title: string; targetAmount: number; deadline: string }[];
  analyzedAt?: number;
}

// --- Configuration Types ---
export interface AppSettings {
  performance: {
    fps: FpsLevel;
    highPerformanceMode: boolean;
  };
  visual: {
    theme: ThemeType;
    layoutMode: LayoutMode;
    scale: number; // 0.8 a 1.2
  };
  account: {
    autoLogin: boolean;
    notificationsEnabled?: boolean;
  };
}

// --- UI State Types ---
export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  savingsRate: number; // Percentage
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export interface LoadingState {
  auth: boolean;
  data: boolean;
  ai: boolean;
  action: boolean; // For button loading states
}

// --- Global Extensions ---
declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
