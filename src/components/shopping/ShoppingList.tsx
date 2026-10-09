import React, { useState } from 'react';
import { Category, ShoppingItem, Unit } from '../../types';
import { CATEGORIES } from '../../lib/constants';
import { Check, Trash2, RotateCcw, Plus, Archive, ChevronDown, ChevronUp, ShoppingBag, MoreVertical, X, AlertTriangle, Tag } from 'lucide-react';
import { AddItemDrawer } from './AddItemDrawer';
import { saveHouseholdPrice } from '../../lib/priceMemory';

interface ShoppingListProps {
  items: ShoppingItem[];
  pendingItems: ShoppingItem[];
  boughtItems: ShoppingItem[];
  loading: boolean;
  onAddItem: (name: string, quantity: number, unit: Unit, category: Category, estimatedPrice?: number) => Promise<any>;
  onToggleBought: (id: string) => Promise<boolean>;
  onDeleteItem: (id: string) => Promise<void>;
  onClearBought: () => Promise<void>;
  onClearAll: () => Promise<void>;
  undoState: {
    actionType: 'all' | 'bought';
    itemCount: number;
    secondsLeft: number;
  } | null;
  onUndoClear: () => Promise<void>;
  onCommitClearNow?: () => Promise<void>;
  onUpdateItem?: (id: string, updates: Partial<ShoppingItem>) => Promise<void>;
  onAddToPantryPrompt: (item: ShoppingItem) => void;
  onOpenChefModal: () => void;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({
  items,
  pendingItems,
  boughtItems,
  loading,
  onAddItem,
  onToggleBought,
  onDeleteItem,
  onUpdateItem,
  onClearBought,
  onClearAll,
  undoState,
  onUndoClear,
  onCommitClearNow,
  onAddToPantryPrompt,
  onOpenChefModal,
}) => {
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [showBought, setShowBought] = useState(true);
  const [itemJustBought, setItemJustBought] = useState<ShoppingItem | null>(null);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<string>('');

  // Agrupamiento por categorías
  const groupedPending = CATEGORIES.reduce((acc, cat) => {
    const inCat = pendingItems.filter((i) => i.category === cat.id);
    if (inCat.length > 0) {
      acc[cat.id] = inCat;
    }
    return acc;
  }, {} as Record<Category, ShoppingItem[]>);

  // Total de presupuesto estimado
  const totalEstimated = pendingItems.reduce((sum, item) => sum + (item.estimated_price || 0), 0);

  const handleToggle = async (item: ShoppingItem) => {
    const willBeBought = !item.is_bought;
    await onToggleBought(item.id);

    // Si se acaba de comprar, ofrecer agregar a la despensa
    if (willBeBought) {
      setItemJustBought(item);
      // Auto-ocultar notificación a los 6 segundos
      setTimeout(() => {
        setItemJustBought((curr) => (curr?.id === item.id ? null : curr));
      }, 6000);
    }
  };

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto">
      {/* Barra de utilidades: Presupuesto y Menú protegido de acciones */}
      <div className="mb-3 flex items-center justify-between gap-2">
        {totalEstimated > 0 ? (
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Presupuesto estimado:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              ${totalEstimated.toLocaleString('es-AR')} aprox.
            </span>
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-medium">
            {pendingItems.length} {pendingItems.length === 1 ? 'producto pendiente' : 'productos pendientes'}
          </div>
        )}

        {/* Menú de opciones de vaciado protegido para evitar toques accidentales */}
        <div className="relative">
          <button
            onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Opciones de lista"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isOptionsMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsOptionsMenuOpen(false)}
              />
              <div className="absolute right-0 top-10 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 text-xs animate-scale-up">
                <button
                  onClick={() => {
                    setIsOptionsMenuOpen(false);
                    onClearBought();
                  }}
                  disabled={boughtItems.length === 0}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Vaciar solo comprados</span>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  onClick={() => {
                    setIsOptionsMenuOpen(false);
                    onClearAll();
                  }}
                  disabled={pendingItems.length === 0 && boughtItems.length === 0}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Vaciar lista completa</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lista vacía si no hay ítems */}
      {!loading && pendingItems.length === 0 && boughtItems.length === 0 && (
        <div className="text-center py-12 px-6 bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 my-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">¡Lista vacía!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Agregá productos a mano o pedile al Chef IA que arme la lista según lo que quieras comer.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setIsAddDrawerOpen(true)}
              className="w-full py-3 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-sm shadow-md shadow-patagonia-500/20 active:scale-95 transition-all"
            >
              + Agregar producto a mano
            </button>
            <button
              onClick={onOpenChefModal}
              className="w-full py-3 px-4 rounded-xl bg-chef-500 hover:bg-chef-600 text-white font-bold text-sm shadow-md shadow-chef-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              Consultar al Chef IA
            </button>
          </div>
        </div>
      )}

      {/* Ítems pendientes agrupados por categoría */}
      <div className="space-y-4">
        {Object.entries(groupedPending).map(([catId, itemsInCat]) => {
          const categoryDef = CATEGORIES.find((c) => c.id === catId);
          return (
            <div key={catId} className="space-y-1.5">
              {/* Encabezado de categoría */}
              <div className="flex items-center gap-2 px-1 pt-1">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    categoryDef?.color || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {categoryDef?.label || catId}
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[11px] text-slate-400 font-semibold">{itemsInCat.length}</span>
              </div>

              {/* Tarjetas de ítems */}
              <div className="space-y-1.5">
                {itemsInCat.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-sm active:bg-slate-50 dark:active:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Checkbox grande táctil para el súper */}
                      <button
                        onClick={() => handleToggle(item)}
                        className="w-8 h-8 rounded-xl border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
                      >
                        {item.is_bought && <Check className="w-5 h-5 text-emerald-600 font-bold" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-base leading-tight truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-patagonia-600 dark:text-patagonia-400">
                            {item.quantity} {item.unit}
                          </span>
                          {item.created_by_name && (
                            <>
                              <span>•</span>
                              <span className="truncate">por {item.created_by_name}</span>
                            </>
                          )}
                          {editingPriceItemId === item.id ? (
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="number"
                                autoFocus
                                value={newPriceInput}
                                onChange={(e) => setNewPriceInput(e.target.value)}
                                placeholder="ARS"
                                className="w-20 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                              />
                              <button
                                onClick={async () => {
                                  const parsed = parseFloat(newPriceInput);
                                  if (!isNaN(parsed) && parsed > 0) {
                                    if (onUpdateItem) await onUpdateItem(item.id, { estimated_price: parsed });
                                    saveHouseholdPrice(item.name, parsed, item.household_id);
                                  }
                                  setEditingPriceItemId(null);
                                }}
                                className="px-1.5 py-0.5 bg-emerald-500 text-white rounded text-[10px] font-bold"
                              >
                                OK
                              </button>
                              <button
                                onClick={() => setEditingPriceItemId(null)}
                                className="p-0.5 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              {item.estimated_price ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPriceItemId(item.id);
                                    setNewPriceInput(String(item.estimated_price));
                                  }}
                                  className="text-slate-600 dark:text-slate-300 font-semibold hover:underline"
                                  title="Editar precio"
                                >
                                  • ${item.estimated_price}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPriceItemId(item.id);
                                    setNewPriceInput('');
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-patagonia-600 flex items-center gap-0.5"
                                  title="Cargar precio"
                                >
                                  • <Tag className="w-2.5 h-2.5" /> +Precio
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botón borrar */}
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 rounded-lg transition-colors ml-1"
                      title="Eliminar de la lista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notificación flotante: ¿Sumar a la despensa? */}
      {itemJustBought && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 bg-slate-900 text-white dark:bg-slate-800 dark:text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 animate-slide-up flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Archive className="w-5 h-5 text-chef-400 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold truncate">¿Sumar "{itemJustBought.name}" a la despensa?</p>
              <p className="text-slate-400">Para que el Chef sepa que ya lo tenés en casa.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => {
                onAddToPantryPrompt(itemJustBought);
                setItemJustBought(null);
              }}
              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Sí, sumar
            </button>
            <button
              onClick={() => setItemJustBought(null)}
              className="px-2 py-1.5 text-slate-400 hover:text-white text-xs font-medium"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Sección de Comprados */}
      {boughtItems.length > 0 && (
        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              onClick={() => setShowBought(!showBought)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              <span>Comprados ({boughtItems.length})</span>
              {showBought ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={onClearBought}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Borrar todos
            </button>
          </div>

          {showBought && (
            <div className="space-y-1.5 opacity-75">
              {boughtItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggle(item)}
                      className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <span className="font-medium text-slate-500 dark:text-slate-400 line-through text-sm truncate">
                      {item.name} ({item.quantity} {item.unit})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggle(item)}
                      className="p-1.5 text-slate-400 hover:text-patagonia-600 rounded-lg transition-colors"
                      title="Restaurar a la lista"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Botón flotante para agregar producto rápido con el pulgar */}
      <button
        onClick={() => setIsAddDrawerOpen(true)}
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-patagonia-600 hover:bg-patagonia-700 text-white flex items-center justify-center shadow-lg shadow-patagonia-600/35 active:scale-90 transition-transform"
        title="Agregar producto"
      >
        <Plus className="w-7 h-7 font-bold" />
      </button>

      {/* Toast flotante de Deshacer (10 segundos) */}
      {undoState && (
        <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50 bg-slate-900/95 text-white dark:bg-slate-800/95 backdrop-blur-md p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 animate-slide-up flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {undoState.secondsLeft}s
            </div>
            <div className="text-xs min-w-0">
              <p className="font-bold truncate text-slate-100">
                {undoState.actionType === 'all'
                  ? `Lista vaciada (${undoState.itemCount} ${undoState.itemCount === 1 ? 'producto' : 'productos'})`
                  : `Comprados vaciados (${undoState.itemCount})`}
              </p>
              <p className="text-slate-400 text-[11px]">
                Borrado definitivo en {undoState.secondsLeft} segundos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onUndoClear}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Deshacer</span>
            </button>
            {onCommitClearNow && (
              <button
                onClick={onCommitClearNow}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Eliminar ya"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Drawer para agregar */}
      <AddItemDrawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        onAdd={onAddItem}
      />
    </div>
  );
};
