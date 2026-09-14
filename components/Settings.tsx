import React, { useState, useEffect } from 'react';
import { AppSettings, UserProfile } from '../types';
import { updateUserEmail, auth, generateLoginCode, getStoredLoginCode, LoginCodeData } from '../services/firebase';
import { 
  Settings as SettingsIcon, 
  Monitor, 
  Eye, 
  User, 
  Battery, 
  Zap, 
  LayoutTemplate, 
  Maximize, 
  Mail, 
  ShieldAlert,
  Save,
  Layers,
  KeyRound,
  RefreshCw,
  Clock,
  Copy
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SettingsProps {
  user: UserProfile;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onShowToast: (message: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ user, settings, onUpdateSettings, onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'performance' | 'visual' | 'account'>('performance');
  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  
  // Login Code State
  const [loginCodeData, setLoginCodeData] = useState<LoginCodeData | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [loadingCode, setLoadingCode] = useState(false);

  // Fetch Login Code on mount
  useEffect(() => {
    const fetchCode = async () => {
      if (user.uid) {
        const data = await getStoredLoginCode(user.uid);
        if (data) {
           // We don't auto-regenerate on mount anymore to respect user action/cooldown visual
           setLoginCodeData(data);
           calculateDays(data.expiresAt);
        }
      }
    };
    if(activeTab === 'account') {
        fetchCode();
    }
  }, [user.uid, activeTab]);

  const calculateDays = (expiresAt: number) => {
    const diff = expiresAt - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    setDaysRemaining(days > 0 ? days : 0);
  };

  const handleGenerateCode = async () => {
    setLoadingCode(true);
    try {
      const data = await generateLoginCode(user.uid);
      setLoginCodeData(data);
      calculateDays(data.expiresAt);
      onShowToast("Novo código de login gerado com sucesso.");
    } catch (error: any) {
      console.error("Error generating code", error);
      if (error.message === 'COOLDOWN') {
          onShowToast("Por segurança, aguarde 1 dia para gerar um novo código.");
      } else {
          onShowToast("Erro ao gerar código. Tente novamente.");
      }
    } finally {
      setLoadingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (loginCodeData?.code) {
        navigator.clipboard.writeText(loginCodeData.code);
        onShowToast("Código copiado para a área de transferência!");
    }
  };

  const handleFpsChange = (fps: 'low' | 'medium' | 'high') => {
    onUpdateSettings({
      ...settings,
      performance: { ...settings.performance, fps }
    });
  };

  const handleHighPerformanceToggle = () => {
    onUpdateSettings({
      ...settings,
      performance: { 
        ...settings.performance, 
        highPerformanceMode: !settings.performance.highPerformanceMode 
      }
    });
  };

  const handleThemeChange = (theme: 'default' | 'cyberpunk' | 'ocean' | 'sunset') => {
    onUpdateSettings({
      ...settings,
      visual: { ...settings.visual, theme }
    });
  };

  const handleLayoutModeChange = (mode: 'default' | 'minimal' | 'advanced') => {
    onUpdateSettings({
      ...settings,
      visual: { ...settings.visual, layoutMode: mode }
    });
  };

  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({
      ...settings,
      visual: { ...settings.visual, scale: parseFloat(e.target.value) }
    });
  };

  const handleAutoLoginToggle = () => {
    onUpdateSettings({
      ...settings,
      account: { ...settings.account, autoLogin: !settings.account.autoLogin }
    });
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.emailVerified) return; 
    if (!newEmail || !auth.currentUser) return;

    try {
      setEmailStatus('Enviando e-mail de confirmação...');
      await updateUserEmail(auth.currentUser, newEmail);
      setEmailStatus('Um e-mail de verificação foi enviado para o novo endereço. Confirme para alterar.');
      setNewEmail('');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        setEmailStatus('Por segurança, faça login novamente antes de alterar o e-mail.');
      } else {
        setEmailStatus('Erro ao alterar e-mail: ' + error.message);
      }
    }
  };

  const tabs = [
    { id: 'performance', label: 'Desempenho', icon: Monitor },
    { id: 'visual', label: 'Visual', icon: Eye },
    { id: 'account', label: 'Conta', icon: User },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <SettingsIcon className="text-slate-400" />
        Configurações
      </h2>

      <div className="bg-surface rounded-2xl border border-slate-700 overflow-hidden shadow-xl flex flex-col md:flex-row min-h-[500px]">
        
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-slate-900/50 border-b md:border-b-0 md:border-r border-slate-700 p-4">
          <div className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8 bg-surface">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* --- PERFORMANCE TAB --- */}
            {activeTab === 'performance' && (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Zap size={20} className="text-yellow-500" />
                    Opções de FPS
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { val: 'low', label: 'Baixo (Economia)' },
                      { val: 'medium', label: 'Médio (60 FPS)' },
                      { val: 'high', label: 'Alto (Fluido)' }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => handleFpsChange(opt.val as any)}
                        className={`p-4 rounded-xl border text-sm font-medium transition-all ${
                          settings.performance.fps === opt.val
                            ? 'bg-primary/20 border-primary text-primary'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    "Baixo" desativa animações e reduz efeitos visuais para economizar bateria. "Alto" torna as animações mais rápidas e elásticas.
                  </p>
                </div>

                <div className="pt-6 border-t border-slate-700 space-y-4">
                   <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Battery size={20} className="text-green-500" />
                    Otimização
                  </h3>
                  <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-medium text-slate-200">Modo Alto Desempenho</p>
                      <p className="text-xs text-slate-500 mt-1">Remove desfoques (blur), sombras e decorações pesadas.</p>
                    </div>
                    <button 
                      onClick={handleHighPerformanceToggle}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.performance.highPerformanceMode ? 'bg-green-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                        settings.performance.highPerformanceMode ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* --- VISUAL TAB --- */}
            {activeTab === 'visual' && (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <LayoutTemplate size={20} className="text-purple-500" />
                    Tema do Aplicativo
                  </h3>
                   <div className="grid grid-cols-2 gap-4">
                      {/* Default */}
                      <button onClick={() => handleThemeChange('default')} className={`p-4 rounded-xl border relative overflow-hidden group ${settings.visual.theme === 'default' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-700'}`}>
                        <div className="absolute inset-0 bg-slate-900"></div>
                        <div className="relative z-10 flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                          <span className="text-slate-200 font-medium">Padrão</span>
                        </div>
                      </button>
                      {/* Cyberpunk */}
                      <button onClick={() => handleThemeChange('cyberpunk')} className={`p-4 rounded-xl border relative overflow-hidden group ${settings.visual.theme === 'cyberpunk' ? 'border-fuchsia-500 ring-1 ring-fuchsia-500' : 'border-slate-700'}`}>
                        <div className="absolute inset-0 bg-[#0a0a12]"></div>
                        <div className="relative z-10 flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-fuchsia-500"></div>
                          <span className="text-slate-200 font-medium">Cyberpunk</span>
                        </div>
                      </button>
                      {/* Ocean */}
                      <button onClick={() => handleThemeChange('ocean')} className={`p-4 rounded-xl border relative overflow-hidden group ${settings.visual.theme === 'ocean' ? 'border-cyan-500 ring-1 ring-cyan-500' : 'border-slate-700'}`}>
                        <div className="absolute inset-0 bg-slate-900"></div>
                        <div className="relative z-10 flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-cyan-500"></div>
                          <span className="text-slate-200 font-medium">Ocean</span>
                        </div>
                      </button>
                      {/* Sunset */}
                      <button onClick={() => handleThemeChange('sunset')} className={`p-4 rounded-xl border relative overflow-hidden group ${settings.visual.theme === 'sunset' ? 'border-orange-500 ring-1 ring-orange-500' : 'border-slate-700'}`}>
                        <div className="absolute inset-0 bg-[#180808]"></div>
                        <div className="relative z-10 flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                          <span className="text-slate-200 font-medium">Sunset</span>
                        </div>
                      </button>
                   </div>
                </div>

                <div className="pt-6 border-t border-slate-700 space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Layers size={20} className="text-indigo-400" />
                    Layout da Interface
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                        onClick={() => handleLayoutModeChange('minimal')}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${settings.visual.layoutMode === 'minimal' ? 'bg-primary/20 border-primary text-primary' : 'bg-slate-800 border-slate-700'}`}
                    >
                      Minimalista
                    </button>
                    <button
                        onClick={() => handleLayoutModeChange('default')}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${settings.visual.layoutMode === 'default' ? 'bg-primary/20 border-primary text-primary' : 'bg-slate-800 border-slate-700'}`}
                    >
                      Padrão
                    </button>
                    <button
                        onClick={() => handleLayoutModeChange('advanced')}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${settings.visual.layoutMode === 'advanced' ? 'bg-primary/20 border-primary text-primary' : 'bg-slate-800 border-slate-700'}`}
                    >
                      Avançado
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-700 space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Maximize size={20} className="text-blue-400" />
                    Redimensionar Tela
                  </h3>
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                      <span>Pequeno (80%)</span>
                      <span>Normal (100%)</span>
                      <span>Grande (120%)</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.8" 
                      max="1.2" 
                      step="0.1" 
                      value={settings.visual.scale}
                      onChange={handleScaleChange}
                      className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p className="text-center text-sm font-bold text-primary mt-2">
                      {Math.round(settings.visual.scale * 100)}%
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* --- ACCOUNT TAB --- */}
            {activeTab === 'account' && (
               <>
                {/* LOGIN CODE GENERATOR */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <KeyRound size={20} className="text-cyan-400" />
                    Código de Login
                  </h3>
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <p className="text-sm text-slate-400 mb-4">
                      Este código de 6 dígitos permite que você faça login em outros dispositivos sem senha. 
                      O código expira automaticamente em 7 dias. Você só pode gerar um novo código a cada 24 horas.
                    </p>
                    
                    <div 
                        onClick={handleCopyCode}
                        title="Clique para copiar"
                        className={`flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl border border-slate-700 border-dashed mb-4 relative overflow-hidden group transition-colors ${loginCodeData ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                    >
                       {loadingCode ? (
                           <RefreshCw className="animate-spin text-cyan-400" size={32} />
                       ) : loginCodeData ? (
                          <>
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Copy size={16} className="text-slate-400" />
                            </div>
                            <span className="text-4xl font-mono font-bold text-cyan-400 tracking-[0.2em]">{loginCodeData.code}</span>
                            <div className="mt-4 flex items-center gap-2 text-slate-500 text-sm">
                                <Clock size={16} />
                                <span>Expira em <strong className="text-white">{daysRemaining} dias</strong></span>
                            </div>
                          </>
                       ) : (
                          <span className="text-slate-500 italic">Nenhum código gerado</span>
                       )}
                    </div>

                    <button 
                      onClick={handleGenerateCode}
                      disabled={loadingCode}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all hover:bg-cyan-500/80"
                    >
                      <RefreshCw size={18} className={loadingCode ? "animate-spin" : ""} />
                      {loginCodeData ? 'Gerar Novo Código' : 'Gerar Código de Login'}
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-700 space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ShieldAlert size={20} className="text-emerald-500" />
                    Preferências de Login
                  </h3>
                  <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-medium text-slate-200">Login Automático</p>
                      <p className="text-xs text-slate-500 mt-1">Manter conectado ao abrir o app.</p>
                    </div>
                    <button 
                      onClick={handleAutoLoginToggle}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.account.autoLogin ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                        settings.account.autoLogin ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-700 space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Mail size={20} className="text-slate-300" />
                    Alterar E-mail
                  </h3>
                  
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    {user.emailVerified ? (
                      <div className="flex items-start gap-3 text-yellow-500 bg-yellow-500/10 p-4 rounded-lg">
                         <ShieldAlert className="shrink-0" size={20} />
                         <p className="text-sm">
                           Seu e-mail <strong>{user.email}</strong> já está verificado. Por razões de segurança, não é possível alterá-lo diretamente por aqui. Entre em contato com o suporte ou crie uma nova conta.
                         </p>
                      </div>
                    ) : (
                      <form onSubmit={handleChangeEmail} className="space-y-4">
                        <p className="text-sm text-slate-400">
                          Seu e-mail atual ({user.email}) ainda não foi verificado. Você pode corrigi-lo abaixo.
                        </p>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Novo E-mail</label>
                          <input 
                            type="email" 
                            required
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                          />
                        </div>
                        <button type="submit" className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                          <Save size={16} />
                          Salvar Alteração
                        </button>
                        {emailStatus && (
                          <p className="text-sm text-emerald-400 mt-2">{emailStatus}</p>
                        )}
                      </form>
                    )}
                  </div>
                </div>
               </>
            )}

          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;