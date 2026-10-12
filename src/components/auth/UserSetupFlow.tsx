import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHousehold } from '../../context/HouseholdContext';
import { ShoppingCart, Sparkles, Home, Link2, ArrowRight, UserCheck } from 'lucide-react';

interface UserSetupFlowProps {
  onBack?: () => void;
}

export const UserSetupFlow: React.FC<UserSetupFlowProps> = ({ onBack }) => {
  const { user, signInWithGoogle, signInWithMagicLink, signInWithLocalName, setDisplayName, isDemoMode } = useAuth();
  const { household, createHousehold, joinHouseholdByCode } = useHousehold();

  // Estados locales para formularios (todos vacíos)
  const [localNameInput, setLocalNameInput] = useState('');
  const [localEmailInput, setLocalEmailInput] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para creación / unión de hogar
  const [householdMode, setHouseholdMode] = useState<'create' | 'join'>('create');
  const [newHhName, setNewHhName] = useState('');
  const [newHhCity, setNewHhCity] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [hhError, setHhError] = useState<string | null>(null);

  // 1. Si no hay usuario autenticado: Pantalla de Ingreso
  if (!user) {
    const handleLocalLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = localNameInput.trim();
      if (!trimmed) {
        setAuthError('Por favor ingresá tu nombre para continuar.');
        return;
      }
      setAuthError(null);
      setIsSubmitting(true);
      try {
        await signInWithLocalName(trimmed, localEmailInput.trim());
      } catch (err: any) {
        setAuthError(err.message || 'Error al iniciar sesión');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleMagicLink = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!localEmailInput.trim()) {
        setAuthError('Ingresá tu correo electrónico.');
        return;
      }
      setAuthError(null);
      setIsSubmitting(true);
      try {
        const res = await signInWithMagicLink(localEmailInput.trim());
        if (res.error) {
          setAuthError(res.error);
        } else {
          setMagicLinkSent(true);
        }
      } catch (err: any) {
        setAuthError(err.message || 'Error al enviar enlace');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 text-center animate-scale-up">
          <div className="w-16 h-16 rounded-2xl bg-patagonia-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-patagonia-600/30">
            <ShoppingCart className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Lista Compars
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 mb-6">
            Compras inteligentes y colaborativas con Chef IA
          </p>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 text-xs font-semibold">
              {authError}
            </div>
          )}

          {magicLinkSent ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm">
              <p className="font-bold mb-1">¡Revisá tu correo!</p>
              <p className="text-xs">Te enviamos un enlace mágico a {localEmailInput} para ingresar directamente.</p>
            </div>
          ) : isDemoMode ? (
            <form onSubmit={handleLocalLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tu nombre para mostrar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Sofía, Carlos..."
                  value={localNameInput}
                  onChange={(e) => setLocalNameInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-patagonia-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Correo electrónico (opcional)
                </label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={localEmailInput}
                  onChange={(e) => setLocalEmailInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-patagonia-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-sm shadow-md shadow-patagonia-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <span>Comenzar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <button
                onClick={signInWithGoogle}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continuar con Google</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">o con email</span>
                </div>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-3 text-left">
                <input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  value={localEmailInput}
                  onChange={(e) => setLocalEmailInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-patagonia-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                >
                  Enviar enlace de acceso
                </button>
              </form>
            </div>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-4 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
            >
              ← Volver a la página principal
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Si el usuario existe pero no tiene displayName: Solicitar Nombre Obligatorio
  if (!user.displayName || user.displayName.trim() === '') {
    const handleSetDisplayName = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = localNameInput.trim();
      if (!trimmed) {
        setAuthError('Ingresá tu nombre para continuar.');
        return;
      }
      setAuthError(null);
      setIsSubmitting(true);
      try {
        await setDisplayName(trimmed);
      } catch (err: any) {
        setAuthError(err.message || 'Error al guardar el nombre');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 text-center animate-scale-up">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
            ¿Cómo te llamás?
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Este nombre se mostrará a los demás integrantes cuando agregues productos a la lista compartida.
          </p>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 text-xs font-semibold">
              {authError}
            </div>
          )}

          <form onSubmit={handleSetDisplayName} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tu nombre o apodo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ej: Marcos, Valentina..."
                value={localNameInput}
                onChange={(e) => setLocalNameInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-patagonia-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !localNameInput.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-sm shadow-md shadow-patagonia-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Si el usuario existe pero no tiene Hogar asignado: Crear o Unirse a Hogar
  if (!household) {
    const handleCreateHh = async (e: React.FormEvent) => {
      e.preventDefault();
      const cleanName = newHhName.trim();
      if (!cleanName) {
        setHhError('El nombre del hogar es obligatorio.');
        return;
      }
      setHhError(null);
      setIsSubmitting(true);
      try {
        await createHousehold(cleanName, newHhCity.trim());
      } catch (err: any) {
        setHhError(err.message || 'Error al crear el hogar');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleJoinHh = async (e: React.FormEvent) => {
      e.preventDefault();
      const cleanCode = joinCodeInput.trim();
      if (!cleanCode) {
        setHhError('Ingresá el código de invitación.');
        return;
      }
      setHhError(null);
      setIsSubmitting(true);
      try {
        const res = await joinHouseholdByCode(cleanCode);
        if (!res.success) {
          setHhError(res.message);
        }
      } catch (err: any) {
        setHhError(err.message || 'Error al unirte al hogar');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 animate-scale-up">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 flex items-center justify-center mx-auto mb-3">
              <Home className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              ¡Hola, {user.displayName}!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configurá tu hogar para compartir la lista y el menú semanal con tu familia o convivencia.
            </p>
          </div>

          {/* Selector de Modo: Crear vs Unirse */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-5">
            <button
              onClick={() => {
                setHouseholdMode('create');
                setHhError(null);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                householdMode === 'create'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Crear mi hogar</span>
            </button>
            <button
              onClick={() => {
                setHouseholdMode('join');
                setHhError(null);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                householdMode === 'join'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Unirme con link/código</span>
            </button>
          </div>

          {hhError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 text-xs font-semibold">
              {hhError}
            </div>
          )}

          {householdMode === 'create' ? (
            <form onSubmit={handleCreateHh} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del hogar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Familia Gómez, Casa Centro..."
                  value={newHhName}
                  onChange={(e) => setNewHhName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-patagonia-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ciudad (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Neuquén, Rosario, Bariloche..."
                  value={newHhCity}
                  onChange={(e) => setNewHhCity(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-patagonia-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !newHhName.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-sm shadow-md shadow-patagonia-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Crear Hogar y Comenzar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinHh} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Código de invitación <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: ABC123XY"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-center tracking-widest text-base focus:outline-none focus:ring-2 focus:ring-patagonia-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Pedile el código de 6 u 8 letras a quien administra tu hogar.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !joinCodeInput.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-sm shadow-md shadow-patagonia-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Unirme al Hogar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return null;
};
