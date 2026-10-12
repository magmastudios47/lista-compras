import React, { useState, useEffect } from 'react';
import { ShoppingCart, Sparkles, Users, ChefHat, Check, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import { supabase, isConfigured } from '../../lib/supabaseClient';
import { PlanDefinition } from '../../types';

interface PublicLandingViewProps {
  onLoginClick: () => void;
  onCodeClick: () => void;
  onSelectPlanToBuy: (planId: 'base' | 'premium') => void;
}

export const PublicLandingView: React.FC<PublicLandingViewProps> = ({
  onLoginClick,
  onCodeClick,
  onSelectPlanToBuy,
}) => {
  const [plans, setPlans] = useState<PlanDefinition[]>([
    {
      id: 'base',
      name: 'Plan Base Hogar',
      price_usd: 10,
      monthly_chef_queries: 40,
      max_members: 6,
      features: { weekly_menu: false, price_tracking: false },
      is_active: true,
    },
    {
      id: 'premium',
      name: 'Plan Premium Hogar',
      price_usd: 20,
      monthly_chef_queries: 150,
      max_members: 8,
      features: { weekly_menu: true, price_tracking: true },
      is_active: true,
    },
  ]);
  const [exchangeRate, setExchangeRate] = useState<number>(1350);

  // Leer planes y cotización directamente del servidor
  useEffect(() => {
    if (!isConfigured) return;

    const loadPricing = async () => {
      try {
        const { data: plansData } = await supabase
          .from('plans')
          .select('*')
          .in('id', ['base', 'premium'])
          .eq('is_active', true);

        if (plansData && plansData.length > 0) {
          setPlans(plansData as PlanDefinition[]);
        }

        const { data: rateData } = await supabase
          .from('exchange_rates')
          .select('rate')
          .eq('currency_from', 'USD')
          .eq('currency_to', 'ARS')
          .maybeSingle();

        if (rateData?.rate) {
          setExchangeRate(Number(rateData.rate));
        }
      } catch (e) {
        console.warn('Error leyendo precios del servidor, usando predeterminados:', e);
      }
    };

    loadPricing();
  }, []);

  const formatArs = (usd: number) => {
    const ars = Math.round(usd * exchangeRate);
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(ars);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-chef-500 selection:text-white">
      {/* Barra Superior */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-patagonia-600 to-chef-500 flex items-center justify-center shadow-lg shadow-patagonia-900/30">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-white tracking-tight">Lista Compars</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-patagonia-500/20 text-patagonia-300 border border-patagonia-500/30">
                Patagonia & Argentina
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onCodeClick}
              className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Tengo un código</span>
            </button>
            <button
              onClick={onLoginClick}
              className="bg-patagonia-600 hover:bg-patagonia-500 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl transition shadow-md shadow-patagonia-900/40"
            >
              Ingresar
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 pt-12 pb-16 sm:pt-20 sm:pb-24 max-w-4xl mx-auto text-center overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs sm:text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4 text-chef-400 animate-pulse" />
          <span>Chef IA con ingredientes y cortes argentinos</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight sm:leading-tight mb-6">
          Tus compras ordenadas, tu despensa al día y un{' '}
          <span className="bg-gradient-to-r from-chef-400 to-amber-400 bg-clip-text text-transparent">
            Chef IA en tu cocina
          </span>
        </h1>

        <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Comprá solo lo que necesitás, ahorrá en el súper y resolvé las comidas de toda la semana con inteligencia artificial real adaptada a la Patagonia.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#precios"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-chef-500 to-amber-500 text-slate-950 font-bold text-base hover:opacity-95 transition shadow-lg shadow-chef-500/20 flex items-center justify-center gap-2"
          >
            <span>Ver Planes y Precios</span>
            <ArrowRight className="w-5 h-5" />
          </a>
          <button
            onClick={onLoginClick}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-base transition border border-slate-700"
          >
            Ya tengo cuenta / Ingresar
          </button>
        </div>
      </section>

      {/* Características Destacadas */}
      <section className="px-4 py-12 bg-slate-950/60 border-y border-slate-800/80">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-patagonia-500/10 border border-patagonia-500/30 flex items-center justify-center text-patagonia-400 mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Hogar Conectado</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Toda la familia suma y tilda productos en tiempo real. Sincronización instantánea y funcionamiento sin conexión.
            </p>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-chef-500/10 border border-chef-500/30 flex items-center justify-center text-chef-400 mb-4">
              <ChefHat className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Chef IA Confiable</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Recetas reales basadas en lo que tenés en la despensa. Sin respuestas simuladas, sin ingredientes genéricos ni arroz inventado.
            </p>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Licencia de por Vida</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Pago único por hogar sin suscripciones mensuales abusivas. Incluye hasta 6 u 8 integrantes según el plan elegido.
            </p>
          </div>
        </div>
      </section>

      {/* Planes y Precios */}
      <section id="precios" className="px-4 py-16 sm:py-20 max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-3">Elegí el plan para tu hogar</h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Licencia única por hogar con acceso de por vida y garantía de funcionamiento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Plan Base */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-slate-600 transition shadow-xl">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-lg text-slate-200">Plan Base Hogar</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-700 text-slate-300">
                  Pago Único
                </span>
              </div>
              <div className="mb-6">
                <div className="text-3xl sm:text-4xl font-extrabold text-white">
                  {formatArs(plans.find((p) => p.id === 'base')?.price_usd || 10)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  US$ {plans.find((p) => p.id === 'base')?.price_usd || 10} al cambio oficial (~${exchangeRate}/USD)
                </div>
              </div>

              <ul className="space-y-3 mb-8 text-sm text-slate-300">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Hasta 6 integrantes</strong> en el mismo hogar</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Lista de compras colaborativa en tiempo real</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Despensa inteligente y alertas de stock</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Chef IA para cocinar y aprovechar sobrantes (40 consultas/mes)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Acceso de por vida sin cuotas mensuales</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onSelectPlanToBuy('base')}
              className="w-full py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm transition text-center"
            >
              Comprar Plan Base
            </button>
          </div>

          {/* Plan Premium */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-chef-500 rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative shadow-2xl shadow-chef-950/50">
            <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-chef-500 to-amber-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow-md uppercase tracking-wide">
              Más Popular
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-lg text-white">Plan Premium Hogar</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-chef-500/20 text-chef-300 border border-chef-500/30">
                  Pago Único
                </span>
              </div>
              <div className="mb-6">
                <div className="text-3xl sm:text-4xl font-extrabold text-white">
                  {formatArs(plans.find((p) => p.id === 'premium')?.price_usd || 20)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  US$ {plans.find((p) => p.id === 'premium')?.price_usd || 20} al cambio oficial (~${exchangeRate}/USD)
                </div>
              </div>

              <ul className="space-y-3 mb-8 text-sm text-slate-200">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Hasta 8 integrantes</strong> en el hogar</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Todo lo incluido en el Plan Base</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Menú Semanal Inteligente (7 días completos)</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Almuerzos y cenas variadas sin repetición</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Comparador de precios de góndola argentina (SEPA)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Cuota ampliada: 150 consultas IA por mes</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onSelectPlanToBuy('premium')}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-chef-500 to-amber-500 hover:opacity-95 text-slate-950 font-black text-sm transition shadow-lg shadow-chef-500/20 text-center"
            >
              Comprar Plan Premium
            </button>
          </div>
        </div>
      </section>

      {/* Pie de página */}
      <footer className="mt-auto border-t border-slate-800/80 py-8 px-4 text-center text-xs text-slate-400">
        <p className="mb-2">Lista Compars — Organizador de compras, despensa y cocina para la Patagonia.</p>
        <p>Pagos procesados de forma segura con Mercado Pago. Licencias y cuotas protegidas en servidor.</p>
      </footer>
    </div>
  );
};
