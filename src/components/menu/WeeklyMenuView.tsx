import React, { useState } from 'react';
import { ChefIngredient, DiscountComparisonResult, PantryItem, WeeklyMealDay } from '../../types';
import { calculatePantryDiscounts, mergeDuplicateIngredients } from '../../lib/discountEngine';
import { CalendarDays, Plus, Trash2, Sparkles, Check, ShoppingCart, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';

interface WeeklyMenuViewProps {
  pantryItems: PantryItem[];
  onAddIngredientsToShoppingList: (items: Array<{ name: string; quantity: number; unit: any; category: any }>) => Promise<any>;
}

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const WeeklyMenuView: React.FC<WeeklyMenuViewProps> = ({
  pantryItems,
  onAddIngredientsToShoppingList,
}) => {
  const [menu, setMenu] = useState<WeeklyMealDay[]>([
    { dia: 'Lunes', cena: 'Milanesas con puré', personas: 4 },
    { dia: 'Martes', cena: 'Tarta de zapallitos', personas: 4 },
    { dia: 'Miércoles', cena: 'Fideos con salsa de tomate', personas: 4 },
    { dia: 'Jueves', cena: 'Pastel de papa', personas: 4 },
    { dia: 'Viernes', cena: 'Pizza casera muzzarella', personas: 4 },
    { dia: 'Sábado', almuerzo: 'Asado tradicional', cena: 'Empanadas de carne', personas: 6 },
    { dia: 'Domingo', almuerzo: 'Ñoquis caseros con tuco', personas: 4 },
  ]);

  const [unifiedPreview, setUnifiedPreview] = useState<DiscountComparisonResult[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Genera ingredientes basados en las recetas seleccionadas y los unifica
  const handleGenerateUnifiedList = () => {
    setIsGenerating(true);

    const allIngredients: ChefIngredient[] = [];

    menu.forEach((item) => {
      const p = item.personas || 4;

      if (item.almuerzo) {
        allIngredients.push(...getRecipeIngredients(item.almuerzo, p));
      }
      if (item.cena) {
        allIngredients.push(...getRecipeIngredients(item.cena, p));
      }
    });

    // 1. Unificar duplicados sumando cantidades con unidades compatibles
    const merged = mergeDuplicateIngredients(allIngredients);

    // 2. Descontar matemáticamente contra la despensa
    const comparisons = calculatePantryDiscounts(merged, pantryItems);

    setUnifiedPreview(comparisons);
    setIsGenerating(false);
  };

  const handleConfirmAndAddToList = async () => {
    if (!unifiedPreview) return;

    const itemsToAdd = unifiedPreview
      .filter((c) => c.seleccionadoParaAgregar && c.cantidad_faltante > 0)
      .map((c) => ({
        name: c.ingrediente.nombre,
        quantity: c.cantidad_faltante,
        unit: c.unidad_faltante,
        category: c.ingrediente.categoria,
      }));

    if (itemsToAdd.length > 0) {
      await onAddIngredientsToShoppingList(itemsToAdd);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }

    setUnifiedPreview(null);
  };

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 flex items-center justify-center font-bold">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Menú Semanal Inteligente
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Elegí las comidas de la semana y generá una lista unificada con cantidades sumadas.
            </p>
          </div>
        </div>
      </div>

      {!unifiedPreview ? (
        <div className="space-y-3">
          {/* Grilla de los 7 días */}
          <div className="space-y-2">
            {menu.map((dayPlan, idx) => (
              <div
                key={dayPlan.dia}
                className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-patagonia-700 dark:text-patagonia-300">
                    {dayPlan.dia}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>{dayPlan.personas} pers.</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  {dayPlan.almuerzo !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-14">Almuerzo:</span>
                      <input
                        type="text"
                        value={dayPlan.almuerzo}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMenu((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, almuerzo: val } : d))
                          );
                        }}
                        placeholder="Ej: Asado, ensalada..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                  )}

                  {dayPlan.cena !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-14">Cena:</span>
                      <input
                        type="text"
                        value={dayPlan.cena}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMenu((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, cena: val } : d))
                          );
                        }}
                        placeholder="Ej: Milanesas con puré..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleGenerateUnifiedList}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-chef-600 via-chef-500 to-amber-500 hover:from-chef-700 hover:to-amber-600 text-white font-bold text-sm shadow-md shadow-chef-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
          >
            <Sparkles className="w-4 h-4 fill-white" />
            <span>Generar Lista de Compras Unificada</span>
          </button>
        </div>
      ) : (
        /* Vista previa unificada */
        <div className="space-y-4 animate-slide-up">
          <div className="p-3.5 rounded-2xl bg-chef-50 dark:bg-chef-950/30 border border-chef-200 dark:border-chef-900/40">
            <h3 className="font-extrabold text-sm text-chef-950 dark:text-chef-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-chef-500 fill-chef-500" />
              <span>Lista de Compras de la Semana Unificada</span>
            </h3>
            <p className="text-xs text-chef-800 dark:text-chef-300 mt-0.5">
              Cantidades calculadas para todos los días y descontando lo que ya hay en tu despensa.
            </p>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {unifiedPreview.map((item, idx) => (
              <div
                key={idx}
                onClick={() =>
                  setUnifiedPreview((prev) =>
                    prev
                      ? prev.map((p, i) =>
                          i === idx ? { ...p, seleccionadoParaAgregar: !p.seleccionadoParaAgregar } : p
                        )
                      : null
                  )
                }
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  item.seleccionadoParaAgregar
                    ? 'border-chef-500 bg-chef-50/40 dark:bg-chef-950/20'
                    : 'border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center ${
                      item.seleccionadoParaAgregar ? 'bg-chef-500 text-white font-bold' : 'border border-slate-300'
                    }`}
                  >
                    {item.seleccionadoParaAgregar && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                      {item.ingrediente.nombre}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Total: {item.cantidad_faltante} {item.unidad_faltante}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.cantidad_faltante > 0
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {item.cantidad_faltante > 0 ? 'Falta' : 'En despensa'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleConfirmAndAddToList}
              className="flex-1 py-3.5 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-xs shadow-md shadow-patagonia-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Agregar faltantes a la lista</span>
            </button>
            <button
              onClick={() => setUnifiedPreview(null)}
              className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
            >
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Generador de ingredientes de recetas populares argentinas
function getRecipeIngredients(dishName: string, persons: number): ChefIngredient[] {
  const d = dishName.toLowerCase();

  if (d.includes('milanesa')) {
    return [
      { nombre: 'nalga para milanesas', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'huevos de campo' },
      { nombre: 'pan rallado', cantidad: Math.round(persons * 90), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'papa', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
    ];
  }

  if (d.includes('tarta') || d.includes('zapallito')) {
    return [
      { nombre: 'zapallito', cantidad: Math.round(persons * 1.5), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'cebolla', cantidad: Math.round(persons * 0.5), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
      { nombre: 'tapa de tarta', cantidad: 1, unidad: 'paquete', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'queso cremoso', cantidad: Math.round(persons * 60), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
    ];
  }

  if (d.includes('fideo') || d.includes('pasta')) {
    return [
      { nombre: 'fideos', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'pure de tomate', cantidad: 1, unidad: 'lata', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'cebolla', cantidad: 1, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
    ];
  }

  if (d.includes('asado')) {
    return [
      { nombre: 'tira de asado', cantidad: Math.round(persons * 400), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'chorizo', cantidad: persons, unidad: 'unidad', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'pan', cantidad: persons, unidad: 'unidad', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
    ];
  }

  // Genérico
  return [
    { nombre: 'arroz', cantidad: Math.round(persons * 80), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'arroz largo fino' },
    { nombre: 'cebolla', cantidad: 1, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
    { nombre: 'tomate perita', cantidad: Math.round(persons * 0.75), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
  ];
}
