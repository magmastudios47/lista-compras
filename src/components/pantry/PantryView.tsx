import React, { useState } from 'react';
import { Category, PantryItem, Unit } from '../../types';
import { CATEGORIES, UNITS } from '../../lib/constants';
import { Archive, Plus, Trash2, Sparkles, Mic, Check, X, Search } from 'lucide-react';

interface PantryViewProps {
  pantryItems: PantryItem[];
  loading: boolean;
  onAddItem: (name: string, quantity: number | null, unit: Unit | null, category: Category) => Promise<any>;
  onUpdateItem: (id: string, updates: Partial<PantryItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onInterpretText: (text: string) => Promise<{ items: Array<{ nombre: string; cantidad: number | null; unidad: Unit | null; categoria: Category }> }>;
  isAiProcessing: boolean;
}

export const PantryView: React.FC<PantryViewProps> = ({
  pantryItems,
  loading,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onInterpretText,
  isAiProcessing,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [isDictateOpen, setIsDictateOpen] = useState(false);
  const [dictateText, setDictateText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Array<{ nombre: string; cantidad: number | null; unidad: Unit | null; categoria: Category; selected: boolean }> | null>(null);

  // Formulario manual
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState<string>('');
  const [newUnit, setNewUnit] = useState<Unit>('unidad');
  const [newCategory, setNewCategory] = useState<Category>('almacen');

  const filteredItems = pantryItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const qtyNum = newQty ? parseFloat(newQty) : null;
    await onAddItem(newName.trim(), qtyNum, qtyNum !== null ? newUnit : null, newCategory);
    setNewName('');
    setNewQty('');
    setIsManualAddOpen(false);
  };

  const handleInterpretFreeText = async () => {
    if (!dictateText.trim()) return;
    const result = await onInterpretText(dictateText.trim());
    if (result?.items && result.items.length > 0) {
      setParsedPreview(result.items.map((it) => ({ ...it, selected: true })));
    }
  };

  const handleConfirmParsedItems = async () => {
    if (!parsedPreview) return;
    const toAdd = parsedPreview.filter((p) => p.selected);
    for (const item of toAdd) {
      await onAddItem(item.nombre, item.cantidad, item.unidad, item.categoria);
    }
    setParsedPreview(null);
    setDictateText('');
    setIsDictateOpen(false);
  };

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto">
      {/* Encabezado de Despensa */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-patagonia-600 dark:text-patagonia-400" />
              <span>Despensa de Casa</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lo que ya tenés en la heladera o alacena para que el Chef no te lo haga comprar.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {pantryItems.length} ítems
          </span>
        </div>

        {/* Acciones principales: Agregar manual o dictar con IA */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={() => setIsDictateOpen(true)}
            className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-chef-500 to-amber-500 hover:from-chef-600 hover:to-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-chef-500/20 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4 fill-white" />
            <span>Dictar a la IA</span>
          </button>
          <button
            onClick={() => setIsManualAddOpen(true)}
            className="py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 text-patagonia-600" />
            <span>Agregar a mano</span>
          </button>
        </div>

        {/* Buscador de despensa */}
        <div className="relative mt-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar en despensa..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-patagonia-500"
          />
        </div>
      </div>

      {/* Lista de productos de la despensa */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-10 px-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 my-4">
          <Archive className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {searchTerm ? 'No se encontraron productos coincidentes.' : 'Tu despensa está vacía. Sumá lo que tenés en casa.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate block">
                  {item.name}
                </span>
                <span className="text-xs text-slate-400">
                  {item.quantity !== null && item.quantity !== undefined
                    ? `${item.quantity} ${item.unit || ''}`
                    : 'En stock (sin cantidad exacta)'}
                </span>
              </div>
              <button
                onClick={() => onDeleteItem(item.id)}
                className="p-1.5 text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-colors"
                title="Quitar de despensa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Dictar texto libre a la IA */}
      {isDictateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-chef-100 dark:bg-chef-950 text-chef-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 fill-chef-500" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Interpretar con Chef IA
                </h3>
              </div>
              <button onClick={() => setIsDictateOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!parsedPreview ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Escribí o pegá lo que tenés en la heladera como te salga natural:
                </p>
                <textarea
                  value={dictateText}
                  onChange={(e) => setDictateText(e.target.value)}
                  placeholder="Ej: tengo huevos, medio kilo de arroz, 2 cebollas, un paquete de fideos y queso cremoso..."
                  rows={4}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chef-500 resize-none font-medium"
                />

                <button
                  type="button"
                  disabled={!dictateText.trim() || isAiProcessing}
                  onClick={handleInterpretFreeText}
                  className="w-full py-3 px-4 rounded-xl bg-chef-500 hover:bg-chef-600 text-white font-bold text-sm shadow-md shadow-chef-500/25 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAiProcessing ? (
                    <span>Interpretando ingredientes...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-white" />
                      <span>Interpretar y Revisar</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Vista previa antes de confirmar */
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-4 h-4" /> El Chef identificó estos productos:
                </p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {parsedPreview.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() =>
                        setParsedPreview((prev) =>
                          prev ? prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)) : null
                        )
                      }
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        item.selected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-xs ${
                            item.selected ? 'bg-emerald-500 text-white' : 'border border-slate-300'
                          }`}
                        >
                          {item.selected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {item.nombre}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {item.cantidad ? `${item.cantidad} ${item.unidad || ''}` : 'Sin cantidad'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleConfirmParsedItems}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                  >
                    Guardar en Despensa
                  </button>
                  <button
                    onClick={() => setParsedPreview(null)}
                    className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold"
                  >
                    Editar texto
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Agregar a mano */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Sumar a la Despensa
              </h3>
              <button onClick={() => setIsManualAddOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Arroz, huevos, aceite..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-patagonia-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Cantidad (opcional)</label>
                  <input
                    type="number"
                    step="any"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    placeholder="Ej: 2"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-patagonia-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Unidad</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value as Unit)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-patagonia-500"
                  >
                    {UNITS.map((u) => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Categoría</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as Category)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-patagonia-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!newName.trim()}
                className="w-full py-3 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all mt-2 disabled:opacity-50"
              >
                Guardar en Despensa
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
