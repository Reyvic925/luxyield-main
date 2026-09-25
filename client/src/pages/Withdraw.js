import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Clock3, LockKeyhole, Wallet, XCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useUserDataRefresh } from '../contexts/UserDataRefreshContext';
import axios from '../utils/axios';
import { getUserWithdrawals, createWithdrawal } from '../services/userWithdrawalAPI';

const networks = [
  { value: 'USDT:TRC20', label: 'USDT · TRC20', currency: 'USDT', network: 'TRC20' },
  { value: 'USDT:BEP20', label: 'USDT · BEP20', currency: 'USDT', network: 'BEP20' },
  { value: 'USDT:ERC20', label: 'USDT · ERC20', currency: 'USDT', network: 'ERC20' },
  { value: 'BTC:BTC', label: 'Bitcoin · BTC', currency: 'BTC', network: 'BTC' },
  { value: 'ETH:ETH', label: 'Ethereum · ETH', currency: 'ETH', network: 'ETH' },
];
const formatMoney = (value) => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Withdraw = ({ adminView = false, adminUserId = null, adminPortfolioData = null }) => {
  const { kycStatus, kycLoading } = useUser();
  const { refreshUserData } = useUserDataRefresh();
  const [balances, setBalances] = useState({ available: 0, locked: 0 });
  const [withdrawals, setWithdrawals] = useState([]);
  const [source, setSource] = useState('available');
  const [amount, setAmount] = useState('');
  const [networkValue, setNetworkValue] = useState('USDT:TRC20');
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
  const canSubmit = amountNumber > 0 && amountNumber <= sourceBalance && address.trim().length > 10 && /^[0-9]{6}$/.test(pin);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || adminView) return;
    setError(''); setNotice(''); setSubmitting(true);
    try {
      await createWithdrawal({ amount: amountNumber, balanceSource: source, currency: selectedNetwork.currency, network: selectedNetwork.network, address: address.trim(), pin });
      setAmount(''); setAddress(''); setPin('');
      setNotice('Withdrawal submitted. Your funds are reserved while the team reviews the request.');
      await Promise.all([load(), refreshUserData()]);
    } catch (submitError) {
      setError(submitError.response?.data?.msg || submitError.response?.data?.message || 'Withdrawal could not be submitted.');
    } finally { setSubmitting(false); }
  };

  if (loading || kycLoading) return <div className="flex min-h-[24rem] items-center justify-center text-gray-400">Loading withdrawal center...</div>;
  if (!adminView && kycStatus !== 'verified') return <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-yellow-700 bg-yellow-950/30 p-8 text-center"><h2 className="text-2xl font-bold text-yellow-300">Verification required</h2><p className="mt-3 text-gray-300">Complete KYC before requesting a withdrawal.</p><a href="/dashboard/kyc" className="mt-6 inline-flex rounded-lg bg-gold px-5 py-3 font-bold text-black">Go to verification</a></div>;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6">
      <header className="flex flex-col gap-3 border-b border-gray-800 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-gold">Money movement</p><h1 className="mt-2 text-3xl font-bold text-white">Withdraw funds</h1><p className="mt-2 max-w-2xl text-gray-400">Choose a balance, enter your destination, and submit one review-ready request.</p></div>{adminView && <span className="rounded-full border border-blue-700 bg-blue-950/40 px-3 py-2 text-sm text-blue-200">Admin view</span>}</header>
      <section className="grid gap-4 sm:grid-cols-2">{[['available', 'Available balance', Wallet, 'Ready to withdraw'], ['locked', 'Locked balance', LockKeyhole, 'Investment-linked funds']].map(([key, label, Icon, hint]) => <button type="button" key={key} onClick={() => setSource(key)} className={`rounded-2xl border p-5 text-left transition ${source === key ? 'border-gold bg-gold/10' : 'border-gray-800 bg-gray-900 hover:border-gray-600'}`}><div className="flex items-center justify-between"><span className="text-sm text-gray-400">{label}</span><Icon className={source === key ? 'text-gold' : 'text-gray-500'} size={20} /></div><p className="mt-3 text-3xl font-bold text-white">{formatMoney(balances[key])}</p><p className="mt-1 text-sm text-gray-500">{hint}</p></button>)}</section>
      {!adminView && <form onSubmit={submit} className="grid gap-6 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-7 lg:grid-cols-[1fr_0.8fr]"><div className="space-y-5"><div><label className="mb-2 block text-sm font-semibold text-gray-300">Amount in USD</label><div className="relative"><span className="absolute left-4 top-3 text-gray-500">$</span><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" max={sourceBalance} step="0.01" placeholder="0.00" className="w-full rounded-xl border border-gray-700 bg-gray-950 py-3 pl-9 pr-4 text-white outline-none focus:border-gold" required /></div><div className="mt-2 flex justify-between text-xs text-gray-500"><span>Using {source} balance</span><button type="button" className="text-gold" onClick={() => setAmount(String(sourceBalance.toFixed(2)))}>Use maximum</button></div></div><div><label className="mb-2 block text-sm font-semibold text-gray-300">Network</label><select value={networkValue} onChange={(event) => setNetworkValue(event.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-white outline-none focus:border-gold">{networks.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label className="mb-2 block text-sm font-semibold text-gray-300">Wallet address</label><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Paste the destination address" className="w-full rounded-xl border border-gray-700 bg-gray-950 p-3 font-mono text-sm text-white outline-none focus:border-gold" required /></div></div><div className="flex flex-col justify-between gap-5"><div className="rounded-xl border border-gray-800 bg-gray-950 p-5"><div className="flex items-center gap-2 text-gray-300"><ArrowDownToLine size={18} className="text-gold" /> Review before submitting</div><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-gray-500">Source</dt><dd className="capitalize text-white">{source} balance</dd></div><div className="flex justify-between"><dt className="text-gray-500">Requested</dt><dd className="text-white">{formatMoney(amountNumber)}</dd></div><div className="flex justify-between"><dt className="text-gray-500">Processing fee</dt><dd className="text-green-300">None at request</dd></div></dl></div><div><label className="mb-2 block text-sm font-semibold text-gray-300">6-digit withdrawal PIN</label><input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" type="password" placeholder="Enter PIN" className="w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-white outline-none focus:border-gold" required /><button disabled={submitting || !canSubmit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400">{submitting ? 'Submitting...' : 'Submit withdrawal'} <ArrowDownToLine size={18} /></button></div></div></form>}
      {error && <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200">{error}</div>}{notice && <div className="rounded-xl border border-green-800 bg-green-950/40 p-4 text-green-200">{notice}</div>}
      <section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-white">Recent withdrawals</h2><span className="text-sm text-gray-500">{withdrawals.length} request{withdrawals.length === 1 ? '' : 's'}</span></div><div className="space-y-3">{withdrawals.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-700 p-8 text-center text-gray-500">Your withdrawal history will appear here.</div> : withdrawals.map((item) => <div key={item._id || item.id} className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-3"><p className="text-xl font-bold text-white">{formatMoney(item.amount)}</p><span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs capitalize text-gray-300">{item.balanceSource || (item.lockedBalanceSource ? 'locked' : 'available')} balance</span></div><p className="mt-1 text-sm text-gray-500">{item.network || 'Network pending'} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</p></div><div className="flex items-center gap-2 text-sm font-semibold capitalize"><span className={item.status === 'completed' ? 'text-green-300' : item.status === 'rejected' || item.status === 'failed' ? 'text-red-300' : 'text-yellow-300'}>{item.status === 'completed' ? <CheckCircle2 size={18} /> : item.status === 'rejected' || item.status === 'failed' ? <XCircle size={18} /> : <Clock3 size={18} />}</span>{(item.status || 'pending').replace(/_/g, ' ')}</div></div>)}</div></section>
    </main>
  );
};
export default Withdraw;
