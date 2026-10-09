import React, { useState } from 'react';
import { Category, Unit } from '../../types';
import { CATEGORIES, UNITS } from '../../lib/constants';
import { Plus, Minus, X, Tag } from 'lucide-react';

interface AddItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, quantity: number, unit: Unit, category: Category, estimatedPrice?: number) => Promise<any>;
}

export const AddItemDrawer: React.FC<AddItemDrawerProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<Unit>('unidad');
  const [category, setCategory] = useState<Category>('almacen');
  const [estimatedPrice, setEstimatedPrice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const priceNum = estimatedPrice ? parseFloat(estimatedPrice) : undefined;
      await onAdd(name.trim(), quantity, unit, category, priceNum);
      setName('');
      setQuantity(1);
      setEstimatedPrice('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickSuggestions = ['Tomates', 'Cebollas', 'Leche', 'Huevos', 'Pan', 'Yerba', 'Carne picada', 'Queso cremoso'];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 flex items-center justify-center font-bold">
              +
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Agregar a la Lista</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Nombre del producto */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Producto o ingrediente
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Tomate perita, yerba, nalga..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-patagonia-500 font-medium text-base"
            />
            {/* Sugerencias rápidas */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickSuggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setName(sug)}
                  className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad y Unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Cantidad
              </label>
              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(0.5, q - (q > 1 ? 1 : 0.5)))}
                  className="w-9 h-9 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-white flex items-center justify-center font-bold shadow-sm"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                  className="w-full text-center bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + (q >= 1 ? 1 : 0.5))}
                  className="w-9 h-9 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-white flex items-center justify-center font-bold shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Unidad
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-patagonia-500"
              >
                {UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Categoría del súper
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                    category === cat.id
                      ? 'bg-patagonia-600 text-white shadow-sm ring-2 ring-patagonia-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Precio estimado opcional (Presupuesto) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" /> Precio estimado ARS (opcional)
            </label>
            <input
              type="number"
              value={estimatedPrice}
              onChange={(e) => setEstimatedPrice(e.target.value)}
              placeholder="Ej: 2500"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-patagonia-500"
            />
          </div>

          {/* Botón de Confirmación grande para una sola mano */}
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-base shadow-md shadow-patagonia-500/25 active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Agregando...' : 'Agregar a la lista'}
          </button>
        </form>
      </div>
    </div>
  );
};
