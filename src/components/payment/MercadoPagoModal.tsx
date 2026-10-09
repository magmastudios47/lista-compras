import React, { useState } from 'react';
import { useHousehold, PlanType } from '../../context/HouseholdContext';
import { useAuth } from '../../context/AuthContext';
import { isConfigured, supabase } from '../../lib/supabaseClient';
import { Sparkles, Check, ShieldCheck, CreditCard, X, ArrowUpRight, AlertCircle } from 'lucide-react';

interface MercadoPagoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MercadoPagoModal: React.FC<MercadoPagoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { household, currentPlan } = useHousehold();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'base' | 'premium' | 'upgrade'>(
    currentPlan === 'base' ? 'upgrade' : 'premium'
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const exchangeRate = 1350; // Cotización ARS/USD de referencia

  // Precios oficiales definidos en servidor
  const planPricesUsd = {
    base: 10.0,
    premium: 20.0,
    upgrade: 10.0, // Diferencia de Base (10) a Premium (20)
  };

  const currentPriceUsd = planPricesUsd[selectedPlan];
  const currentPriceArs = Math.round(currentPriceUsd * exchangeRate);

  const handleCreateCheckout = async () => {
    if (!household) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const returnUrl = window.location.origin;

      if (isConfigured) {
        // Invocación a la Edge Function create-checkout de Supabase
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: {
            household_id: household.id,
            plan_id: selectedPlan,
            return_url: returnUrl,
          },
        });

        if (error || !data) {
          throw new Error(error?.message || data?.error || 'Error al conectar con la pasarela de pago.');
        }

        const checkoutUrl = data.init_point || data.sandbox_init_point;
        if (checkoutUrl) {
          // Redirigir al Checkout Pro oficial de Mercado Pago
          // NUNCA se activa el plan desde el cliente: solo el webhook del servidor lo activará
          window.location.href = checkoutUrl;
        } else {
          throw new Error('No se recibió la URL de pago de Mercado Pago.');
        }
      } else {
        // En modo local sin backend conectado: mostrar aviso transparente
        setErrorMessage(
          'Para procesar pagos reales con Checkout Pro, configurá MERCADOPAGO_ACCESS_TOKEN en tu servidor. El plan solo se activará cuando Mercado Pago confirme el pago al webhook.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo generar la preferencia de pago.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white animate-scale-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              👑
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Planes de Lista Compars</h3>
              <p className="text-[11px] text-slate-400">Pago único por hogar • Sin renovación</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estado actual del hogar */}
        <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold">PLAN ACTUAL DEL HOGAR:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
              {currentPlan === 'premium' ? 'Plan Premium (150 consultas/mes)' : currentPlan === 'base' ? 'Plan Base (40 consultas/mes)' : 'Plan Gratuito (5 consultas/mes)'}
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            currentPlan === 'premium'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              : currentPlan === 'base'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
          }`}>
            {currentPlan.toUpperCase()}
          </span>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Selector de Plan */}
        <div className="mt-4 space-y-2">
          {currentPlan !== 'base' && currentPlan !== 'premium' && (
            <div
              onClick={() => setSelectedPlan('base')}
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                selectedPlan === 'base'
                  ? 'border-patagonia-500 bg-patagonia-50/50 dark:bg-patagonia-950/30 ring-2 ring-patagonia-400'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">Plan Base</h4>
                  <p className="text-[11px] text-slate-500">40 consultas del Chef IA/mes • Hasta 10 integrantes</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-sm block">USD 10</span>
                  <span className="text-[10px] text-slate-400">${(10 * exchangeRate).toLocaleString('es-AR')} ARS</span>
                </div>
              </div>
            </div>
          )}

          {currentPlan !== 'premium' && (
            <div
              onClick={() => setSelectedPlan(currentPlan === 'base' ? 'upgrade' : 'premium')}
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                selectedPlan === 'premium' || selectedPlan === 'upgrade'
                  ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-400'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-sm text-amber-950 dark:text-amber-300">
                      {currentPlan === 'base' ? 'Upgrade a Premium' : 'Plan Premium'}
                    </h4>
                    <span className="text-[9px] bg-amber-200 text-amber-900 font-extrabold px-1.5 py-0.2 rounded">RECOMENDADO</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    150 consultas/mes • Menú semanal completo • Estimación de precios
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-sm block">
                    USD {currentPlan === 'base' ? '10' : '20'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ${((currentPlan === 'base' ? 10 : 20) * exchangeRate).toLocaleString('es-AR')} ARS
                  </span>
                </div>
              </div>
            </div>
          )}

          {currentPlan === 'premium' && (
            <div className="py-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center font-bold text-xl">
                ✓
              </div>
              <h4 className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                ¡Tu hogar ya tiene el Plan Premium!
              </h4>
              <p className="text-xs text-slate-500">
                Cuentan con 150 consultas mensuales de Chef IA, menú semanal y seguimiento de precios activo de por vida.
              </p>
            </div>
          )}
        </div>

        {currentPlan !== 'premium' && (
          <div className="mt-4 space-y-3">
            {/* Resumen de cobro en pesos */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-center">
              <span className="text-[11px] text-slate-500 block">Monto a abonar en Mercado Pago:</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  ${currentPriceArs.toLocaleString('es-AR')}
                </span>
                <span className="text-xs text-slate-500 font-semibold">ARS</span>
              </div>
              <p className="text-[10px] text-slate-400">
                (Fijado en USD {currentPriceUsd} al tipo de cambio de referencia de ${exchangeRate} ARS/USD)
              </p>
            </div>

            {/* Botón oficial de Mercado Pago */}
            <button
              onClick={handleCreateCheckout}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#009ee3] hover:bg-[#0082ba] text-white font-bold text-sm shadow-md shadow-sky-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Creando orden en Mercado Pago...</span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Continuar en Mercado Pago</span>
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Checkout Pro seguro. El plan se acredita automáticamente al confirmarse el pago.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
