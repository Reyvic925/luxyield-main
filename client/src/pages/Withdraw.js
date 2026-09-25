import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Clock3, LockKeyhole, RefreshCw, ShieldCheck, Wallet, XCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useUserDataRefresh } from '../contexts/UserDataRefreshContext';
import axios from '../utils/axios';
import { getUserWithdrawals, createWithdrawal } from '../services/userWithdrawalAPI';

const networks = [
  { value: 'USDT:TRC20', label: 'USDT on TRC20', currency: 'USDT', network: 'TRC20' },
  { value: 'USDT:BEP20', label: 'USDT on BEP20', currency: 'USDT', network: 'BEP20' },
  { value: 'USDT:ERC20', label: 'USDT on ERC20', currency: 'USDT', network: 'ERC20' },
  { value: 'BTC:BTC', label: 'Bitcoin on BTC', currency: 'BTC', network: 'BTC' },
  { value: 'ETH:ETH', label: 'Ethereum on ETH', currency: 'ETH', network: 'ETH' },
];

const formatMoney = (value) => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusLabel = (value) => String(value || 'pending').replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const isFailed = (status) => ['rejected', 'failed', 'activation_fee_rejected', 'interest_tax_rejected', 'network_fee_rejected'].includes(status);
const isComplete = (status) => ['completed', 'withdrawal_successful'].includes(status);

