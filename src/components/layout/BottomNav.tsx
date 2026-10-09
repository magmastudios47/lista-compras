import React from 'react';
import { ShoppingCart, Sparkles, Archive, CalendarDays, Home } from 'lucide-react';

export type ActiveTab = 'lista' | 'chef' | 'despensa' | 'menu' | 'hogar';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  pendingCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  pendingCount,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-slate-200/80 dark:border-slate-800/80 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-1 px-3">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {/* Tab 1: Lista de Compras */}
        <button
          onClick={() => onTabChange('lista')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors relative ${
            activeTab === 'lista'
              ? 'text-patagonia-600 dark:text-patagonia-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-patagonia-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1">Lista</span>
        </button>

        {/* Tab 2: Despensa */}
        <button
          onClick={() => onTabChange('despensa')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
            activeTab === 'despensa'
              ? 'text-patagonia-600 dark:text-patagonia-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <Archive className="w-5 h-5" />
          <span className="text-[11px] mt-1">Despensa</span>
        </button>

        {/* Tab 3 CENTRAL: CHEF IA */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            onClick={() => onTabChange('chef')}
            className={`w-14 h-14 rounded-2xl bg-gradient-to-tr from-chef-600 via-chef-500 to-amber-500 text-white flex flex-col items-center justify-center shadow-lg shadow-chef-500/35 active:scale-90 transition-transform ${
              activeTab === 'chef' ? 'ring-4 ring-chef-300 dark:ring-chef-800 scale-105' : 'animate-chef-glow'
            }`}
            title="Chef IA - Cocinar o sugerir recetas"
          >
            <Sparkles className="w-6 h-6 fill-white stroke-white" />
            <span className="text-[10px] font-extrabold uppercase tracking-tight mt-0.5">Chef</span>
          </button>
        </div>

        {/* Tab 4: Menú Semanal (Fase 4) */}
        <button
          onClick={() => onTabChange('menu')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
            activeTab === 'menu'
              ? 'text-patagonia-600 dark:text-patagonia-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-[11px] mt-1">Menú</span>
        </button>

        {/* Tab 5: Hogar / Ajustes */}
        <button
          onClick={() => onTabChange('hogar')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
            activeTab === 'hogar'
              ? 'text-patagonia-600 dark:text-patagonia-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] mt-1">Hogar</span>
        </button>
      </div>
    </nav>
  );
};
