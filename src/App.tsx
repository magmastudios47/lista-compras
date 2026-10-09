import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { BottomNav, ActiveTab } from './components/layout/BottomNav';
import { ShoppingList } from './components/shopping/ShoppingList';
import { PantryView } from './components/pantry/PantryView';
import { WeeklyMenuView } from './components/menu/WeeklyMenuView';
import { ChefModal } from './components/chef/ChefModal';
import { HouseholdModal } from './components/household/HouseholdModal';
import { InstallPromptModal } from './components/pwa/InstallPromptModal';
import { OnboardingModal } from './components/common/OnboardingModal';
import { MercadoPagoModal } from './components/payment/MercadoPagoModal';
import { PaymentReturnView } from './components/payment/PaymentReturnView';
import { OfflineBanner } from './components/common/OfflineBanner';
import { useShoppingList } from './hooks/useShoppingList';
import { usePantry } from './hooks/usePantry';
import { useChefAi } from './hooks/useChefAi';
import { useHousehold } from './context/HouseholdContext';
import { useOfflineSync } from './context/OfflineSyncContext';
import { STORAGE_KEYS } from './lib/constants';
import { ShoppingItem } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('lista');
  const [isReturnView, setIsReturnView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('payment_status') || params.has('status');
  });

  // Modales
  const [isChefModalOpen, setIsChefModalOpen] = useState(false);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isMpModalOpen, setIsMpModalOpen] = useState(false);

  const { isOnline } = useOfflineSync();
  const { household, remainingQueries } = useHousehold();

  const {
    items,
    pendingItems,
    boughtItems,
    loading: loadingShopping,
    undoState: undoShoppingState,
    addItem,
    toggleBought,
    deleteItem,
    clearBoughtItems,
    clearAllItems,
    undoClearShopping,
    commitClearShoppingNow,
  } = useShoppingList();

  const {
    pantryItems,
    loading: loadingPantry,
    undoPantryState,
    addPantryItem,
    updatePantryItem,
    deletePantryItem,
    clearAllPantry,
    undoClearPantry,
    commitClearPantryNow,
  } = usePantry();

  const { interpretPantry, loading: isAiProcessing } = useChefAi();

  // Revisar si es la primera vez que entra para mostrar onboarding
  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN);
    if (!seen) {
      setIsOnboardingOpen(true);
    }
  }, []);

  // Agregar ingredientes del Chef o del Menú Semanal a la lista de compras
  const handleAddIngredientsBatch = async (
    ingredients: Array<{ name: string; quantity: number; unit: any; category: any }>
  ) => {
    for (const ing of ingredients) {
      await addItem(ing.name, ing.quantity, ing.unit, ing.category);
    }
    setActiveTab('lista');
  };

  // Oferta de sumar producto comprado a la despensa
  const handlePromptAddToPantry = async (item: ShoppingItem) => {
    await addPantryItem(item.name, item.quantity, item.unit, item.category);
  };

  // Interpretar texto libre de despensa con IA
  const handleInterpretPantryText = async (text: string) => {
    const res = await interpretPantry(text);
    return res;
  };

  const handleOpenChef = () => {
    setIsChefModalOpen(true);
  };

  if (isReturnView) {
    return (
      <PaymentReturnView
        onBackToApp={() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsReturnView(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-chef-500 selection:text-white">
      {/* Header fijo */}
      <Header
        isOnline={isOnline}
        onOpenHouseholdModal={() => setIsHouseholdModalOpen(true)}
        onOpenChefModal={handleOpenChef}
      />

      {/* Banner de estado offline */}
      <OfflineBanner />

      {/* Contenido Principal por Pestaña */}
      <main className="flex-1 w-full max-w-md mx-auto relative">
        {activeTab === 'lista' && (
          <ShoppingList
            items={items}
            pendingItems={pendingItems}
            boughtItems={boughtItems}
            loading={loadingShopping}
            onAddItem={addItem}
            onToggleBought={toggleBought}
            onDeleteItem={deleteItem}
            onClearBought={clearBoughtItems}
            onClearAll={clearAllItems}
            undoState={undoShoppingState}
            onUndoClear={undoClearShopping}
            onCommitClearNow={commitClearShoppingNow}
            onAddToPantryPrompt={handlePromptAddToPantry}
            onOpenChefModal={handleOpenChef}
          />
        )}

        {activeTab === 'despensa' && (
          <PantryView
            pantryItems={pantryItems}
            loading={loadingPantry}
            onAddItem={addPantryItem}
            onUpdateItem={updatePantryItem}
            onDeleteItem={deletePantryItem}
            onClearAll={clearAllPantry}
            undoState={undoPantryState}
            onUndoClear={undoClearPantry}
            onCommitClearNow={commitClearPantryNow}
            onInterpretText={handleInterpretPantryText}
            isAiProcessing={isAiProcessing}
          />
        )}

        {activeTab === 'menu' && (
          <WeeklyMenuView
            pantryItems={pantryItems}
            onAddIngredientsToShoppingList={handleAddIngredientsBatch}
          />
        )}

        {activeTab === 'hogar' && (
          <div className="p-4 space-y-4 pb-28">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Opciones del Hogar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestioná tu familia, miembros y plan de consultas del Chef IA.
              </p>

              <button
                onClick={() => setIsHouseholdModalOpen(true)}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-between transition-colors"
              >
                <span>Configuración de Integrantes y Código</span>
                <span>→</span>
              </button>

              <button
                onClick={() => setIsMpModalOpen(true)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-chef-500 hover:from-amber-600 hover:to-chef-600 text-white font-bold text-xs flex items-center justify-between shadow-md shadow-amber-500/20 transition-all"
              >
                <span>👑 Plan Premium de por Vida (Mercado Pago)</span>
                <span>→</span>
              </button>

              <button
                onClick={() => setIsInstallModalOpen(true)}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-between transition-colors"
              >
                <span>📱 Cómo instalar la App en tu Celular (PWA)</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Barra de navegación inferior */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'chef') {
            handleOpenChef();
          } else {
            setActiveTab(tab);
          }
        }}
        pendingCount={pendingItems.length}
      />

      {/* Modales Globales */}
      <ChefModal
        isOpen={isChefModalOpen}
        onClose={() => setIsChefModalOpen(false)}
        pantryItems={pantryItems}
        onAddIngredientsToShoppingList={handleAddIngredientsBatch}
      />

      <HouseholdModal
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
        onOpenInstallGuide={() => setIsInstallModalOpen(true)}
      />

      <InstallPromptModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onOpenInstallGuide={() => setIsInstallModalOpen(true)}
      />

      <MercadoPagoModal
        isOpen={isMpModalOpen}
        onClose={() => setIsMpModalOpen(false)}
      />
    </div>
  );
};