const Withdraw = ({ adminView = false, adminUserId = null, adminPortfolioData = null }) => {
  const { kycStatus, kycLoading } = useUser();
  const { refreshUserData } = useUserDataRefresh();
  const [balances, setBalances] = useState({ available: 0, locked: 0 });
  const [withdrawals, setWithdrawals] = useState([]);
  const [source, setSource] = useState('available');
  const [amount, setAmount] = useState('');
  const [networkValue, setNetworkValue] = useState(networks[0].value);
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const balanceRequest = adminView && adminUserId ? axios.get(`/api/admin/users/${adminUserId}/portfolio`) : axios.get('/api/portfolio');
      const historyRequest = adminView && adminUserId ? axios.get(`/api/admin/withdrawals?userId=${adminUserId}`) : getUserWithdrawals();
      const [balanceResponse, historyResponse] = await Promise.all([balanceRequest, historyRequest]);
      const userInfo = balanceResponse.data?.userInfo || {};
      setBalances({ available: Number(userInfo.availableBalance || 0), locked: Number(userInfo.lockedBalance || 0) });
      setWithdrawals(adminView ? (historyResponse.data || []) : historyResponse);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Unable to load withdrawal details.');
    } finally {
      setLoading(false);
    }
  }, [adminUserId, adminView]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (adminPortfolioData?.userInfo) setBalances({ available: Number(adminPortfolioData.userInfo.availableBalance || 0), locked: Number(adminPortfolioData.userInfo.lockedBalance || 0) });
  }, [adminPortfolioData]);

  const selectedNetwork = networks.find((item) => item.value === networkValue) || networks[0];
  const sourceBalance = balances[source];
  const amountNumber = Number(amount);
  const addressIsValid = address.trim().length > 10;
  const pinIsValid = /^[0-9]{6}$/.test(pin);
  const canSubmit = amountNumber > 0 && amountNumber <= sourceBalance && addressIsValid && pinIsValid;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || adminView) return;
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await createWithdrawal({ amount: amountNumber, balanceSource: source, currency: selectedNetwork.currency, network: selectedNetwork.network, address: address.trim(), pin });
      setAmount('');
      setAddress('');
      setPin('');
      setNotice('Request submitted. The amount is reserved while the team reviews your destination.');
      await Promise.all([load(), refreshUserData()]);
    } catch (submitError) {
      setError(submitError.response?.data?.msg || submitError.response?.data?.message || 'Withdrawal could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || kycLoading) return <div className="flex min-h-[24rem] items-center justify-center text-gray-400">Loading withdrawal center...</div>;
  if (!adminView && kycStatus !== 'verified') return <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-yellow-700 bg-yellow-950/30 p-8 text-center"><ShieldCheck className="mx-auto text-yellow-300" size={34} /><h2 className="mt-4 text-2xl font-bold text-yellow-300">Verification required</h2><p className="mt-3 text-gray-300">Complete identity verification before requesting a withdrawal.</p><a href="/dashboard/kyc" className="mt-6 inline-flex rounded-lg bg-gold px-5 py-3 font-bold text-black">Open verification</a></div>;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 text-white sm:p-6">
      <header className="flex flex-col gap-4 border-b border-gray-800 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-gold">Money movement</p><h1 className="mt-2 text-3xl font-bold">Withdrawal center</h1><p className="mt-2 max-w-2xl text-gray-400">Choose where the funds come from, add your wallet, then submit one review-ready request.</p></div><button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gold hover:text-white"><RefreshCw size={16} /> Refresh balances</button></header>
      <section className="grid gap-4 sm:grid-cols-2">{[['available', 'Available funds', Wallet, 'Ready to withdraw now'], ['locked', 'Locked funds', LockKeyhole, 'Released investment proceeds']].map(([key, label, Icon, hint]) => <button type="button" key={key} onClick={() => setSource(key)} className={`rounded-2xl border p-5 text-left transition ${source === key ? 'border-gold bg-gold/10' : 'border-gray-800 bg-gray-900 hover:border-gray-600'}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-300">{label}</span><Icon className={source === key ? 'text-gold' : 'text-gray-500'} size={21} /></div><p className="mt-3 text-3xl font-bold">{formatMoney(balances[key])}</p><p className="mt-1 text-sm text-gray-500">{hint}</p></button>)}</section>
      {!adminView && <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900"><div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]"><div className="space-y-6 p-5 sm:p-7"><div><div className="mb-2 flex items-center justify-between"><label htmlFor="withdrawal-amount" className="text-sm font-semibold text-gray-300">1. Amount</label><span className="text-xs text-gray-500">Max {formatMoney(sourceBalance)}</span></div><div className="relative"><span className="absolute left-4 top-3 text-gray-500">$</span><input id="withdrawal-amount" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" max={sourceBalance} step="0.01" placeholder="0.00" className="w-full rounded-xl border border-gray-700 bg-gray-950 py-3 pl-9 pr-4 text-lg text-white outline-none focus:border-gold" required /></div><button type="button" className="mt-2 text-xs font-semibold text-gold" onClick={() => setAmount(sourceBalance.toFixed(2))}>Use maximum</button></div><div><label htmlFor="withdrawal-network" className="mb-2 block text-sm font-semibold text-gray-300">2. Destination network</label><select id="withdrawal-network" value={networkValue} onChange={(event) => setNetworkValue(event.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-white outline-none focus:border-gold">{networks.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label htmlFor="withdrawal-address" className="mb-2 block text-sm font-semibold text-gray-300">3. Wallet address</label><input id="withdrawal-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Paste the destination wallet address" className="w-full rounded-xl border border-gray-700 bg-gray-950 p-3 font-mono text-sm text-white outline-none focus:border-gold" required /><p className={`mt-2 text-xs ${address ? (addressIsValid ? 'text-emerald-400' : 'text-red-300') : 'text-gray-500'}`}>{address ? (addressIsValid ? 'Address format looks ready to review.' : 'Enter the complete wallet address.') : 'Double-check the network before sending.'}</p></div><div><label htmlFor="withdrawal-pin" className="mb-2 block text-sm font-semibold text-gray-300">4. Withdrawal PIN</label><input id="withdrawal-pin" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" type="password" placeholder="6-digit PIN" className="w-full rounded-xl border border-gray-700 bg-gray-950 p-3 tracking-[0.35em] text-white outline-none focus:border-gold" required /><p className="mt-2 text-xs text-gray-500">Your PIN confirms this request. It is never shown to the review team.</p></div></div><aside className="border-t border-gray-800 bg-gray-950/70 p-5 sm:p-7 lg:border-l lg:border-t-0"><div className="flex items-center gap-2 text-gray-200"><ArrowDownToLine className="text-gold" size={19} /> Review request</div><dl className="mt-6 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-gray-500">Source</dt><dd className="font-semibold capitalize">{source} funds</dd></div><div className="flex justify-between gap-4"><dt className="text-gray-500">Amount</dt><dd className="font-semibold">{formatMoney(amountNumber)}</dd></div><div className="flex justify-between gap-4"><dt className="text-gray-500">Network</dt><dd className="text-right font-semibold">{selectedNetwork.label}</dd></div></dl><div className="mt-7 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-sm text-emerald-200"><p className="font-semibold">What happens next</p><p className="mt-2 leading-6 text-emerald-100/75">The requested amount is reserved immediately. Admin approval completes the request; rejection returns it to the same balance.</p></div><button type="submit" disabled={!canSubmit || submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 font-bold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40">{submitting ? 'Submitting...' : 'Submit withdrawal'} <ArrowDownToLine size={17} /></button></aside></div></form>}
      {(error || notice) && <div className={`rounded-xl border p-4 ${error ? 'border-red-800 bg-red-950/40 text-red-200' : 'border-emerald-800 bg-emerald-950/40 text-emerald-200'}`}>{error || notice}</div>}
      <section><div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Activity</p><h2 className="mt-1 text-2xl font-bold">Withdrawal history</h2></div><span className="text-sm text-gray-500">{withdrawals.length} request{withdrawals.length === 1 ? '' : 's'}</span></div><div className="space-y-3">{withdrawals.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-700 p-8 text-center text-gray-500">No withdrawal requests yet.</div> : withdrawals.map((item) => { const itemStatus = item.status || 'pending'; const itemSource = item.balanceSource || (item.lockedBalanceSource ? 'locked' : 'available'); return <article key={item._id || item.id} className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><p className="text-xl font-bold">{formatMoney(item.amount)}</p><span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs capitalize text-gray-300">{itemSource} funds</span></div><p className="mt-2 text-sm text-gray-500">{item.network || 'Network pending'} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Date pending'}</p></div><div className={`flex items-center gap-2 text-sm font-semibold ${isComplete(itemStatus) ? 'text-emerald-300' : isFailed(itemStatus) ? 'text-red-300' : 'text-yellow-300'}`}>{isComplete(itemStatus) ? <CheckCircle2 size={18} /> : isFailed(itemStatus) ? <XCircle size={18} /> : <Clock3 size={18} />}{statusLabel(itemStatus)}</div></article>; })}</div></section>
    </main>
  );
};

export default Withdraw;
