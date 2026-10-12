import React, { useState } from 'react';
import { ChefMenuResponse, DiscountComparisonResult, MealType, MenuDay, MenuItemMeal, PantryItem } from '../../types';
import { useHousehold } from '../../context/HouseholdContext';
import { useChefAi } from '../../hooks/useChefAi';
import {
  CalendarDays,
  Sparkles,
  Check,
  ShoppingCart,
  RotateCcw,
  AlertCircle,
  Users,
  Utensils,
  ChevronDown,
  ChevronUp,
  Crown,
  Edit2,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface WeeklyMenuViewProps {
  pantryItems: PantryItem[];
  onAddIngredientsToShoppingList: (
    items: Array<{ name: string; quantity: number; unit: any; category: any }>
  ) => Promise<any>;
}

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const MEAL_TYPES: Array<{ id: MealType; label: string; icon: string }> = [
  { id: 'desayuno', label: 'Desayuno', icon: '☀️' },
  { id: 'almuerzo', label: 'Almuerzo', icon: '🍲' },
  { id: 'merienda', label: 'Merienda', icon: '☕' },
  { id: 'cena', label: 'Cena', icon: '🌙' },
];

const PROFILE_OPTIONS = [
  'Deportista',
  'Bajar de peso',
  'Ganar masa muscular',
  'Vegetariano',
  'Económico',
  'Para niños',
  'Sin TACC',
  'Sin lactosa',
  'Comer más sano',
  'Otro',
];

export const WeeklyMenuView: React.FC<WeeklyMenuViewProps> = ({
  pantryItems,
  onAddIngredientsToShoppingList,
}) => {
  const { isPremium, remainingQueries } = useHousehold();
  const {
    generateWeeklyMenu,
    regenerateSingleMeal,
    loading: isGeneratingAi,
    error,
    isAiDemoMode,
  } = useChefAi();

  // Configuración de comidas por día (Lunes a Domingo)
  const [daySelections, setDaySelections] = useState<Record<string, MealType[]>>({
    Lunes: ['almuerzo', 'cena'],
    Martes: ['almuerzo', 'cena'],
    Miércoles: ['almuerzo', 'cena'],
    Jueves: ['almuerzo', 'cena'],
    Viernes: ['almuerzo', 'cena'],
    Sábado: ['almuerzo', 'cena'],
    Domingo: ['almuerzo', 'cena'],
  });

  // Perfil u objetivo
  const [targetProfile, setTargetProfile] = useState<string>('Comer más sano');
  const [profileDetail, setProfileDetail] = useState<string>('');
  const [persons, setPersons] = useState<number>(4);
  const [mandatoryDishes, setMandatoryDishes] = useState<string>('');

  // Menú generado y lista unificada
  const [generatedMenu, setGeneratedMenu] = useState<ChefMenuResponse | null>(null);
  const [unifiedComparisons, setUnifiedComparisons] = useState<DiscountComparisonResult[] | null>(null);
  const [editingMeal, setEditingMeal] = useState<{ dayIndex: number; mealIndex: number; name: string } | null>(null);
  const [regeneratingMealKey, setRegeneratingMealKey] = useState<string | null>(null);

  // Atajos para selección masiva
  const handleSelectAllMealsAllDays = () => {
    const all: Record<string, MealType[]> = {};
    DAYS_OF_WEEK.forEach((d) => {
      all[d] = ['desayuno', 'almuerzo', 'merienda', 'cena'];
    });
    setDaySelections(all);
  };

  const handleSelectLunchAndDinnerOnly = () => {
    const ld: Record<string, MealType[]> = {};
    DAYS_OF_WEEK.forEach((d) => {
      ld[d] = ['almuerzo', 'cena'];
    });
    setDaySelections(ld);
  };

  const handleClearAllMealSelections = () => {
    const empty: Record<string, MealType[]> = {};
    DAYS_OF_WEEK.forEach((d) => {
      empty[d] = [];
    });
    setDaySelections(empty);
  };

  const toggleDayMeal = (day: string, meal: MealType) => {
    setDaySelections((prev) => {
      const current = prev[day] || [];
      const exists = current.includes(meal);
      const next = exists ? current.filter((m) => m !== meal) : [...current, meal];
      return { ...prev, [day]: next };
    });
  };

  // Generar menú semanal con IA
  const handleGenerate = async () => {
    const daysConfig = Object.entries(daySelections)
      .filter(([_, meals]) => meals.length > 0)
      .map(([dia, comidas]) => ({ dia, comidas }));

    if (daysConfig.length === 0) {
      alert('Seleccioná al menos una comida en la semana.');
      return;
    }

    try {
      const { response, comparisons } = await generateWeeklyMenu({
        daysConfig,
        targetProfile,
        profileDetail,
        persons,
        mandatoryDishes,
        pantry: pantryItems,
      });

      setGeneratedMenu(response);
      setUnifiedComparisons(comparisons);
    } catch (e: any) {
      console.error('Error generando menú:', e);
    }
  };

  // Regenerar un plato puntual con IA (Ronda 5 Bloque 2)
  const handleRegenerateMeal = async (dayIndex: number, mealIndex: number) => {
    if (!generatedMenu) return;
    const key = `${dayIndex}-${mealIndex}`;
    setRegeneratingMealKey(key);
    try {
      const { updatedMenu, updatedComparisons } = await regenerateSingleMeal({
        dayIndex,
        mealIndex,
        currentMenu: generatedMenu,
        targetProfile,
        profileDetail,
        persons,
        pantry: pantryItems,
      });
      setGeneratedMenu(updatedMenu);
      setUnifiedComparisons(updatedComparisons);
    } catch (e: any) {
      console.error('Error al regenerar plato:', e);
    } finally {
      setRegeneratingMealKey(null);
    }
  };

  // Reemplazar un plato puntual en la vista previa
  const handleSaveMealEdit = (dayIndex: number, mealIndex: number, newName: string) => {
    if (!generatedMenu) return;
    const updatedDays = [...generatedMenu.dias];
    const targetMeal = updatedDays[dayIndex].comidas[mealIndex];
    if (targetMeal) {
      targetMeal.nombre = newName.trim();
      targetMeal.analisis_plato = [`${newName.trim()}: ingredientes actualizados`];
    }
    setGeneratedMenu({ ...generatedMenu, dias: updatedDays });
    setEditingMeal(null);
  };

  // Quitar un ingrediente de la lista unificada
  const handleToggleComparisonSelection = (idx: number) => {
    setUnifiedComparisons((prev) =>
      prev
        ? prev.map((item, i) =>
            i === idx ? { ...item, seleccionadoParaAgregar: !item.seleccionadoParaAgregar } : item
          )
        : null
    );
  };

  // Confirmar y volcar a la lista de compras compartida
  const handleConfirmAndAddToList = async () => {
    if (!unifiedComparisons) return;

    const toAdd = unifiedComparisons
      .filter((c) => c.seleccionadoParaAgregar && c.cantidad_faltante > 0)
      .map((c) => ({
        name: c.ingrediente.nombre,
        quantity: c.cantidad_faltante,
        unit: c.unidad_faltante,
        category: c.ingrediente.categoria,
      }));

    if (toAdd.length > 0) {
      await onAddIngredientsToShoppingList(toAdd);
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }

    // Regresar al panel inicial
    setGeneratedMenu(null);
    setUnifiedComparisons(null);
  };

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto">
      {/* Cabecera del planificador */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-chef-500 to-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-chef-500/20">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Menú Semanal</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Premium
                </span>
                {isAiDemoMode && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/40">
                    Modo Demo
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Planificá tus comidas con IA y unificá tus compras sin duplicar.
              </p>
            </div>
          </div>
        </div>

        {/* Banner de error visible si falla la IA */}
        {error && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        )}

        {/* Banner de salud fijo */}
        <div className="mt-3 p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="font-medium leading-relaxed text-[11px]">
            Son sugerencias generales, no reemplazan a un nutricionista o profesional de la salud.
          </p>
        </div>
      </div>

      {/* Si ya hay menú generado: VISTA PREVIA */}
      {generatedMenu && unifiedComparisons ? (
        <div className="space-y-4 animate-slide-up">
          {/* Advertencias médicas reales de la IA (eliminando duplicación con el aviso fijo) */}
          {(() => {
            const genuineWarnings = (generatedMenu.advertencias || []).filter((adv) => {
              const norm = adv.toLowerCase();
              return (
                !norm.includes('nutricionista') &&
                !norm.includes('sugerencias generales') &&
                !norm.includes('profesional de la salud')
              );
            });
            if (genuineWarnings.length === 0) return null;
            return (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                {genuineWarnings.map((adv, i) => (
                  <p key={i} className="text-[11px] leading-relaxed">
                    ⚠️ {adv}
                  </p>
                ))}
              </div>
            );
          })()}

          {/* Días y comidas planificadas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Platos Planificados por Día
              </h3>
              <button
                onClick={handleGenerate}
                disabled={isGeneratingAi || Boolean(regeneratingMealKey)}
                className="px-2.5 py-1 text-xs font-bold rounded-xl bg-patagonia-50 hover:bg-patagonia-100 dark:bg-patagonia-950/60 dark:hover:bg-patagonia-900/60 text-patagonia-700 dark:text-patagonia-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Regenerar la semana completa con IA"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                <span>Regenerar semana</span>
              </button>
            </div>

            {generatedMenu.dias.map((diaObj, dIdx) => (
              <div
                key={diaObj.dia}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2"
              >
                <span className="font-extrabold text-sm text-patagonia-600 dark:text-patagonia-400 uppercase tracking-wide">
                  {diaObj.dia}
                </span>

                <div className="space-y-2">
                  {diaObj.comidas.map((comida, mIdx) => {
                    const isEditing = editingMeal?.dayIndex === dIdx && editingMeal?.mealIndex === mIdx;

                    return (
                      <div
                        key={mIdx}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {comida.tipo}
                            </span>
                            {comida.bebida && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                ☕ {comida.bebida}
                              </span>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <input
                                type="text"
                                value={editingMeal.name}
                                onChange={(e) =>
                                  setEditingMeal({ ...editingMeal, name: e.target.value })
                                }
                                className="flex-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                              />
                              <button
                                onClick={() => handleSaveMealEdit(dIdx, mIdx, editingMeal.name)}
                                className="px-2 py-1 rounded-lg bg-emerald-500 text-white font-bold text-xs"
                              >
                                Guardar
                              </button>
                            </div>
                          ) : (
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                              {comida.nombre}
                            </p>
                          )}

                          {comida.por_que_encaja && !isEditing && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {comida.por_que_encaja}
                            </p>
                          )}

                          {/* Pasos resumidos si están disponibles */}
                          {comida.pasos && comida.pasos.length > 0 && !isEditing && (
                            <details className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <summary className="cursor-pointer text-[10px] font-semibold text-patagonia-600 dark:text-patagonia-400 select-none">
                                Ver pasos ({comida.pasos.length})
                              </summary>
                              <ol className="mt-1 pl-4 list-decimal space-y-0.5 text-[10px]">
                                {comida.pasos.map((p, pIdx) => (
                                  <li key={pIdx}>{p}</li>
                                ))}
                              </ol>
                            </details>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleRegenerateMeal(dIdx, mIdx)}
                              disabled={Boolean(regeneratingMealKey) || isGeneratingAi}
                              className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg transition-colors disabled:opacity-40"
                              title="Regenerar este plato con IA"
                            >
                              <RotateCcw
                                className={`w-3.5 h-3.5 ${
                                  regeneratingMealKey === `${dIdx}-${mIdx}`
                                    ? 'animate-spin text-amber-500'
                                    : ''
                                }`}
                              />
                            </button>
                            <button
                              onClick={() =>
                                setEditingMeal({
                                  dayIndex: dIdx,
                                  mealIndex: mIdx,
                                  name: comida.nombre,
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-patagonia-600 rounded-lg transition-colors"
                              title="Editar nombre manualmente"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Lista de compras unificada con descuento de despensa */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-emerald-500" />
                <span>Lista Unificada de Compras</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Desmarcá los ingredientes que ya tengas o no quieras agregar.
              </p>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {unifiedComparisons.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleToggleComparisonSelection(idx)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    item.seleccionadoParaAgregar
                      ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10'
                      : 'border-slate-200 dark:border-slate-800 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                        item.seleccionadoParaAgregar
                          ? 'bg-emerald-500 text-white font-bold'
                          : 'border border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {item.seleccionadoParaAgregar && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className="truncate">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {item.ingrediente.nombre}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {item.cantidad_faltante} {item.unidad_faltante}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
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
                className="flex-1 py-3 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-xs shadow-md shadow-patagonia-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar y agregar a la lista</span>
              </button>
              <button
                onClick={() => {
                  setGeneratedMenu(null);
                  setUnifiedComparisons(null);
                }}
                className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* PANEL DE CONFIGURACIÓN DEL MENÚ */
        <div className="space-y-4">
          {/* Tarjeta de Perfil u Objetivo */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              1. Objetivo o Perfil Nutricional
            </label>

            {/* Chips de opciones rápidas */}
            <div className="flex flex-wrap gap-1.5">
              {PROFILE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTargetProfile(opt)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    targetProfile === opt
                      ? 'bg-patagonia-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {/* Detalle libre */}
            <div>
              <input
                type="text"
                value={profileDetail}
                onChange={(e) => setProfileDetail(e.target.value)}
                placeholder="Ej: Juego al fútbol 4 veces por semana, sin frituras..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-patagonia-500"
              />
            </div>

            {/* Cantidad de personas y platos obligatorios */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Personas
                </label>
                <select
                  value={persons}
                  onChange={(e) => setPersons(Number(e.target.value))}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'persona' : 'personas'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Platos obligatorios
                </label>
                <input
                  type="text"
                  value={mandatoryDishes}
                  onChange={(e) => setMandatoryDishes(e.target.value)}
                  placeholder="Ej: Asado el domingo"
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                </input>
              </div>
            </div>
          </div>

          {/* Panel de selección de comidas por día */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                2. Comidas a Planificar
              </label>

              {/* Atajos */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSelectAllMealsAllDays}
                  className="px-2 py-1 rounded-lg bg-patagonia-50 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 font-bold text-[10px] hover:bg-patagonia-100"
                >
                  Todas las comidas
                </button>
                <button
                  type="button"
                  onClick={handleSelectLunchAndDinnerOnly}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px]"
                >
                  Almuerzo/Cena
                </button>
                <button
                  type="button"
                  onClick={handleClearAllMealSelections}
                  className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-500 text-[10px]"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Grilla de días */}
            <div className="space-y-2">
              {DAYS_OF_WEEK.map((dia) => {
                const selected = daySelections[dia] || [];

                return (
                  <div
                    key={dia}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {dia}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {selected.length === 0
                          ? 'Sin comidas'
                          : `${selected.length} ${selected.length === 1 ? 'comida' : 'comidas'}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {MEAL_TYPES.map((m) => {
                        const isChecked = selected.includes(m.id);

                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleDayMeal(dia, m.id)}
                            className={`py-1.5 px-1 rounded-xl text-[11px] font-medium border flex flex-col items-center justify-center transition-all ${
                              isChecked
                                ? 'bg-patagonia-600 text-white border-patagonia-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <span className="text-xs leading-none mb-0.5">{m.icon}</span>
                            <span className="text-[10px] truncate">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botón principal de generar */}
          <button
            onClick={handleGenerate}
            disabled={isGeneratingAi}
            className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-chef-600 via-chef-500 to-amber-500 hover:from-chef-700 hover:to-amber-600 text-white font-extrabold text-sm shadow-xl shadow-chef-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isGeneratingAi ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Planificando menú inteligente...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 fill-white" />
                <span>Generar Menú Semanal (consume 3 consultas)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
