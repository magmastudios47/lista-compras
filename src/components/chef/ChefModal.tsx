import React, { useState } from 'react';
import {
  ChefCookResponse,
  ChefSuggestRecipe,
  DiscountComparisonResult,
  PantryItem,
  ShoppingItem,
} from '../../types';
import { useChefAi } from '../../hooks/useChefAi';
import { useHousehold } from '../../context/HouseholdContext';
import { calculateRecipeEstimatedCost } from '../../lib/priceMemory';
import {
  Sparkles,
  CookingPot,
  Lightbulb,
  Check,
  X,
  Users,
  AlertCircle,
  Plus,
  Clock,
  ArrowRight,
  ShieldAlert,
  Tag,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ChefModalProps {
  isOpen: boolean;
  onClose: () => void;
  pantryItems: PantryItem[];
  onAddIngredientsToShoppingList: (items: Array<{ name: string; quantity: number; unit: any; category: any }>) => Promise<any>;
}

export const ChefModal: React.FC<ChefModalProps> = ({
  isOpen,
  onClose,
  pantryItems,
  onAddIngredientsToShoppingList,
}) => {
  const { household } = useHousehold();
  const { loading, error, askToCook, askToSuggest, remainingQueries, isAiDemoMode } = useChefAi();

  const [activeTab, setActiveTab] = useState<'cocinar' | 'sugerir'>('cocinar');

  // Estado Modo Cocinar
  const [mealInput, setMealInput] = useState('');
  const [persons, setPersons] = useState(4);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [cookPreview, setCookPreview] = useState<{
    response: ChefCookResponse;
    comparisons: DiscountComparisonResult[];
  } | null>(null);
  const [showCookSteps, setShowCookSteps] = useState(false);

  // Estado Modo Sugerir
  const [suggestFreeText, setSuggestFreeText] = useState('');
  const [suggestRecipes, setSuggestRecipes] = useState<ChefSuggestRecipe[] | null>(null);
  const [selectedSuggestRecipe, setSelectedSuggestRecipe] = useState<ChefSuggestRecipe | null>(null);
  const [suggestComparisons, setSuggestComparisons] = useState<DiscountComparisonResult[] | null>(null);
  const [showSuggestSteps, setShowSuggestSteps] = useState(false);

  if (!isOpen) return null;

  const toggleRestriction = (tag: string) => {
    setRestrictions((prev) =>
      prev.includes(tag) ? prev.filter((r) => r !== tag) : [...prev, tag]
    );
  };

  // Manejo de consulta "Cocinar"
  const handleCookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealInput.trim()) return;
    try {
      const result = await askToCook(mealInput.trim(), persons, restrictions, pantryItems);
      setCookPreview(result);
    } catch {
      // Error manejado en hook
    }
  };

  // Manejo de consulta "Sugerir"
  const handleSuggestSubmit = async () => {
    try {
      const res = await askToSuggest(pantryItems, suggestFreeText.trim() || undefined);
      if (res?.recetas) {
        setSuggestRecipes(res.recetas);
      }
    } catch {
      // Error manejado en hook
    }
  };

  // Confirmar y agregar ingredientes de modo cocinar a la lista
  const handleConfirmCookIngredients = async () => {
    if (!cookPreview) return;
    const itemsToAdd = cookPreview.comparisons
      .filter((c) => c.seleccionadoParaAgregar && c.cantidad_faltante > 0)
      .map((c) => ({
        name: c.ingrediente.nombre,
        quantity: c.cantidad_faltante,
        unit: c.unidad_faltante,
        category: c.ingrediente.categoria,
      }));

    if (itemsToAdd.length > 0) {
      await onAddIngredientsToShoppingList(itemsToAdd);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
    setCookPreview(null);
    setMealInput('');
    onClose();
  };

  // Seleccionar una de las 3 recetas sugeridas para revisar faltantes
  const handleSelectSuggestRecipe = (receta: ChefSuggestRecipe) => {
    setSelectedSuggestRecipe(receta);
    // Calcular faltantes para esta receta elegida
    const comparisons: DiscountComparisonResult[] = receta.ingredientes.map((ing) => {
      const pMatch = pantryItems.find((p) => p.name.toLowerCase().includes(ing.nombre.toLowerCase()));
      const tiene = Boolean(pMatch);
      return {
        ingrediente: ing,
        despensa_item: pMatch || null,
        estado: tiene ? 'cubierto' : 'falta_total',
        seleccionadoParaAgregar: !tiene && !ing.opcional,
        cantidad_faltante: tiene ? 0 : ing.cantidad,
        unidad_faltante: ing.unidad,
        detalle: tiene ? `Tenés ${pMatch?.name} en despensa` : 'Falta en casa',
      };
    });
    setSuggestComparisons(comparisons);
  };

  // Confirmar receta sugerida
  const handleConfirmSuggestIngredients = async () => {
    if (!suggestComparisons) return;
    const itemsToAdd = suggestComparisons
      .filter((c) => c.seleccionadoParaAgregar && c.cantidad_faltante > 0)
      .map((c) => ({
        name: c.ingrediente.nombre,
        quantity: c.cantidad_faltante,
        unit: c.unidad_faltante,
        category: c.ingrediente.categoria,
      }));

    if (itemsToAdd.length > 0) {
      await onAddIngredientsToShoppingList(itemsToAdd);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
    setSelectedSuggestRecipe(null);
    setSuggestComparisons(null);
    setSuggestRecipes(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto animate-scale-up">
        {/* Cabecera del Chef */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-chef-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-chef-500/25">
              <Sparkles className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-1.5">
                <span>El Chef</span>
                {isAiDemoMode && (
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/40">
                    Modo Demo
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAiDemoMode ? 'Modo de prueba local (sin consumo de créditos)' : `${remainingQueries} consultas restantes este mes`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta de error visible si falla la IA */}
        {error && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        )}

        {/* Tabs: Cocinar / Sugerir */}
        {!cookPreview && !selectedSuggestRecipe && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mt-4">
            <button
              onClick={() => setActiveTab('cocinar')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'cocinar'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <CookingPot className="w-4 h-4 text-chef-500" />
              <span>Quiero cocinar...</span>
            </button>
            <button
              onClick={() => setActiveTab('sugerir')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'sugerir'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>¿Qué puedo hacer?</span>
            </button>
          </div>
        )}

        {/* Error banner si falló */}
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ---------------- MODO COCINAR FORMULARIO ---------------- */}
        {activeTab === 'cocinar' && !cookPreview && (
          <form onSubmit={handleCookSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ¿Qué tenés ganas de cocinar?
              </label>
              <textarea
                rows={2}
                value={mealInput}
                onChange={(e) => setMealInput(e.target.value)}
                placeholder="Ej: Milanesas con puré, tarta de zapallitos, asado, pastel de papa..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-chef-500 font-medium resize-none"
              />
            </div>

            {/* Selector de comensales */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" /> ¿Para cuántas personas?
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 4, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPersons(num)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      persons === num
                        ? 'bg-chef-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Restricciones alimentarias */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Restricciones o preferencias:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['Vegetariano', 'Celíaco / Sin TACC', 'Sin lactosa', 'Bajo en sodio'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleRestriction(tag)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                      restrictions.includes(tag)
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!mealInput.trim() || loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-chef-600 to-amber-500 hover:from-chef-700 hover:to-amber-600 text-white font-bold text-sm shadow-md shadow-chef-500/25 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span>Armando receta y descontando despensa...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white" />
                  <span>Calcular ingredientes faltantes</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ---------------- MODO COCINAR VISTA PREVIA INTERACTIVA ---------------- */}
        {activeTab === 'cocinar' && cookPreview && (
          <div className="mt-4 space-y-4">
            {cookPreview.response.receta && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-base text-amber-950 dark:text-amber-200">
                    {cookPreview.response.receta.nombre}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/80 text-amber-900 dark:text-amber-300 font-bold">
                    {cookPreview.response.receta.dificultad}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300 mt-1">
                  <span>{cookPreview.response.receta.porciones} porciones</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {cookPreview.response.receta.tiempo_minutos || 40} min
                  </span>
                </div>
                {/* Costo estimado por receta */}
                {(() => {
                  const est = calculateRecipeEstimatedCost(
                    cookPreview.response.ingredientes,
                    household?.id
                  );
                  return (
                    <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex flex-col gap-0.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-800 dark:text-amber-300 font-medium">Costo estimado:</span>
                        <span className="font-bold text-amber-950 dark:text-amber-100">
                          {est.formattedEstimate}
                        </span>
                      </div>
                      {est.coveredCount > 0 && est.attribution && (
                        <span className="text-[10px] text-amber-700/70 dark:text-amber-400/60 text-right">
                          {est.attribution}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Receta paso a paso (sección colapsable para ver de dónde sale cada ingrediente) */}
            {cookPreview.response.receta?.pasos && cookPreview.response.receta.pasos.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowCookSteps(!showCookSteps)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-chef-600 dark:text-chef-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Receta paso a paso ({cookPreview.response.receta.pasos.length} pasos)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                    <span>{showCookSteps ? 'Ocultar' : 'Ver preparación'}</span>
                    {showCookSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>
                {showCookSteps && (
                  <div className="p-3.5 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800/60 max-h-56 overflow-y-auto">
                    {cookPreview.response.receta.pasos.map((paso, idx) => (
                      <div key={idx} className="flex gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                        <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="leading-relaxed flex-1">{paso.replace(/^\d+[\.\)]\s*/, '')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Checklist interactivo de ingredientes con descuento determinista */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ingredientes (tildá los que querés comprar):
                </span>
                <span className="text-[11px] text-slate-400">
                  {cookPreview.comparisons.filter((c) => c.seleccionadoParaAgregar).length} de {cookPreview.comparisons.length} seleccionados
                </span>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {cookPreview.comparisons.map((item, idx) => {
                  const yaLoTenes = item.estado === 'cubierto' || item.estado === 'basico_presente';

                  return (
                    <div
                      key={idx}
                      onClick={() =>
                        setCookPreview((prev) =>
                          prev
                            ? {
                                ...prev,
                                comparisons: prev.comparisons.map((c, i) =>
                                  i === idx ? { ...c, seleccionadoParaAgregar: !c.seleccionadoParaAgregar } : c
                                ),
                              }
                            : null
                        )
                      }
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                        item.seleccionadoParaAgregar
                          ? 'border-chef-500/70 bg-chef-50/40 dark:bg-chef-950/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            item.seleccionadoParaAgregar
                              ? 'bg-chef-500 text-white font-bold'
                              : 'border border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {item.seleccionadoParaAgregar && <Check className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.ingrediente.nombre}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.cantidad_faltante > 0 ? (
                              <span className="font-semibold text-chef-600 dark:text-chef-400">
                                Falta: {item.cantidad_faltante} {item.unidad_faltante}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                Ya tenés en despensa
                              </span>
                            )}
                            {item.ingrediente.es_basico && ' • Condimento básico'}
                          </p>
                        </div>
                      </div>

                      {/* Badge estado despensa */}
                      {yaLoTenes ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex-shrink-0">
                          En casa
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex-shrink-0">
                          Comprar
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmCookIngredients}
                className="flex-1 py-3 px-4 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-xs shadow-md shadow-patagonia-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar a la Lista de Compras</span>
              </button>
              <button
                onClick={() => setCookPreview(null)}
                className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Modificar
              </button>
            </div>
          </div>
        )}

        {/* ---------------- MODO SUGERIR FORMULARIO & LISTA ---------------- */}
        {activeTab === 'sugerir' && !selectedSuggestRecipe && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ¿Algo extra que tengas en casa? (opcional)
              </label>
              <input
                type="text"
                value={suggestFreeText}
                onChange={(e) => setSuggestFreeText(e.target.value)}
                placeholder="Ej: un paquete de polenta, morrones, queso..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chef-500"
              />
            </div>

            <button
              onClick={handleSuggestSubmit}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-chef-500 hover:from-amber-600 hover:to-chef-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Buscando 3 recetas con lo que tenés...</span>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4 fill-white" />
                  <span>Sugerir 3 recetas con mi despensa</span>
                </>
              )}
            </button>

            {/* Lista de las 3 recetas sugeridas */}
            {suggestRecipes && (
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Elegí una receta para ver qué le falta:
                </span>
                {suggestRecipes.map((rec, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectSuggestRecipe(rec)}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-chef-500 dark:hover:border-chef-500 bg-white dark:bg-slate-900 cursor-pointer shadow-sm transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {rec.nombre}
                      </h4>
                      <ArrowRight className="w-4 h-4 text-chef-500" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {rec.por_que_conviene}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2 font-medium">
                      <span>{rec.porciones} porciones</span>
                      <span>•</span>
                      <span>{rec.dificultad}</span>
                      <span>•</span>
                      <span>{rec.ingredientes.length} ingredientes</span>
                    </div>

                    {/* Costo estimado en tarjeta sugerida */}
                    {(() => {
                      const est = calculateRecipeEstimatedCost(rec.ingredientes, household?.id);
                      return (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">Costo aproximado:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {est.formattedEstimate}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- DETALLE Y CONFIRMACIÓN DE RECETA SUGERIDA ---------------- */}
        {activeTab === 'sugerir' && selectedSuggestRecipe && suggestComparisons && (
          <div className="mt-4 space-y-4">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <h4 className="font-extrabold text-sm text-amber-950 dark:text-amber-200">
                {selectedSuggestRecipe.nombre}
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                {selectedSuggestRecipe.por_que_conviene}
              </p>
              {/* Costo estimado */}
              {(() => {
                const est = calculateRecipeEstimatedCost(
                  selectedSuggestRecipe.ingredientes,
                  household?.id
                );
                return (
                  <div className="mt-2 pt-1.5 border-t border-amber-200/60 dark:border-amber-900/40 flex flex-col gap-0.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-800 dark:text-amber-300 font-medium">Costo estimado:</span>
                      <span className="font-bold text-amber-950 dark:text-amber-100">
                        {est.formattedEstimate}
                      </span>
                    </div>
                    {est.coveredCount > 0 && est.attribution && (
                      <span className="text-[10px] text-amber-700/70 dark:text-amber-400/60 text-right">
                        {est.attribution}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Pasos colapsables de la receta sugerida */}
            {(() => {
              const pasos = selectedSuggestRecipe.pasos || selectedSuggestRecipe.receta?.pasos;
              if (!pasos || pasos.length === 0) return null;
              return (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setShowSuggestSteps(!showSuggestSteps)}
                    className="w-full p-2.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-chef-600 dark:text-chef-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Pasos de la receta ({pasos.length} pasos)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                      <span>{showSuggestSteps ? 'Ocultar' : 'Ver preparación'}</span>
                      {showSuggestSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                  {showSuggestSteps && (
                    <div className="p-3 pt-1 space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 max-h-48 overflow-y-auto">
                      {pasos.map((paso, idx) => (
                        <div key={idx} className="flex gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-[9px] flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="leading-relaxed flex-1">{paso.replace(/^\d+[\.\)]\s*/, '')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {suggestComparisons.map((c, i) => (
                <div
                  key={i}
                  onClick={() =>
                    setSuggestComparisons((prev) =>
                      prev
                        ? prev.map((item, idx) =>
                            idx === i ? { ...item, seleccionadoParaAgregar: !item.seleccionadoParaAgregar } : item
                          )
                        : null
                    )
                  }
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    c.seleccionadoParaAgregar
                      ? 'border-chef-500 bg-chef-50/40 dark:bg-chef-950/20'
                      : 'border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center ${
                        c.seleccionadoParaAgregar ? 'bg-chef-500 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {c.seleccionadoParaAgregar && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {c.ingrediente.nombre} ({c.cantidad_faltante} {c.unidad_faltante})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{c.detalle}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmSuggestIngredients}
                className="flex-1 py-3 px-3 rounded-xl bg-patagonia-600 hover:bg-patagonia-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
              >
                Agregar faltantes a la lista
              </button>
              <button
                onClick={() => {
                  setSelectedSuggestRecipe(null);
                  setSuggestComparisons(null);
                }}
                className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
