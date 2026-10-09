import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { useAuth } from '../../context/AuthContext';
import { USD_LIFETIME_PRICE, ARS_EXCHANGE_RATE } from '../../lib/constants';
import { Sparkles, Check, ShieldCheck, CreditCard, X, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MercadoPagoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MercadoPagoModal: React.FC<MercadoPagoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { household, isPremium, activatePremium } = useHousehold();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successPaid, setSuccessPaid] = useState(false);

  if (!isOpen) return null;

  const priceArs = Math.round(USD_LIFETIME_PRICE * ARS_EXCHANGE_RATE);

  const handlePay = async () => {
    setLoading(true);

    try {
      // Simulación segura / Sandbox de Mercado Pago
      await new Promise((r) => setTimeout(r, 1200));

      activatePremium();
      setSuccessPaid(true);
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
      });

      setTimeout(() => {
        setSuccessPaid(false);
        onClose();
      }, 2500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white animate-scale-up">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              👑
            </div>
            <h3 className="font-extrabold text-base">Plan Premium del Hogar</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isPremium || successPaid ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>
            <h4 className="font-extrabold text-lg text-emerald-600 dark:text-emerald-400">
              ¡Tu hogar ya es Premium!
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tenés consultas ilimitadas del Chef IA de por vida para todos los integrantes de <strong>{household?.name}</strong>.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold mt-2"
            >
              Volver a la app
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Tarjeta de Precio Único */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-chef-500/10 to-patagonia-500/10 border border-amber-300 dark:border-amber-800/60 text-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                Pago único de por vida
              </span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  ${priceArs.toLocaleString('es-AR')}
                </span>
                <span className="text-xs text-slate-500 font-semibold">ARS</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                (Fijado en USD {USD_LIFETIME_PRICE} • Cotización: ${ARS_EXCHANGE_RATE} ARS/USD)
              </p>
            </div>

            {/* Ventajas para todo el hogar */}
            <div className="space-y-2 text-xs">
              <p className="font-bold text-slate-700 dark:text-slate-300">
                Un solo pago cubre a todos en el hogar:
              </p>
              <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span><strong>Consultas ilimitadas</strong> al Chef IA (sin límite de 40/mes).</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Planificador de <strong>Menú Semanal completo</strong>.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Válido para <strong>todos los miembros</strong> actuales y futuros.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Sin renovaciones mensuales ni cobros sorpresa.</span>
                </div>
              </div>
            </div>

            {/* Botón de Pago con Mercado Pago */}
            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#009ee3] hover:bg-[#0082ba] text-white font-bold text-sm shadow-md shadow-sky-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Conectando con Mercado Pago...</span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Pagar con Mercado Pago</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pago seguro procesado por Mercado Pago Argentina</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
