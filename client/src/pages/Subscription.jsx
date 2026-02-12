import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscriptionService } from '../services/api';
import { Crown, Check, Calendar, CreditCard, Zap, Star } from 'lucide-react';
import GenericSkeleton from '../components/skeletons/GenericSkeleton';

const plans = [
  { id: 'free', name: 'Free', price: 0, period: 'forever', features: ['1 Report analysis per month', 'Basic AI insights', 'View doctor listings', 'Email support'], color: 'slate', icon: Star },
  { id: 'basic', name: 'Basic', price: 0, period: 'month', features: ['5 Report analyses per month', 'Full AI analysis with deficiencies', 'Personalized diet plans', 'Supplement recommendations', 'Health trend tracking', 'Priority support'], color: 'cyan', icon: Zap, popular: true },
  { id: 'premium', name: 'Premium', price: 0, period: 'month', features: ['Unlimited report analyses', 'Advanced AI insights', 'Personalized diet & exercise plans', 'Supplement recommendations', 'Health trend analytics', 'Chat with AI about reports', 'Doctor recommendations', '24/7 Priority support'], color: 'violet', icon: Crown }
];

export default function Subscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly');

  useEffect(() => { fetchSubscription(); }, []);

  const fetchSubscription = async () => {
    try { const { data } = await subscriptionService.getSubscription(); setSubscription(data); } catch (error) { console.error('Failed to fetch subscription'); } finally { setLoading(false); }
  };

  const currentPlan = subscription?.plan || user?.subscription?.plan || 'free';

  if (loading) return <GenericSkeleton />;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-violet-500/20 text-violet-400 px-4 py-2 rounded-full text-sm font-semibold mb-4"><Crown className="w-4 h-4" />Subscription Plans</div>
        <h1 className="text-3xl font-bold text-white mb-2">Choose Your Plan</h1>
        <p className="text-slate-400 max-w-lg mx-auto">Unlock the full potential of AI-powered health insights with our premium plans</p>
      </div>

      {/* Current Plan Banner */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"><div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" /></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center"><Crown className="w-7 h-7" /></div>
            <div><p className="text-white/70 text-sm">Current Plan</p><h2 className="text-2xl font-bold capitalize">{currentPlan}</h2></div>
          </div>
          <div className="flex items-center gap-6">
            {subscription?.endDate && <div className="text-right"><p className="text-white/70 text-sm">Renewal Date</p><p className="font-semibold">{new Date(subscription.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl"><Calendar className="w-4 h-4" /><span className="font-medium capitalize">{subscription?.status || 'Active'}</span></div>
          </div>
        </div>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="flex items-center gap-3 p-1 bg-slate-800 rounded-xl">
          <button onClick={() => setBillingCycle('monthly')} className={`px-6 py-2.5 rounded-lg font-medium transition-all ${billingCycle === 'monthly' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Monthly</button>
          <button onClick={() => setBillingCycle('yearly')} className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Yearly<span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Save 20%</span></button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;
          const price = billingCycle === 'yearly' ? Math.round(plan.price * 12 * 0.8) : plan.price;
          
          return (
            <div key={plan.id} className={`bg-[#111827] rounded-2xl border p-6 relative ${plan.popular ? 'border-cyan-500' : 'border-slate-700'} ${isCurrentPlan ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#0a0f1a]' : ''}`}>
              {plan.popular && <div className="absolute -top-4 left-1/2 -translate-x-1/2"><span className="bg-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">Most Popular</span></div>}
              
              <div className="text-center mb-6 pt-2">
                <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-${plan.color}-500/20`}><Icon className={`w-7 h-7 text-${plan.color}-400`} /></div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <div className="mt-4"><span className="text-4xl font-bold text-white">₹{price}</span><span className="text-slate-400">/{billingCycle === 'yearly' ? 'year' : plan.period}</span></div>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <div className={`w-5 h-5 rounded-full bg-${plan.color}-500/20 flex items-center justify-center flex-shrink-0 mt-0.5`}><Check className={`w-3 h-3 text-${plan.color}-400`} /></div>
                    <span className="text-slate-400">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button className={`w-full py-3 rounded-xl font-semibold transition-all ${isCurrentPlan ? 'bg-slate-800 text-slate-500 cursor-default' : plan.popular ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90' : 'border-2 border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400'}`} disabled={isCurrentPlan}>
                {isCurrentPlan ? 'Current Plan' : plan.price === 0 ? 'Downgrade' : 'Upgrade Now'}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ / Info */}
      <div className="bg-[#111827] rounded-2xl border border-slate-700 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0"><CreditCard className="w-6 h-6 text-blue-400" /></div>
          <div><h3 className="font-bold text-white mb-2">Secure Payment</h3><p className="text-slate-400 text-sm">All payments are processed securely. You can upgrade, downgrade, or cancel your subscription at any time. Changes take effect immediately and unused time is prorated.</p></div>
        </div>
      </div>
    </div>
  );
}
