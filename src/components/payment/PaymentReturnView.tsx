import React, { useEffect, useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { CheckCircle2, Clock, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

interface PaymentReturnViewProps {
  onBackToApp: () => void;
}

export const PaymentReturnView: React.FC<PaymentReturnViewProps> = ({ onBackToApp }) => {
  const { currentPlan, refreshLicense, household } = useHousehold();
  const [checking, setChecking] = useState(true);

  // Leer parámetros de URL
  const searchParams = new URLSearchParams(window.location.search);
  const pathStatus = window.location.pathname.includes('/checkout/success')
    ? 'approved'
    : window.location.pathname.includes('/checkout/pending')
    ? 'pending'
    : window.location.pathname.includes('/checkout/failure')
    ? 'failure'
    : null;
  const statusParam = searchParams.get('payment_status') || searchParams.get('status') || pathStatus;
  const externalRef = searchParams.get('ref') || searchParams.get('external_reference');

  useEffect(() => {
    // Consultar el estado en la base de datos cada 2.5 segundos (hasta 4 veces) para detectar la llegada del webhook
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      await refreshLicense();
      if (attempts >= 4) {
        clearInterval(interval);
        setChecking(false);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [refreshLicense]);

  const handleManualCheck = async () => {
    setChecking(true);
    await refreshLicense();
    setTimeout(() => setChecking(false), 800);
  };

  const isApproved = statusParam === 'approved' || currentPlan !== 'free';
  const isPending = statusParam === 'pending' && currentPlan === 'free';
  const isFailure = statusParam === 'failure' || statusParam === 'rejected';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 flex items-center justify-center">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
        {isApproved ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              ¡Pago Aprobado!
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Mercado Pago acreditó tu pago. Tu hogar <strong>{household?.name}</strong> ya cuenta con el plan{' '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                {currentPlan !== 'free' ? currentPlan : 'activo'}
              </span>.
            </p>
          </>
        ) : isPending ? (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Pago en Proceso
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tu pago está siendo procesado por Mercado Pago. Apenas se confirme, tu licencia se actualizará automáticamente en segundo plano.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Pago no completado
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              La operación fue cancelada o rechazada. No se aplicó ningún cargo a tu cuenta y tu hogar mantiene el plan gratuito.
            </p>
          </>
        )}

        {externalRef && (
          <p className="text-[10px] text-slate-400 font-mono break-all bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
            Ref: {externalRef}
          </p>
        )}

        <div className="pt-2 space-y-2">
          <button
            onClick={handleManualCheck}
            disabled={checking}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>Verificar estado de licencia</span>
          </button>

          <button
            onClick={onBackToApp}
            className="w-full py-3 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-patagonia-500/20 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la Lista de Compras</span>
          </button>
        </div>
      </div>
    </div>
  );
};
