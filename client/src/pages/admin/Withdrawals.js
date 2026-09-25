import React, { useCallback, useEffect, useState } from 'react';
import { Check, LockKeyhole, RefreshCw, Wallet, X } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const pendingStatuses = new Set(['pending', 'awaiting_activation_fee', 'activation_fee_paid', 'activation_fee_approved', 'awaiting_interest_tax', 'interest_tax_paid', 'withdrawal_processing', 'awaiting_network_fee', 'network_fee_paid']);
const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/admin/withdrawals', { params: { status: filter } });
      setWithdrawals(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load withdrawals.');
    } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const decide = async (withdrawal, status) => {
    const id = withdrawal.id || withdrawal._id;
    setBusyId(id);
    try {
      await axios.patch(`/api/admin/withdrawals/${id}`, { status, adminNotes: notes[id] || '' });
      toast.success(status === 'completed' ? 'Withdrawal approved.' : 'Withdrawal rejected and funds restored.');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update withdrawal.');
    } finally { setBusyId(''); }
  };

  const pendingCount = withdrawals.filter((item) => pendingStatuses.has(item.status)).length;
  return (
    <main className="min-h-screen bg-gray-950 p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col gap-4 border-b border-gray-800 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-gold">Operations</p><h1 className="mt-2 text-3xl font-bold">Withdrawals</h1><p className="mt-2 text-gray-400">Review reserved funds and make one clear decision per request.</p></div><button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gold hover:text-white"><RefreshCw size={16} /> Refresh</button></header>
        <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><p className="text-sm text-gray-400">Needs review</p><p className="mt-2 text-3xl font-bold">{pendingCount}</p><p className="mt-1 text-xs text-gray-500">Requests awaiting one decision</p></div><div className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><p className="text-sm text-gray-400">Visible amount</p><p className="mt-2 text-3xl font-bold">{money(withdrawals.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</p><p className="mt-1 text-xs text-gray-500">Across this view</p></div><div className="rounded-2xl border border-emerald-900 bg-emerald-950/30 p-5"><p className="text-sm text-emerald-300">Accounting rule</p><p className="mt-2 text-lg font-bold text-white">Funds reserved at request</p><p className="mt-1 text-xs text-emerald-200/70">Approve to complete. Reject to restore.</p></div></div>
        <div className="flex gap-2 overflow-x-auto border-b border-gray-800 pb-3">{[['pending', 'Needs review'], ['completed', 'Completed'], ['rejected', 'Rejected']].map(([value, text]) => <button key={value} onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${filter === value ? 'bg-gold text-black' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>{text}</button>)}</div>
        {loading ? <div className="flex min-h-48 items-center justify-center text-gray-400">Loading queue...</div> : withdrawals.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-700 p-12 text-center text-gray-500">No {filter} withdrawals.</div> : <div className="space-y-4">{withdrawals.map((withdrawal) => { const id = withdrawal.id || withdrawal._id; const source = withdrawal.balanceSource || (withdrawal.lockedBalanceSource ? 'locked' : 'available'); const isPending = pendingStatuses.has(withdrawal.status); return <article key={id} className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold">{money(withdrawal.amount)}</h2><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${source === 'locked' ? 'bg-orange-950 text-orange-300' : 'bg-green-950 text-green-300'}`}>{source === 'locked' ? <LockKeyhole size={13} /> : <Wallet size={13} />} {source === 'locked' ? 'Locked funds' : 'Available funds'}</span><span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300">{label(withdrawal.status)}</span></div><div className="mt-4 grid gap-3 text-sm text-gray-400 sm:grid-cols-2"><p><span className="text-gray-500">User</span><br /><span className="text-gray-200">{withdrawal.userFullName || withdrawal.userEmail || withdrawal.userId}</span></p><p><span className="text-gray-500">Destination</span><br /><span className="text-gray-200">{withdrawal.network || 'Not supplied'} · {withdrawal.currency || 'USD'}</span></p><p><span className="text-gray-500">Requested</span><br /><span className="text-gray-200">{withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleString() : '-'}</span></p><p><span className="text-gray-500">Wallet</span><br /><span className="break-all font-mono text-xs text-gray-300">{withdrawal.walletAddress || 'Not supplied'}</span></p></div></div>{isPending && <div className="w-full shrink-0 lg:max-w-xs"><p className="mb-2 text-xs text-gray-500">Funds are already reserved from the {source} bucket.</p><textarea value={notes[id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [id]: event.target.value }))} placeholder="Optional note for the user" rows={2} className="w-full rounded-lg border border-gray-700 bg-gray-950 p-3 text-sm text-white outline-none focus:border-gold" /><div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busyId === id} onClick={() => decide(withdrawal, 'rejected')} className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-800 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-950 disabled:opacity-50"><X size={16} /> Reject & restore</button><button disabled={busyId === id} onClick={() => decide(withdrawal, 'completed')} className="inline-flex items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"><Check size={16} /> Approve</button></div></div>}</div></article>; })}</div>}
      </div>
    </main>
  );
};
export default AdminWithdrawals;
