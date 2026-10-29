import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Boxes, X, Loader2, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';

const formatPHP = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(n) || 0);

const PullOutModal = ({ isOpen, onClose, item, onSuccess }) => {
    if (!isOpen || !item) return null;

    const branchName = item.branchName || 'Branch';
    const branchId = item.branchId;
    const maxQty = item.branchStock != null ? item.branchStock : (item.quantity != null ? item.quantity : 1);
    const initialQty = Math.min(1, maxQty);

    const [quantity, setQuantity] = useState(initialQty);
    const [reason, setReason] = useState('Overstocked / Low Sales at Branch');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        setQuantity(Math.min(1, maxQty));
        setError('');
        setNotes('');
        setIsSuccess(false);
        setSuccessMsg('');
    }, [item, maxQty]);

    const handleQtyChange = (val) => {
        const num = parseInt(val, 10);
        if (isNaN(num)) {
            setQuantity('');
            return;
        }
        if (num < 1) setQuantity(1);
        else if (num > maxQty) setQuantity(maxQty);
        else setQuantity(num);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const numQty = parseInt(quantity, 10);
        if (isNaN(numQty) || numQty <= 0) {
            setError('Please enter a valid quantity of at least 1.');
            return;
        }
        if (numQty > maxQty) {
            setError(`Cannot pull out more than ${maxQty} units currently at ${branchName}.`);
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const payload = {
                branchId: branchId,
                variantId: item.variantId || item.id,
                quantity: numQty,
                reason: reason.trim(),
                notes: notes.trim()
            };

            const res = await axios.post('/api/allocations/pull-out', payload);
            setIsSuccess(true);
            setSuccessMsg(res.data?.message || `Successfully pulled out ${numQty} unit(s) of ${item.brandName || item.brand || ''} ${item.modelName || item.name || ''} from ${branchName} back to Master Admin.`);

            if (onSuccess) {
                try {
                    await onSuccess(res.data);
                } catch (cbErr) {
                    console.error('onSuccess callback error:', cbErr);
                }
            }

            // Auto-refresh the page automatically so all tables, holding pool, and branch counts auto-load
            setTimeout(() => {
                window.location.reload();
            }, 650);
        } catch (err) {
            console.error('Failed to pull out stock:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to pull out stock to Master Admin.';
            setError(msg);
            setIsSubmitting(false);
        }
    };

    const parsedQty = parseInt(quantity, 10) || 0;
    const branchRemainingAfter = Math.max(0, maxQty - parsedQty);
    const adminHoldingCurrent = item.adminStock != null ? item.adminStock : (item.mainStock != null ? item.mainStock : 0);
    const adminHoldingAfter = adminHoldingCurrent + parsedQty;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden">
                {/* Header */}
                <div className="p-6 bg-stone-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                            <ArrowLeft size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black tracking-tight">Pull Out Stock to Master Admin</h3>
                            <p className="text-xs text-stone-400">Return branch inventory back to Master Admin Holding</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {isSuccess ? (
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                            <CheckCircle2 size={36} />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-stone-900">Pull Out Completed!</h4>
                            <p className="text-xs text-stone-600 mt-2 font-medium max-w-sm mx-auto leading-relaxed">
                                {successMsg}
                            </p>
                        </div>
                        <div className="pt-2">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold shadow-xs">
                                <Loader2 size={13} className="animate-spin text-amber-600" />
                                <span>Auto-refreshing inventory & auto-loading...</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Source & Destination summary */}
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
                            <div className="flex items-center gap-2">
                                <Building2 size={16} className="text-amber-600" />
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-stone-400 block">From Branch</span>
                                    <span className="font-black text-stone-900">{branchName}</span>
                                </div>
                            </div>
                            <div className="text-stone-300 font-black">➔</div>
                            <div className="flex items-center gap-2 text-right">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-stone-400 block">To Destination</span>
                                    <span className="font-black text-stone-900">Master Admin (Holding Pool)</span>
                                </div>
                                <Boxes size={16} className="text-emerald-600" />
                            </div>
                        </div>

                        {/* Product Card */}
                        <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs space-y-1">
                            <div className="font-black text-stone-900 text-sm">
                                {item.brandName || item.brand} {item.modelName || item.name}
                            </div>
                            <div className="text-stone-500 font-medium">
                                {item.color && item.color !== '-' ? item.color : ''} {item.thicknessMm ? `• ${item.thicknessMm}mm` : ''} {item.shape ? `• ${item.shape}` : ''}
                            </div>
                            <div className="font-mono text-stone-400 text-[11px] pt-1 border-t border-stone-200/60 mt-1 flex justify-between">
                                <span>SKU: {item.sku}</span>
                                <span className="font-sans font-bold text-amber-700">Available at Branch: {maxQty} units</span>
                            </div>
                        </div>

                        {/* Quantity to Pull Out */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-black uppercase tracking-wider text-stone-700">
                                    Quantity to Pull Out
                                </label>
                                <span className="text-xs text-stone-400 font-bold">Max: {maxQty}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max={maxQty}
                                    value={quantity}
                                    onChange={(e) => handleQtyChange(e.target.value)}
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-base font-black text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                                />
                                {/* Quick Select Buttons */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {[1, 2, 5].filter(q => q <= maxQty).map(q => (
                                        <button
                                            key={q}
                                            type="button"
                                            onClick={() => setQuantity(q)}
                                            className={`px-2.5 py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                                                parsedQty === q
                                                    ? 'bg-amber-600 border-amber-600 text-white'
                                                    : 'border-stone-200 hover:bg-stone-100 text-stone-700'
                                            }`}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(maxQty)}
                                        className={`px-3 py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                                            parsedQty === maxQty
                                                ? 'bg-amber-600 border-amber-600 text-white'
                                                : 'border-stone-200 hover:bg-stone-100 text-stone-700'
                                        }`}
                                    >
                                        All ({maxQty})
                                    </button>
                                </div>
                            </div>

                            {/* Impact preview */}
                            <div className="grid grid-cols-2 gap-2 mt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px]">
                                <div>
                                    <span className="text-amber-800 font-medium block">Branch stock after:</span>
                                    <strong className="font-black text-amber-950 font-mono text-xs">{branchRemainingAfter} units</strong>
                                </div>
                                <div className="text-right">
                                    <span className="text-amber-800 font-medium block">Master Holding after:</span>
                                    <strong className="font-black text-amber-950 font-mono text-xs">{adminHoldingAfter} units</strong>
                                </div>
                            </div>
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5">
                                Reason for Pull Out
                            </label>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-stone-900 cursor-pointer"
                            >
                                <option value="Overstocked / Low Sales at Branch">Overstocked / Low Sales at Branch</option>
                                <option value="Recall to Master Admin / Reallocation">Recall to Master Admin / Reallocation</option>
                                <option value="Branch Request Return">Branch Request Return</option>
                                <option value="Damaged / Defective Stock Return">Damaged / Defective Stock Return</option>
                                <option value="Consignment / Partner End of Term">Consignment / Partner End of Term</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* Optional Notes */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5">
                                Notes / Remarks <span className="text-stone-400 font-normal lowercase">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g., Returning 2 units for tournament event booth"
                                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-900"
                            />
                        </div>

                        <div className="text-[10px] text-stone-400 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                            💡 <strong>Auto-Credit:</strong> Unpaid branch allocation dues for the pulled-out units will be credited/reduced automatically so the branch is not billed for returned items.
                        </div>

                        {/* Actions */}
                        <div className="pt-2 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || parsedQty <= 0 || parsedQty > maxQty}
                                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeft size={14} />}
                                <span>Confirm Pull Out</span>
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default PullOutModal;
