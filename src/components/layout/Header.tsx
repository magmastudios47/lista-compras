import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { useAuth } from '../../context/AuthContext';
import { Share2, Sparkles, Moon, Sun, Wifi, WifiOff, Users, Check } from 'lucide-react';

interface HeaderProps {
  isOnline: boolean;
  onOpenHouseholdModal: () => void;
  onOpenChefModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  onOpenHouseholdModal,
  onOpenChefModal,
}) => {
  const { household, remainingQueries, isPremium, getWhatsAppInviteUrl } = useHousehold();
  const { user } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleShareWhatsApp = () => {
    const url = getWhatsAppInviteUrl();
    if (url) {
      window.open(url, '_blank');
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <header className="sticky top-0 z-30 glass-header border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-3 transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Nombre del Hogar y selector */}
        <button
          onClick={onOpenHouseholdModal}
          className="flex items-center gap-2 text-left p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Ver detalles del hogar"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-patagonia-600 to-patagonia-400 flex items-center justify-center text-white font-bold shadow-sm shadow-patagonia-500/20">
            {household?.name ? household.name.charAt(0).toUpperCase() : 'C'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 dark:text-white text-base leading-tight tracking-tight line-clamp-1">
                {household?.name || 'Mi Hogar'}
              </span>
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Cód: {household?.invite_code || '---'}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              {isOnline ? (
                <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 gap-0.5 font-medium">
                  <Wifi className="w-2.5 h-2.5" /> En vivo
                </span>
              ) : (
                <span className="inline-flex items-center text-amber-600 dark:text-amber-400 gap-0.5 font-medium">
                  <WifiOff className="w-2.5 h-2.5" /> Offline
                </span>
              )}
            </p>
          </div>
        </button>

        {/* Acciones del Header */}
        <div className="flex items-center gap-1.5">
          {/* Badge Cuota Chef IA */}
          <button
            onClick={onOpenChefModal}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
              isPremium
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/40'
                : 'bg-chef-50 text-chef-700 dark:bg-chef-950/70 dark:text-chef-300 border border-chef-200 dark:border-chef-800/60'
            }`}
            title="Consultas de Chef restantes en el mes"
          >
            <Sparkles className="w-3.5 h-3.5 text-chef-500 fill-chef-500" />
            <span>{isPremium ? `PRO (${remainingQueries})` : `${remainingQueries} chef`}</span>
          </button>

          {/* Compartir por WhatsApp */}
          <button
            onClick={handleShareWhatsApp}
            className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20 active:scale-95 transition-all"
            title="Invitar por WhatsApp"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* Tema Claro / Oscuro */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-colors"
            title="Cambiar tema"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
