import React, { useState, useEffect } from 'react';
import { Users, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';

interface InviteAcceptModalProps {
  token: string;
  onClose: () => void;
  onJoined: () => void;
}

export const InviteAcceptModal: React.FC<InviteAcceptModalProps> = ({
  token,
  onClose,
  onJoined,
}) => {
  const { previewInvite, joinByInvite, refreshLicense } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [preview, setPreview] = useState<{
    householdId?: string;
    householdName?: string;
    householdCity?: string;
    requiresApproval?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      setLoading(true);
      setError(null);
      const res = await previewInvite(token);
      if (!isMounted) return;
      setLoading(false);
      if (res.valid) {
        setPreview({
          householdId: res.householdId,
          householdName: res.householdName,
          householdCity: res.householdCity,
          requiresApproval: res.requiresApproval,
        });
      } else {
        setError(res.error || 'Invitación no válida o expirada.');
      }
    };

    fetchPreview();
    return () => {
      isMounted = false;
    };
  }, [token, previewInvite]);

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    const res = await joinByInvite(token);
    setJoining(false);

    if (res.success) {
      setSuccessMsg(
        res.pendingApproval
          ? 'Solicitud enviada al dueño del hogar.'
          : '¡Te uniste al hogar con éxito!'
      );
      await refreshLicense();
      setTimeout(() => {
        onJoined();
      }, 1200);
    } else {
      setError(res.error || 'No fue posible unirse al hogar.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-scale-up">
        <div className="flex justify-end">
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="w-14 h-14 rounded-2xl bg-patagonia-100 dark:bg-patagonia-950 text-patagonia-600 dark:text-patagonia-400 flex items-center justify-center mx-auto mb-3 shadow-md">
          <Users className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
          Invitación de Hogar
        </h3>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-patagonia-500 animate-spin" />
            <span className="text-xs text-slate-500">Verificando enlace...</span>
          </div>
        ) : error ? (
          <div className="py-4">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 text-left mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="py-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Te invitaron a sumarte como integrante al hogar:
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-4">
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                {preview?.householdName}
              </h4>
              {preview?.householdCity && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {preview?.householdCity}
                </p>
              )}
            </div>

            {successMsg ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-2/3 py-3 rounded-xl bg-patagonia-600 hover:bg-patagonia-500 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {joining && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{joining ? 'Uniéndote...' : 'Confirmar y Unirme'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
