import React, { useState } from 'react';
import { ShieldAlert, KeyRound, ShoppingCart, UserPlus, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHousehold } from '../../context/HouseholdContext';
import { MercadoPagoModal } from '../payment/MercadoPagoModal';

export const AccessGateView: React.FC = () => {
  const { user, signOut } = useAuth();
  const {
    household,
    redeemAccessCode,
    previewInvite,
    joinByInvite,
    refreshLicense,
  } = useHousehold();

  const [activeOption, setActiveOption] = useState<'code' | 'buy' | 'invite'>('code');

  // Estado para Canje de Código
  const [accessCode, setAccessCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);

  // Estado para Unirse por Invitación
  const [inviteToken, setInviteToken] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitePreview, setInvitePreview] = useState<{
    householdId?: string;
    householdName?: string;
    householdCity?: string;
    requiresApproval?: boolean;
  } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Modal de Mercado Pago
  const [isMpModalOpen, setIsMpModalOpen] = useState(false);
  const [selectedPlanForBuy, setSelectedPlanForBuy] = useState<'base' | 'premium'>('base');

  // Manejar Canje de Código de Acceso
  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    setCodeLoading(true);
    setCodeError(null);
    setCodeSuccess(null);

    const res = await redeemAccessCode(accessCode.trim(), household?.name || 'Mi Hogar');
    setCodeLoading(false);

    if (res.success) {
      setCodeSuccess('¡Código activado con éxito! Tu hogar ya cuenta con licencia.');
      setTimeout(() => {
        refreshLicense();
      }, 1200);
    } else {
      setCodeError(res.error || 'Código inválido o agotado.');
    }
  };

  // Previsualizar invitación
  const handleVerifyInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) return;

    setInviteLoading(true);
    setInviteError(null);
    setInvitePreview(null);
    setInviteSuccess(null);

    // Extraer token de una URL si el usuario pegó el enlace completo
    let cleanToken = inviteToken.trim();
    if (cleanToken.includes('invite=')) {
      try {
        const url = new URL(cleanToken);
        cleanToken = url.searchParams.get('invite') || cleanToken;
      } catch {
        const parts = cleanToken.split('invite=');
        cleanToken = parts[1]?.split('&')[0] || cleanToken;
      }
    }

    const res = await previewInvite(cleanToken);
    setInviteLoading(false);

    if (res.valid) {
      setInvitePreview({
        householdId: res.householdId,
        householdName: res.householdName,
        householdCity: res.householdCity,
        requiresApproval: res.requiresApproval,
      });
    } else {
      setInviteError(res.error || 'Invitación no válida o expirada.');
    }
  };

  // Confirmar y unirse al hogar invitado
  const handleConfirmJoin = async () => {
    let cleanToken = inviteToken.trim();
    if (cleanToken.includes('invite=')) {
      try {
        const url = new URL(cleanToken);
        cleanToken = url.searchParams.get('invite') || cleanToken;
      } catch {
        const parts = cleanToken.split('invite=');
        cleanToken = parts[1]?.split('&')[0] || cleanToken;
      }
    }

    setInviteLoading(true);
    setInviteError(null);

    const res = await joinByInvite(cleanToken);
    setInviteLoading(false);

    if (res.success) {
      setInviteSuccess(
        res.pendingApproval
          ? 'Solicitud enviada al dueño del hogar. Te avisaremos cuando la apruebe.'
          : '¡Te uniste al hogar con éxito!'
      );
      setTimeout(() => {
        refreshLicense();
      }, 1500);
    } else {
      setInviteError(res.error || 'No fue posible unirse al hogar.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans px-4 py-8 selection:bg-chef-500 selection:text-white">
      {/* Barra Superior */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-400">Sesión iniciada como</h2>
          <p className="font-bold text-white text-base">{user?.displayName || user?.email || 'Usuario'}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/20 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* Contenedor Principal */}
      <div className="max-w-md mx-auto w-full my-auto py-8">
        {/* Cabecera del Gate */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-lg shadow-amber-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mb-2">Licencia de Hogar Requerida</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Tu hogar <strong className="text-slate-200">{household?.name || 'actual'}</strong> no cuenta con una licencia activa de Lista Compars.
          </p>
        </div>

        {/* Selector de Opciones */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700 mb-6">
          <button
            onClick={() => setActiveOption('code')}
            className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-xs font-bold transition ${
              activeOption === 'code'
                ? 'bg-patagonia-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4 mb-1 text-amber-400" />
            <span>Tengo Código</span>
          </button>

          <button
            onClick={() => setActiveOption('buy')}
            className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-xs font-bold transition ${
              activeOption === 'buy'
                ? 'bg-patagonia-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingCart className="w-4 h-4 mb-1 text-chef-400" />
            <span>Comprar</span>
          </button>

          <button
            onClick={() => setActiveOption('invite')}
            className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-xs font-bold transition ${
              activeOption === 'invite'
                ? 'bg-patagonia-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4 mb-1 text-emerald-400" />
            <span>Me invitaron</span>
          </button>
        </div>

        {/* Tarjeta de Contenido según la opción */}
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-3xl p-6 shadow-xl backdrop-blur-sm">
          {/* OPCIÓN 1: TENGO UN CÓDIGO */}
          {activeOption === 'code' && (
            <div>
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>Canjear código de acceso</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Si recibiste un código de activación de compra o regalo, ingresalo a continuación para activar tu hogar de por vida.
              </p>

              <form onSubmit={handleRedeemCode} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="Ej: COMPARS-BASE-7X9K2M"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-3 text-white text-sm font-mono tracking-wider placeholder:text-slate-500 outline-none uppercase"
                    disabled={codeLoading}
                  />
                </div>

                {codeError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{codeError}</span>
                  </div>
                )}

                {codeSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{codeSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={codeLoading || !accessCode.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-sm hover:opacity-95 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2"
                >
                  {codeLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{codeLoading ? 'Validando...' : 'Activar Licencia'}</span>
                </button>
              </form>
            </div>
          )}

          {/* OPCIÓN 2: COMPRAR ACCESO */}
          {activeOption === 'buy' && (
            <div>
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-chef-400" />
                <span>Adquirir licencia para tu hogar</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Pago único de por vida con Mercado Pago. Toda tu familia queda cubierta con una sola compra.
              </p>

              <div className="space-y-3 mb-5">
                {/* Plan Base */}
                <div
                  onClick={() => setSelectedPlanForBuy('base')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                    selectedPlanForBuy === 'base'
                      ? 'bg-slate-700/60 border-chef-500 ring-1 ring-chef-500'
                      : 'bg-slate-900/40 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm text-white">Plan Base Hogar</div>
                    <div className="text-xs text-slate-400">Hasta 6 integrantes • Chef IA • Despensa</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-white text-base">US$ 10</div>
                    <div className="text-[10px] text-slate-400">pago único</div>
                  </div>
                </div>

                {/* Plan Premium */}
                <div
                  onClick={() => setSelectedPlanForBuy('premium')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                    selectedPlanForBuy === 'premium'
                      ? 'bg-slate-700/60 border-chef-500 ring-1 ring-chef-500'
                      : 'bg-slate-900/40 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-1.5">
                      <span>Plan Premium Hogar</span>
                      <span className="text-[9px] font-black bg-chef-500 text-slate-950 px-1.5 py-0.5 rounded-full">POPULAR</span>
                    </div>
                    <div className="text-xs text-slate-400">Hasta 8 integrantes • Menú 7 días • SEPA</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-white text-base">US$ 20</div>
                    <div className="text-[10px] text-slate-400">pago único</div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMpModalOpen(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-chef-500 to-amber-500 text-slate-950 font-black text-sm hover:opacity-95 transition shadow-lg shadow-chef-500/20"
              >
                Pagar con Mercado Pago ({selectedPlanForBuy === 'premium' ? 'US$ 20' : 'US$ 10'})
              </button>
            </div>
          )}

          {/* OPCIÓN 3: ME INVITARON A UN HOGAR */}
          {activeOption === 'invite' && (
            <div>
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Unirme con link o invitación</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Pegá el enlace o token de invitación que te compartió el dueño de un hogar con licencia activa.
              </p>

              {!invitePreview ? (
                <form onSubmit={handleVerifyInvite} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      placeholder="Pegá el link o token de invitación..."
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 outline-none"
                      disabled={inviteLoading}
                    />
                  </div>

                  {inviteError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{inviteError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={inviteLoading || !inviteToken.trim()}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2"
                  >
                    {inviteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{inviteLoading ? 'Verificando...' : 'Verificar Invitación'}</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/40 text-center">
                    <p className="text-xs text-slate-400 mb-1">Te invitaron a unirte a:</p>
                    <h4 className="text-lg font-black text-white">{invitePreview.householdName}</h4>
                    {invitePreview.householdCity && (
                      <p className="text-xs text-slate-400">{invitePreview.householdCity}</p>
                    )}
                  </div>

                  {inviteError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{inviteError}</span>
                    </div>
                  )}

                  {inviteSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{inviteSuccess}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInvitePreview(null)}
                      className="w-1/3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition"
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmJoin}
                      disabled={inviteLoading}
                      className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-md"
                    >
                      {inviteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{inviteLoading ? 'Uniéndote...' : 'Confirmar y Unirme'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pago de Mercado Pago */}
      {isMpModalOpen && (
        <MercadoPagoModal
          isOpen={isMpModalOpen}
          onClose={() => setIsMpModalOpen(false)}
        />
      )}
    </div>
  );
};
