import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, Transaction } from '../types';
import { updateUserProfileData, getUserProfileData, auth } from '../services/firebase';
import { 
  User, Mail, Phone, Briefcase, Globe, Camera, Link as LinkIcon, 
  Save, Loader2, Image as ImageIcon, CheckCircle, Upload, AlertTriangle, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileProps {
  user: UserProfile;
  transactions: Transaction[];
  onUpdateUser: (user: UserProfile) => void;
  onShowToast: (msg: string) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, transactions, onUpdateUser, onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    displayName: user.displayName || '',
    bio: user.bio || '',
    phoneNumber: user.phoneNumber || '',
    jobTitle: user.jobTitle || '',
    website: user.website || '',
    photoURL: user.photoURL || ''
  });

  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificação de Autenticação Real
  useEffect(() => {
     // Se não houver auth.currentUser, o usuário está logado via código ou estado inconsistente
     if (!auth.currentUser) {
         setIsReadOnly(true);
     } else {
         setIsReadOnly(false);
     }
  }, []);

  // Sync with user prop if it changes externally
  useEffect(() => {
    setFormData(prev => ({
        ...prev,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        bio: user.bio || '',
        phoneNumber: user.phoneNumber || '',
        jobTitle: user.jobTitle || '',
        website: user.website || ''
    }));
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrorMsg(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            onShowToast("A imagem deve ter no máximo 2MB.");
            return;
        }

        setLoading(true);
        try {
            const { storageAPI } = await import('../services/firebase');
            onShowToast("Fazendo upload da imagem...");
            const res = await storageAPI.upload(file);
            
            // The API returns a publicUrl or viewUrl we can use directly in <img> tags
            const finalUrl = res.publicUrl || res.publicViewUrl || res.viewUrl || res.url;
            if (finalUrl) {
                setFormData(prev => ({ ...prev, photoURL: finalUrl }));
                onShowToast("Upload concluído! Salve o perfil para aplicar.");
            } else if (res.id) {
                // Fallback to stream URL if no public URL was provided
                const streamUrl = storageAPI.getStreamUrl(res.id);
                setFormData(prev => ({ ...prev, photoURL: streamUrl }));
                onShowToast("Upload concluído! Salve o perfil para aplicar.");
            } else {
                console.error("Upload response:", res);
                onShowToast("Erro ao obter URL da imagem.");
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            onShowToast("Erro no upload da imagem.");
        } finally {
            setLoading(false);
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    setErrorMsg(null);
    try {
        await updateUserProfileData(user.uid, formData);
        
        // Update local state in App
        onUpdateUser({ ...user, ...formData });
        onShowToast("Perfil atualizado com sucesso!");
    } catch (error: any) {
        console.error("Erro ao atualizar perfil:", error);
        
        // Tratamento amigável de erros
        let msg = error.message || "Erro desconhecido";
        if (msg.includes("PERMISSION_DENIED")) {
            msg = "Permissão negada. Verifique se você está autenticado corretamente.";
        }
        
        setErrorMsg(`Erro ao salvar: ${msg}`);
        onShowToast("Erro ao salvar perfil.");
    } finally {
        setLoading(false);
    }
  };

  // Stats
  const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Recente';
  const totalTx = transactions.length;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      
      {/* Header Banner */}
      <div className="relative h-48 bg-gradient-to-r from-slate-800 to-indigo-900 rounded-3xl overflow-hidden mb-12 shadow-2xl border border-slate-700">
         <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/40 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/40 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4 -mt-24 relative z-10">
        
        {/* LEFT COLUMN: Avatar & Quick Stats */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-1 space-y-6"
        >
            <div className="bg-surface rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col items-center text-center">
                <div className="relative group mb-4">
                    <div className="w-32 h-32 rounded-full border-4 border-surface shadow-2xl overflow-hidden bg-slate-800 relative">
                        {formData.photoURL ? (
                            <img src={formData.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                                <User size={48} />
                            </div>
                        )}
                        {/* Hover Overlay - Only if editable */}
                        {!isReadOnly && (
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <Camera className="text-white" />
                            </div>
                        )}
                    </div>
                    <div className="absolute bottom-1 right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-surface" title="Online"></div>
                </div>
                
                <h2 className="text-xl font-bold text-white">{formData.displayName || 'Usuário Sem Nome'}</h2>
                <p className="text-primary text-sm font-medium mb-1">{formData.jobTitle || 'Membro Capitalyx'}</p>
                <p className="text-slate-400 text-xs flex items-center gap-1 justify-center">
                   Membro desde {joinDate}
                </p>

                <div className="mt-6 w-full pt-6 border-t border-slate-700 grid grid-cols-2 gap-4">
                     <div>
                        <span className="block text-2xl font-bold text-white">{totalTx}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Transações</span>
                     </div>
                     <div>
                        <span className="block text-2xl font-bold text-white">{user.emailVerified ? 'Sim' : 'Não'}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Verificado</span>
                     </div>
                </div>
            </div>

            {/* Image Upload Controls */}
            <div className={`bg-surface rounded-2xl border border-slate-700 p-4 shadow-xl ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <ImageIcon size={16} className="text-primary"/>
                    Alterar Foto
                </h3>
                <div className="flex bg-slate-900 p-1 rounded-lg mb-4">
                    <button 
                        onClick={() => setImageMode('upload')}
                        disabled={isReadOnly}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${imageMode === 'upload' ? 'bg-slate-700 text-white shadow' : 'text-slate-400'}`}
                    >
                        Upload
                    </button>
                    <button 
                         onClick={() => setImageMode('url')}
                         disabled={isReadOnly}
                         className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${imageMode === 'url' ? 'bg-slate-700 text-white shadow' : 'text-slate-400'}`}
                    >
                        Link URL
                    </button>
                </div>

                {imageMode === 'upload' ? (
                    <div 
                        onClick={() => !isReadOnly && fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-600 hover:border-primary hover:bg-slate-800/50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors"
                    >
                        <Upload size={24} className="text-slate-400 mb-2" />
                        <span className="text-xs text-slate-400">Clique para selecionar</span>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            className="hidden"
                            disabled={isReadOnly}
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <input 
                            type="text" 
                            name="photoURL"
                            value={formData.photoURL || ''} 
                            onChange={handleChange}
                            placeholder="https://..." 
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                            disabled={isReadOnly}
                        />
                        <p className="text-[10px] text-slate-500">Cole o link direto da imagem.</p>
                    </div>
                )}
            </div>

        </motion.div>

        {/* RIGHT COLUMN: Edit Form */}
        <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1 }}
             className="lg:col-span-2"
        >
            <div className="bg-surface rounded-2xl border border-slate-700 p-8 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Editar Perfil</h2>
                        <p className="text-slate-400 text-sm">Atualize suas informações pessoais e públicas.</p>
                    </div>
                    {user.emailVerified && (
                        <div className="hidden sm:flex items-center gap-2 bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full border border-green-500/20 text-xs font-medium">
                            <CheckCircle size={14} />
                            Conta Verificada
                        </div>
                    )}
                </div>

                {isReadOnly && (
                    <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-xl flex items-center gap-3 text-sm">
                        <Lock size={20} className="shrink-0 text-amber-500" />
                        <div>
                            <p className="font-bold">Modo de Leitura (Login via Código)</p>
                            <p className="opacity-80">Por segurança, edições de perfil só são permitidas quando logado com E-mail, Google ou Github.</p>
                        </div>
                    </div>
                )}

                {errorMsg && (
                    <div className="mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl flex items-center gap-2 text-sm">
                        <AlertTriangle size={18} className="shrink-0" />
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase">Nome de Exibição</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input 
                                    type="text"
                                    name="displayName"
                                    value={formData.displayName || ''}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Seu nome completo"
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>

                        {/* Job Title */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase">Cargo / Ocupação</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input 
                                    type="text"
                                    name="jobTitle"
                                    value={formData.jobTitle || ''}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Ex: Desenvolvedor, Estudante"
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>

                         {/* Phone */}
                         <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase">Telefone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input 
                                    type="tel"
                                    name="phoneNumber"
                                    value={formData.phoneNumber || ''}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="+55 (00) 00000-0000"
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>

                        {/* Website */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase">Website / Link</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input 
                                    type="url"
                                    name="website"
                                    value={formData.website || ''}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="https://seusite.com"
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>

                        {/* Email (Readonly) */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-medium text-slate-400 uppercase">E-mail (Login)</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input 
                                    type="email"
                                    value={user.email || ''}
                                    disabled
                                    className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2.5 pl-10 text-slate-500 cursor-not-allowed"
                                />
                                <span className="absolute right-3 top-3 text-xs text-slate-600">Não editável</span>
                            </div>
                        </div>

                        {/* Bio */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-medium text-slate-400 uppercase">Biografia</label>
                            <textarea 
                                name="bio"
                                value={formData.bio || ''}
                                onChange={handleChange}
                                rows={4}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Conte um pouco sobre você e seus objetivos financeiros..."
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>

                    {!isReadOnly && (
                        <div className="pt-6 flex justify-end">
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                Salvar Alterações
                            </button>
                        </div>
                    )}

                </form>
            </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;