import React, { useEffect, useState } from 'react';
import { Share, PlusSquare, Smartphone, Download, X, CheckCircle2 } from 'lucide-react';

interface InstallPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallPromptModal: React.FC<InstallPromptModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Detectar si ya está instalada en modo standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsInstalled(Boolean(isStandalone));

    // Capturar evento de instalación de Android / Chromium
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!isOpen) return null;

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      onClose();
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Instalar Compars en tu Móvil
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isInstalled ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-slate-900 dark:text-white">¡App ya instalada!</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ya estás usando Lista Compars desde tu pantalla de inicio con soporte sin conexión.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs mt-2"
            >
              Listo
            </button>
          </div>
        ) : isIOS ? (
          /* Instrucciones específicas para iPhone / iPad */
          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              En iPhone, Apple exige instalar la app en la pantalla de inicio para habilitar notificaciones push y uso offline completo:
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div className="w-7 h-7 rounded-lg bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    Tocá el botón Compartir <Share className="w-3.5 h-3.5 text-patagonia-500" />
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Ubicado en la barra de herramientas inferior de Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div className="w-7 h-7 rounded-lg bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    Elegí "Agregar a inicio" <PlusSquare className="w-3.5 h-3.5 text-patagonia-500" />
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Deslizá hacia abajo en el menú de Safari y tocá "Agregar a pantalla de inicio".
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div className="w-7 h-7 rounded-lg bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  3
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    Abrí Compars desde tu inicio
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    ¡Listo! Podrás recibir avisos cuando compren en el súper.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-sm shadow-md shadow-patagonia-500/25 active:scale-95 transition-all mt-2"
            >
              Entendido
            </button>
          </div>
        ) : (
          /* Android / Chrome Desktop */
          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Instalá Lista Compars para acceder al instante desde tu pantalla de inicio, consultar al Chef y tachar ítems sin señal.
            </p>

            {deferredPrompt ? (
              <button
                onClick={handleInstallAndroid}
                className="w-full py-3.5 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-patagonia-500/25 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Instalar App en este dispositivo</span>
              </button>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <p>
                  Para instalar en Android: tocá los tres puntos del navegador (⋮) y seleccioná <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong>.
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
