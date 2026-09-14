import React from 'react';
import { UserProfile, AppSettings } from '../types';
import { resendVerificationEmail, auth } from '../services/firebase';
import { 
  LayoutDashboard, 
  Wallet, 
  LogOut, 
  TrendingUp, 
  PieChart, 
  Menu,
  X,
  MailWarning,
  Award,
  Target,
  Settings,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogoIcon } from './LogoIcon';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: AppSettings;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, activeTab, setActiveTab, settings, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [verificationSent, setVerificationSent] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transações', icon: Wallet },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'analytics', label: 'Insights AI', icon: PieChart },
    { id: 'achievements', label: 'Conquistas', icon: Award },
    { id: 'profile', label: 'Meu Perfil', icon: User },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const handleResendVerification = async () => {
    if (auth.currentUser) {
      try {
        await resendVerificationEmail(auth.currentUser);
        setVerificationSent(true);
        setTimeout(() => setVerificationSent(false), 5000);
      } catch (error) {
        console.error("Erro ao reenviar email", error);
        alert("Erro ao enviar. Tente novamente mais tarde.");
      }
    }
  };

  const showVerificationWarning = !user.emailVerified && user.email;

  // --- LOGIC FOR THEMES AND LAYOUTS ---
  
  // Logic: Reduce effects if High Performance Mode is ON OR FPS is Low (Battery Saver)
  const shouldReduceEffects = settings.performance.highPerformanceMode || settings.performance.fps === 'low';

  // 1. Theme Colors
  const getThemeBackground = () => {
    switch (settings.visual.theme) {
      case 'cyberpunk': return 'bg-[#05050a]';
      case 'ocean': return 'bg-[#0f172a]'; // Slate base but will use cyan accents
      case 'sunset': return 'bg-[#180808]'; // Dark red/brown base
      default: return 'bg-background'; // Slate 900
    }
  };

  const getThemeAccent = (isActive: boolean) => {
    switch (settings.visual.theme) {
      case 'cyberpunk':
        return isActive 
          ? 'bg-fuchsia-900/30 text-fuchsia-400 font-medium shadow-lg shadow-fuchsia-500/10' 
          : 'text-muted hover:bg-slate-800/50 hover:text-fuchsia-200';
      case 'ocean':
        return isActive 
          ? 'bg-cyan-900/30 text-cyan-400 font-medium shadow-lg shadow-cyan-500/10' 
          : 'text-muted hover:bg-slate-800/50 hover:text-cyan-200';
      case 'sunset':
        return isActive 
          ? 'bg-orange-900/30 text-orange-400 font-medium shadow-lg shadow-orange-500/10' 
          : 'text-muted hover:bg-slate-800/50 hover:text-orange-200';
      default:
        return isActive 
          ? 'bg-primary/20 text-primary font-medium shadow-lg shadow-primary/10' 
          : 'text-muted hover:bg-slate-700/50 hover:text-slate-200';
    }
  };

  const getLogoGradient = () => {
    switch (settings.visual.theme) {
      case 'cyberpunk': return 'bg-gradient-to-tr from-fuchsia-600 to-purple-600';
      case 'ocean': return 'bg-gradient-to-tr from-cyan-500 to-blue-600';
      case 'sunset': return 'bg-gradient-to-tr from-orange-500 to-red-600';
      default: return 'bg-gradient-to-tr from-primary to-secondary';
    }
  };

  // 2. Layout Modes (Visual structure modifiers)
  // We inject these classes into containers
  const getLayoutContainerClass = () => {
    if (settings.visual.layoutMode === 'minimal') {
      return ''; // No border, plain
    }
    if (settings.visual.layoutMode === 'advanced') {
      if (shouldReduceEffects) {
         return 'border border-slate-700'; // Fallback for battery saver
      }
      return 'border border-slate-700/50 backdrop-blur-xl shadow-2xl'; // More gloss
    }
    return 'border-r border-slate-700'; // Default
  };
  
  const getMobileHeaderClass = () => {
    const base = 'px-4 py-3 flex justify-between items-center fixed top-0 w-full z-50';
    if (settings.visual.layoutMode === 'minimal') {
       return `${base} bg-surface`;
    }
    
    // Check battery saver / reduced effects
    if (shouldReduceEffects) {
        return `${base} bg-surface border-b border-slate-700`;
    }

    if (settings.visual.layoutMode === 'advanced') {
       return `${base} bg-surface/60 backdrop-blur-xl border-b border-white/10`;
    }
    // Default
    return `${base} bg-surface/90 backdrop-blur-md border-b border-slate-700`;
  };

  return (
    <div 
      className={`flex h-screen ${getThemeBackground()} overflow-hidden text-slate-100 transition-colors duration-500`}
      style={{ 
        transform: `scale(${settings.visual.scale})`,
        transformOrigin: 'top left',
        width: `${100 / settings.visual.scale}%`,
        height: `${100 / settings.visual.scale}%`
      }}
    >
      {/* BACKGROUND DECORATIONS FOR ADVANCED LAYOUT */}
      {settings.visual.layoutMode === 'advanced' && !shouldReduceEffects && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
           <div className={`absolute top-0 left-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 ${settings.visual.theme === 'cyberpunk' ? 'bg-fuchsia-600' : 'bg-primary'}`}></div>
           <div className={`absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 ${settings.visual.theme === 'sunset' ? 'bg-orange-600' : 'bg-secondary'}`}></div>
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside className={`hidden md:flex w-64 flex-col bg-surface z-10 transition-all ${getLayoutContainerClass()}`}>
        <div className="p-6 flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getLogoGradient()}`}>
            <LogoIcon size={24} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Capitalyx
          </span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${getThemeAccent(activeTab === item.id)}`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className={`p-4 ${settings.visual.layoutMode === 'minimal' ? '' : 'border-t border-slate-700'}`}>
          <div 
            className="flex items-center gap-3 mb-4 px-2 cursor-pointer hover:bg-slate-700/30 p-2 rounded-lg transition-colors"
            onClick={() => setActiveTab('profile')}
          >
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              alt="User" 
              className="w-10 h-10 rounded-full border-2 border-slate-600 object-cover"
            />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-muted truncate">{user.emailVerified ? 'Verificado' : 'Não Verificado'}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-sm text-danger hover:bg-danger/10 py-2 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className={`md:hidden ${getMobileHeaderClass()}`}>
         <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${getLogoGradient()}`}>
            <LogoIcon size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg">Capitalyx</span>
        </div>
        
        {/* Right side buttons */}
        <div className="flex items-center gap-3">
            {/* Profile Button - UPDATED TO GO TO PROFILE TAB */}
            <button 
              onClick={() => setActiveTab('profile')}
              className="relative p-0.5 rounded-full border border-slate-600 overflow-hidden active:scale-95 transition-transform"
            >
               <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  alt="Perfil" 
                  className="w-8 h-8 rounded-full object-cover"
                />
            </button>
            
            {/* Menu Button */}
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-300">
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 top-16 z-40 bg-background md:hidden p-4"
          >
             <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-lg ${getThemeAccent(activeTab === item.id)}`}
                >
                  <item.icon size={24} />
                  {item.label}
                </button>
              ))}
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-lg text-danger mt-8 border border-slate-800"
              >
                <LogOut size={24} />
                Sair
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0 relative flex flex-col z-10">
        
        {/* Verification Banner */}
        <AnimatePresence>
          {showVerificationWarning && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-3"
            >
              <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <MailWarning className="text-orange-400 shrink-0" size={20} />
                  <p className="text-sm text-orange-100">
                    Sua conta ainda não foi verificada. Verifique seu e-mail ({user.email}) para garantir a segurança da conta.
                  </p>
                </div>
                {verificationSent ? (
                  <span className="text-xs bg-green-500/20 text-green-300 px-3 py-1.5 rounded-lg font-medium">
                    E-mail enviado!
                  </span>
                ) : (
                  <button 
                    onClick={handleResendVerification}
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    Reenviar E-mail
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-4 md:p-8 flex-1">
          <div className="max-w-6xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;