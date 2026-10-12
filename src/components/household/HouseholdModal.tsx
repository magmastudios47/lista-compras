import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { SaveIndicator } from '../common/SaveIndicator';
import {
  Users,
  Plus,
  KeyRound,
  Share2,
  Shield,
  X,
  Check,
  Copy,
  Archive,
  MapPin,
  UserMinus,
  RefreshCw,
  Sparkles,
  Link,
  ShieldAlert,
} from 'lucide-react';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInstallGuide: () => void;
  onOpenPayment?: (tab?: 'plans' | 'recharges') => void;
}

export const HouseholdModal: React.FC<HouseholdModalProps> = ({
  isOpen,
  onClose,
  onOpenInstallGuide,
  onOpenPayment,
}) => {
  const {
    household,
    members,
    currentPlan,
    creditBalance,
    isOwner,
    createHousehold,
    createInviteLink,
    removeMember,
    updateHouseholdSettings,
  } = useHousehold();

  const { user, signOut } = useAuth();
  const { householdSettings, updateHouseholdSettings: updateSharedSettings } = useSettings();

  const [newHhName, setNewHhName] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Estados del generador de invitaciones
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteUses, setInviteUses] = useState(1);
  const [inviteApproval, setInviteApproval] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  if (!isOpen) return null;

  const maxMembersPerPlan = currentPlan === 'premium' ? 8 : (currentPlan === 'tester' ? 99 : 6);

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

  const handleGenerateInvite = async () => {
    setIsGeneratingInvite(true);
    setStatusMessage(null);
    try {
      const res = await createInviteLink({
        expiresDays: inviteDays,
        maxUses: inviteUses,
        requiresApproval: inviteApproval,
      });
      if (res.success && res.inviteUrl) {
        setGeneratedInviteUrl(res.inviteUrl);
        setStatusMessage({ text: '¡Nuevo enlace de invitación generado! El enlace anterior fue revocado.' });
      } else {
        setStatusMessage({ text: res.error || 'Error generando invitación', error: true });
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'Error generando invitación', error: true });
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedInviteUrl) {
      navigator.clipboard.writeText(generatedInviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas quitar a "${memberName}" del hogar?`)) {
      return;
    }
    const res = await removeMember(targetUserId);
    if (res.success) {
      setStatusMessage({ text: `Se quitó a ${memberName} del hogar.` });
    } else {
      setStatusMessage({ text: res.error || 'Error al quitar integrante', error: true });
    }
  };

  const getWhatsAppShareUrl = (linkUrl: string) => {
    const text = `¡Hola! Sumate a nuestro hogar "${household?.name || 'familiar'}" en Lista Compars tocando acá:\n${linkUrl}\n(Válido por ${inviteDays} días)`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-scale-up">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-1.5">
              <span>Configuración del Hogar</span>
              <SaveIndicator className="ml-1" />
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

        {/* Tarjeta de Hogar Activo y Plan */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hogar Activo</span>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">{household?.name || 'Mi Hogar'}</h4>
              {householdSettings.city && (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span>{householdSettings.city}</span>
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-patagonia-500/10 text-patagonia-600 dark:text-patagonia-400 border border-patagonia-500/20">
              Plan {currentPlan.toUpperCase()}
            </span>
          </div>

          {/* Listado de Integrantes con Tope del Plan */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Integrantes ({members.length} / {maxMembersPerPlan}):
              </span>
              <span className="text-[11px] text-slate-400">
                Tope: {maxMembersPerPlan} personas
              </span>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {members.map((m) => {
                const isCurrentMemberUser = m.user_id === user?.id;
                const canRemove = isOwner && !isCurrentMemberUser && m.role !== 'owner';

                return (
                  <div
                    key={m.id}
                    className="text-xs flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold truncate">{m.display_name}</span>
                      {isCurrentMemberUser && (
                        <span className="text-[10px] text-patagonia-500 font-bold">(Tú)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                        {m.role === 'owner' ? 'Propietario' : 'Miembro'}
                      </span>
                      {canRemove && (
                        <button
                          onClick={() => handleRemoveMember(m.user_id, m.display_name)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Quitar integrante"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GENERADOR DE ENLACE SEGURO (Solo para Dueños) */}
          {isOwner && (
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-2 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-patagonia-500" />
                <span>Invitar integrantes (Enlace Seguro 128-bit)</span>
              </span>

              {/* Opciones del enlace */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Validez:</label>
                  <select
                    value={inviteDays}
                    onChange={(e) => setInviteDays(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value={1}>1 día</option>
                    <option value={7}>7 días (recomendado)</option>
                    <option value={14}>14 días</option>
                    <option value={30}>30 días</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Usos máximos:</label>
                  <select
                    value={inviteUses}
                    onChange={(e) => setInviteUses(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value={1}>1 uso (exclusivo)</option>
                    <option value={3}>Hasta 3 personas</option>
                    <option value={5}>Hasta 5 personas</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 mb-3 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteApproval}
                  onChange={(e) => setInviteApproval(e.target.checked)}
                  className="rounded text-patagonia-600 focus:ring-patagonia-500 w-3.5 h-3.5"
                />
                <span>Requerir mi aprobación antes de unirse</span>
              </label>

              <button
                type="button"
                onClick={handleGenerateInvite}
                disabled={isGeneratingInvite}
                className="w-full py-2 px-3 rounded-xl bg-patagonia-600 hover:bg-patagonia-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingInvite ? 'animate-spin' : ''}`} />
                <span>{generatedInviteUrl ? 'Generar nuevo link (invalida el anterior)' : 'Generar link de invitación'}</span>
              </button>

              {/* Si se generó un link */}
              {generatedInviteUrl && (
                <div className="mt-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-patagonia-500/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteUrl}
                      className="text-xs bg-slate-50 dark:bg-slate-800 px-2 py-1.5 rounded-lg font-mono text-slate-700 dark:text-slate-300 w-full truncate border border-slate-200 dark:border-slate-700 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="p-2 rounded-lg bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 hover:bg-patagonia-200 transition shrink-0"
                      title="Copiar link"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <a
                    href={getWhatsAppShareUrl(generatedInviteUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Compartir por WhatsApp</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Uso de IA y Créditos (Para Dueño e Integrantes) */}
        <div className="mt-4 p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Uso de IA y Créditos
              </span>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
              {creditBalance} {creditBalance === 1 ? 'crédito' : 'créditos'}
            </span>
          </div>

          <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5 leading-tight">
            <div className="flex justify-between">
              <span>Plan asignado:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                {currentPlan === 'premium' ? 'Premium (150/mes)' : currentPlan === 'base' ? 'Base (40/mes)' : currentPlan === 'tester' ? 'Tester Ilimitado' : 'Gratuito'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tope de seguridad diario:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">15 créditos / día</span>
            </div>
            <div className="pt-1 border-t border-amber-200/40 dark:border-amber-900/30 text-[10px] text-slate-500 dark:text-slate-400">
              💡 1 crédito = 1 receta del Chef • 8 créditos = Menú semanal (7 días) • Gratis = Interpretar ítems
            </div>
          </div>

          {onOpenPayment && isOwner && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPayment('recharges');
              }}
              className="w-full mt-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ Comprar recarga de créditos (Mercado Pago)</span>
            </button>
          )}
        </div>

        {/* Ajuste del hogar: Al marcar como comprado */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-chef-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Al marcar como comprado:
              </span>
            </div>
            <SaveIndicator />
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <button
              type="button"
              onClick={() => {
                updateHouseholdSettings({ pantry_add_mode: 'ask' });
                updateSharedSettings({ pantryAddMode: 'ask' });
              }}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                (householdSettings.pantryAddMode || 'ask') === 'ask'
                  ? 'bg-patagonia-600 text-white border-patagonia-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              Preguntar
            </button>
            <button
              type="button"
              onClick={() => {
                updateHouseholdSettings({ pantry_add_mode: 'auto' });
                updateSharedSettings({ pantryAddMode: 'auto' });
              }}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                householdSettings.pantryAddMode === 'auto'
                  ? 'bg-patagonia-600 text-white border-patagonia-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              Sumar auto
            </button>
            <button
              type="button"
              onClick={() => {
                updateHouseholdSettings({ pantry_add_mode: 'never' });
                updateSharedSettings({ pantryAddMode: 'never' });
              }}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                householdSettings.pantryAddMode === 'never'
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
              checked={householdSettings.pantryExcludeCleaning !== false}
              onChange={(e) => {
                updateHouseholdSettings({ pantry_exclude_cleaning: e.target.checked });
                updateSharedSettings({ pantryExcludeCleaning: e.target.checked });
              }}
              className="rounded text-patagonia-600 focus:ring-patagonia-500 w-4 h-4"
            />
            <span>No sumar productos de limpieza</span>
          </label>

          {/* Ciudad o zona del hogar */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <label className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-patagonia-500" />
              <span>Ciudad o zona (opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej: Junín de los Andes, Bariloche..."
              value={householdSettings.city || ''}
              onChange={(e) => updateSharedSettings({ city: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-patagonia-500"
            />
          </div>
        </div>

        {/* Crear nuevo hogar */}
        <form onSubmit={handleCreate} className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
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
            <strong>Privacidad:</strong> Los pedidos realizados al Chef IA son procesados mediante inteligencia artificial (Google Gemini). La aplicación <u>nunca</u> envía tus datos personales ni correos a los modelos de lenguaje.
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
