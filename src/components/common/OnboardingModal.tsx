import React, { useState } from 'react';
import { ShoppingCart, Sparkles, Smartphone, Check, ArrowRight } from 'lucide-react';
import { STORAGE_KEYS } from '../../lib/constants';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInstallGuide: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOpenInstallGuide,
}) => {
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const handleFinish = () => {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-scale-up">
        {/* Indicador de pasos (1 de 3) */}
        <div className="flex justify-center gap-1.5 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step === s
                  ? 'w-7 bg-patagonia-600'
                  : step > s
                  ? 'w-3 bg-emerald-500'
                  : 'w-3 bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Paso 1: Lista compartida */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 flex items-center justify-center mx-auto">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Lista Compartida en Vivo
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Toda la familia suma y tacha productos en tiempo real. Compartí tu hogar por WhatsApp con un solo toque y unite en 30 segundos.
            </p>
            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-patagonia-500/25 active:scale-95 transition-all mt-4"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Paso 2: Chef IA */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-chef-100 dark:bg-chef-950 text-chef-600 dark:text-chef-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 fill-chef-500" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Chef IA Argentino
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Escribí qué querés comer o qué tenés en la heladera. El Chef descuenta matemáticamente lo que ya hay en tu despensa y agrega solo lo que falta.
            </p>
            <button
              onClick={() => setStep(3)}
              className="w-full py-3.5 px-4 rounded-xl bg-chef-500 hover:bg-chef-600 text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-chef-500/25 active:scale-95 transition-all mt-4"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Paso 3: Instalación PWA */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Smartphone className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Instalala en tu Celular
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Funciona offline dentro del supermercado sin gastar datos. Instalá el icono en tu pantalla de inicio para recibir notificaciones cuando alguien compre.
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={() => {
                  handleFinish();
                  onOpenInstallGuide();
                }}
                className="w-full py-3 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold shadow-md shadow-patagonia-500/25 active:scale-95 transition-all"
              >
                Ver cómo instalar en iOS/Android
              </button>
              <button
                onClick={handleFinish}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700"
              >
                Empezar a usar ahora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
