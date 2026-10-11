import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { useAuth } from '../../context/AuthContext';
import { Users, Plus, KeyRound, Share2, Shield, X, Check, Copy, Archive } from 'lucide-react';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInstallGuide: () => void;
}

export const HouseholdModal: React.FC<HouseholdModalProps> = ({
  isOpen,
  onClose,
  onOpenInstallGuide,
}) => {
  const { household, members, createHousehold, joinHouseholdByCode, getWhatsAppInviteUrl, updateHouseholdSettings } = useHousehold();
  const { user, signOut } = useAuth();
  const [newHhName, setNewHhName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHhName.trim()) return;
    try {
      await createHousehold(newHhName.trim());
      setNewHhName('');
      setStatusMessage({ text: '¡Nuevo hogar creado exitosamente!' });
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'Error al crear hogar', error: true });
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const res = await joinHouseholdByCode(joinCode.trim());
    setStatusMessage({ text: res.message, error: !res.success });
    if (res.success) {
      setJoinCode('');
    }
  };

  const handleCopyCode = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-scale-up">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Configuración del Hogar
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs font-semibold ${
              statusMessage.error
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Hogar Actual y Código */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hogar Activo</span>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">{household?.name || 'Mi Hogar'}</h4>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[10px] text-slate-400 block">Código para compartir:</span>
              <span className="font-mono font-extrabold text-base tracking-wider text-patagonia-600 dark:text-patagonia-400">
                {household?.invite_code || '---'}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Copiar código"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Invitar por WhatsApp */}
          <a
            href={getWhatsAppInviteUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Enviar invitación por WhatsApp</span>
          </a>

          {/* Miembros */}
          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">Miembros del hogar:</span>
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.id} className="text-xs flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span>{m.display_name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ajuste del hogar: Al marcar como comprado */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-chef-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Al marcar producto como comprado:
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <button
              type="button"
              onClick={() => updateHouseholdSettings({ pantry_add_mode: 'ask' })}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                (household?.pantry_add_mode || 'ask') === 'ask'
                  ? 'bg-patagonia-600 text-white border-patagonia-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              Preguntar
            </button>
            <button
              type="button"
              onClick={() => updateHouseholdSettings({ pantry_add_mode: 'auto' })}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                household?.pantry_add_mode === 'auto'
                  ? 'bg-patagonia-600 text-white border-patagonia-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              Sumar auto
            </button>
            <button
              type="button"
              onClick={() => updateHouseholdSettings({ pantry_add_mode: 'never' })}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                household?.pantry_add_mode === 'never'
                  ? 'bg-patagonia-600 text-white border-patagonia-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              No sumar
            </button>
          </div>

          <label className="flex items-center gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={household?.pantry_exclude_cleaning !== false}
              onChange={(e) => updateHouseholdSettings({ pantry_exclude_cleaning: e.target.checked })}
              className="rounded text-patagonia-600 focus:ring-patagonia-500 w-4 h-4"
            />
            <span>No sumar productos de limpieza</span>
          </label>
        </div>

        {/* Unirse a otro hogar con código */}
        <form onSubmit={handleJoin} className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-patagonia-500" /> Unirme con código de invitación
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Ej: ABC123"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-patagonia-500 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-xs font-bold transition-colors"
            >
              Unirme
            </button>
          </div>
        </form>

        {/* Crear nuevo hogar */}
        <form onSubmit={handleCreate} className="mt-3 space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5 text-patagonia-500" /> Crear otro hogar
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newHhName}
              onChange={(e) => setNewHhName(e.target.value)}
              placeholder="Nombre del nuevo hogar"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-patagonia-500 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white text-xs font-bold transition-colors"
            >
              Crear
            </button>
          </div>
        </form>

        {/* Botón Guía de instalación PWA */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => {
              onClose();
              onOpenInstallGuide();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
          >
            📱 Guía de instalación en iPhone y Android
          </button>
        </div>

        {/* Aviso de Privacidad obligatorio para IA */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed">
          <Shield className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <p>
            <strong>Privacidad:</strong> Los pedidos realizados al Chef IA son procesados mediante inteligencia artificial (Google Gemini). La aplicación <u>nunca</u> envía tus datos personales, correos electrónicos ni identificadores a los modelos de lenguaje.
          </p>
        </div>

        {/* Sesión de usuario */}
        {user && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 truncate max-w-[180px]">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="text-rose-500 hover:text-rose-600 font-semibold"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
