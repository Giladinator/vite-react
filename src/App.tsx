import React, { useState, useMemo } from 'react';
import { AlertCircle, DollarSign, Loader2, RefreshCw, Users, TrendingUp, TrendingDown, Award, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { callDeelApi } from './services/deelApiService';

// --- Type Definitions for API Responses ---
interface DeelContract {
  id: string;
  title: string;
  type: 'eor' | 'peo' | 'ongoing_time_based' | 'pay_as_you_go_time_based' | 'milestones' | 'fixed_rate';
  status: string;
  job_title_name?: string;
  worker?: { full_name: string; };
}

interface PaymentResponse {
  line_item: {
    amount: string;
    currency?: string;
  };
  contract: {
    id: string;
    name: string;
  };
  payment: {
    paid_at: string;
  };
}

// --- Type Definitions for Application State ---
type ViewType = 'EOR' | 'PEO' | 'Contractors';

interface EmployeePayment {
  contractId: string;
  name: string;
  role: string;
  status: string;
  amount: number;
  previousAmount?: number;
  change?: number;
  percentChange?: number;
  isTopChange?: boolean;
}

interface DashboardData {
    period1: {
        totalCost: number;
        count: number;
        payments: EmployeePayment[];
        label: string;
    };
    period2: {
        totalCost: number;
        count: number;
        label: string;
    };
    costDiff: DifferenceCalculation | null;
    countDiff: DifferenceCalculation | null;
    topChanges: EmployeePayment[];
}

interface DifferenceCalculation {
  diff: number;
  percentChange: string;
}

const months = [
    { value: 0, name: 'January' }, { value: 1, name: 'February' }, { value: 2, name: 'March' },
    { value: 3, name: 'April' }, { value: 4, name: 'May' }, { value: 5, name: 'June' },
    { value: 6, name: 'July' }, { value: 7, name: 'August' }, { value: 8, name: 'September' },
    { value: 9, name: 'October' }, { value: 10, name: 'November' }, { value: 11, name: 'December' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const DeelPayrollApp: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  const [allContracts, setAllContracts] = useState<DeelContract[]>([]);
  const [period1Payments, setPeriod1Payments] = useState<PaymentResponse[]>([]);
  const [period2Payments, setPeriod2Payments] = useState<PaymentResponse[]>([]);
  const [activeTab, setActiveTab] = useState<ViewType>('EOR');
  
  const [year1, setYear1] = useState(currentYear);
  const [month1, setMonth1] = useState(new Date().getMonth());
  const [year2, setYear2] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).getFullYear());
  const [month2, setMonth2] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).getMonth());

  const fetchAllPaginatedData = async (fromDate: string, toDate: string): Promise<PaymentResponse[]> => {
    let allData: PaymentResponse[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while(hasMore) {
        try {
            const url = `/reports/detailed-payments?limit=${limit}&offset=${offset}&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`;
            const response = await callDeelApi<{ data?: PaymentResponse[] } | PaymentResponse[]>(url, apiKey);
            
            let pageData: PaymentResponse[] = [];
            if (Array.isArray(response)) {
                pageData = response;
            } else if (response && 'data' in response && Array.isArray(response.data)) {
                pageData = response.data;
            }
            
            if (pageData && pageData.length > 0) {
                allData = [...allData, ...pageData];
                offset += pageData.length;
                if (pageData.length < limit) hasMore = false;
            } else {
                hasMore = false;
            }
        } catch (err) {
            console.error(`Error fetching page at offset ${offset}:`, err);
            hasMore = false;
        }
    }
    
    return allData;
  };

  const handleFetchData = async () => {
    if (!apiKey) {
      setError('Please enter your Deel API Key.');
      return;
    }
    setLoading(true);
    setError('');

    try {
        const contractResponse = await callDeelApi<{ data: DeelContract[] }>('/contracts', apiKey);
        const contracts = contractResponse.data || [];
        setAllContracts(contracts);

        const period1Start = `${year1}-${String(month1 + 1).padStart(2, '0')}-01`;
        const period1End = new Date(year1, month1 + 1, 0).toISOString().split('T')[0];
        const period2Start = `${year2}-${String(month2 + 1).padStart(2, '0')}-01`;
        const period2End = new Date(year2, month2 + 1, 0).toISOString().split('T')[0];

        const [p1Payments, p2Payments] = await Promise.all([
            fetchAllPaginatedData(period1Start, period1End),
            fetchAllPaginatedData(period2Start, period2End)
        ]);
        
        setPeriod1Payments(p1Payments);
        setPeriod2Payments(p2Payments);

        if (contracts.length === 0) {
            setError('No contracts found. Please check your API key and account.');
        }

        setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching data.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  
  const calculateDifference = (current: number, previous: number | undefined): DifferenceCalculation | null => {
    if (previous === undefined || current === previous) return null;
    if (previous === 0) return { diff: current, percentChange: '100.00' };
    const diff = current - previous;
    const percentChange = ((diff / previous) * 100).toFixed(2);
    return { diff, percentChange };
  };

  const { eorData, peoData, contractorData } = useMemo(() => {
    const processDashboardData = (contracts: DeelContract[]): DashboardData => {
      const contractIds = new Set(contracts.map(c => c.id));

      const processPayments = (payments: PaymentResponse[]) => {
          // Filter USD payments only
          const usdPayments = payments.filter(p => {
              const currency = p.line_item.currency?.toUpperCase() || 'USD';
              return currency === 'USD' && contractIds.has(p.contract.id);
          });
          
          const totalCost = usdPayments.reduce((acc, p) => {
              const amount = parseFloat(p.line_item.amount.replace(/,/g, ''));
              return acc + (isNaN(amount) ? 0 : amount);
          }, 0);
          
          const paymentsByContract = usdPayments.reduce((acc, p) => {
              const amount = parseFloat(p.line_item.amount.replace(/,/g, ''));
              if (!isNaN(amount)) {
                acc[p.contract.id] = (acc[p.contract.id] || 0) + amount;
              }
              return acc;
          }, {} as Record<string, number>);

          return { totalCost, paymentsByContract };
      };

      const period1 = processPayments(period1Payments);
      const period2 = processPayments(period2Payments);

      // Calculate employee payments with comparisons
      const allContractIds = new Set([
          ...Object.keys(period1.paymentsByContract),
          ...Object.keys(period2.paymentsByContract)
      ]);

      const employeePayments: EmployeePayment[] = Array.from(allContractIds).map(contractId => {
          const contract = contracts.find(c => c.id === contractId);
          const currentAmount = period1.paymentsByContract[contractId] || 0;
          const previousAmount = period2.paymentsByContract[contractId];
          
          let change: number | undefined;
          let percentChange: number | undefined;
          
          if (previousAmount !== undefined) {
              change = currentAmount - previousAmount;
              percentChange = previousAmount !== 0 ? (change / previousAmount) * 100 : 100;
          }

          return {
              contractId,
              name: contract?.worker?.full_name || contract?.title || 'N/A',
              role: contract?.job_title_name || 'N/A',
              status: contract?.status || 'active',
              amount: currentAmount,
              previousAmount,
              change,
              percentChange
          };
      }).filter(p => p.amount > 0); // Only show employees with payments in current period

      // Sort by absolute change and get top 5
      const topChanges = employeePayments
          .filter(p => p.change !== undefined && p.change !== 0)
          .sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!))
          .slice(0, 5)
          .map(p => ({ ...p, isTopChange: true }));

      // Mark top changes in the main list
      const topChangeIds = new Set(topChanges.map(p => p.contractId));
      employeePayments.forEach(p => {
          p.isTopChange = topChangeIds.has(p.contractId);
      });

      return {
          period1: {
              totalCost: period1.totalCost,
              count: employeePayments.length,
              payments: employeePayments.sort((a, b) => b.amount - a.amount),
              label: `${months[month1].name} ${year1}`
          },
          period2: {
              totalCost: period2.totalCost,
              count: Object.keys(period2.paymentsByContract).length,
              label: `${months[month2].name} ${year2}`
          },
          costDiff: calculateDifference(period1.totalCost, period2.totalCost),
          countDiff: calculateDifference(employeePayments.length, Object.keys(period2.paymentsByContract).length),
          topChanges
      };
    };

    return {
        eorData: processDashboardData(allContracts.filter(c => c.type === 'eor')),
        peoData: processDashboardData(allContracts.filter(c => c.type === 'peo')),
        contractorData: processDashboardData(allContracts.filter(c => 
            ['ongoing_time_based', 'pay_as_you_go_time_based', 'milestones', 'fixed_rate'].includes(c.type)
        ))
    };
  }, [allContracts, period1Payments, period2Payments, year1, month1, year2, month2]);

  const renderAuthScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="text-white" size={32} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Deel Payroll Analytics</h2>
            <p className="text-gray-500">Connect your account to view workforce insights</p>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Deel API Key"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Primary Period</label>
                <select value={month1} onChange={(e) => setMonth1(Number(e.target.value))} className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                </select>
                <select value={year1} onChange={(e) => setYear1(Number(e.target.value))} className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Compare With</label>
                <select value={month2} onChange={(e) => setMonth2(Number(e.target.value))} className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                </select>
                <select value={year2} onChange={(e) => setYear2(Number(e.target.value))} className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={handleFetchData}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3.5 px-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              {loading ? <><Loader2 className="animate-spin mr-2" size={20} />Connecting...</> : 'Connect & Analyze'}
            </button>
          </div>
          
          {error && (
            <div className="mt-5 text-sm text-red-600 bg-red-50 p-4 rounded-xl flex items-start">
              <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <p className="text-xs text-gray-400 mt-6 text-center">🔒 Your API key is never stored</p>
        </div>
      </div>
    </div>
  );
  
  const renderTopChanges = (topChanges: EmployeePayment[]) => {
    if (topChanges.length === 0) return null;

    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-sm border border-amber-100 p-6 mb-8">
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mr-3">
            <Award className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Top 5 Payment Changes</h3>
            <p className="text-sm text-gray-600">Largest variations vs previous period</p>
          </div>
        </div>
        <div className="space-y-3">
          {topChanges.map((employee, idx) => (
            <div key={employee.contractId} className="bg-white rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-4 flex-1">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-700">#{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{employee.name}</p>
                  <p className="text-sm text-gray-500">{employee.role}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(employee.amount)}</p>
                {employee.change !== undefined && (
                  <div className={`flex items-center justify-end text-sm font-semibold ${employee.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {employee.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    <span>{formatCurrency(Math.abs(employee.change))} ({Math.abs(employee.percentChange!).toFixed(1)}%)</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDataView = (data: DashboardData, title: ViewType) => {
    if (data.period1.count === 0 && !loading) {
        return (
            <div className="text-center text-gray-500 p-12 bg-white rounded-3xl shadow-sm border border-gray-100">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users size={32} className="text-gray-400" />
                </div>
                <p className="text-xl font-semibold text-gray-700 mb-2">No payment data found</p>
                <p className="text-sm text-gray-500">No {title} payments for {data.period1.label}</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-3xl shadow-sm border border-blue-100">
                    <div className="flex items-center text-blue-700 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
                        <DollarSign size={20} />
                      </div>
                      <span className="font-medium">Total Cost</span>
                    </div>
                    <p className="text-4xl font-bold text-gray-900 mb-2">{formatCurrency(data.period1.totalCost)}</p>
                    <p className="text-sm text-gray-600 mb-3">{data.period1.label}</p>
                    {data.costDiff && (
                         <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-semibold ${data.costDiff.diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {data.costDiff.diff >= 0 ? <TrendingUp size={16} className="mr-1.5" /> : <TrendingDown size={16} className="mr-1.5" />}
                            <span>{data.costDiff.diff >= 0 ? '+' : ''}{formatCurrency(data.costDiff.diff)} ({data.costDiff.percentChange}%)</span>
                        </div>
                    )}
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-3xl shadow-sm border border-purple-100">
                    <div className="flex items-center text-purple-700 mb-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mr-3">
                        <Users size={20} />
                      </div>
                      <span className="font-medium">Workers Paid</span>
                    </div>
                    <p className="text-4xl font-bold text-gray-900 mb-2">{data.period1.count}</p>
                    <p className="text-sm text-gray-600 mb-3">{data.period1.label}</p>
                     {data.countDiff && (
                         <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-semibold ${data.countDiff.diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {data.countDiff.diff >= 0 ? <TrendingUp size={16} className="mr-1.5" /> : <TrendingDown size={16} className="mr-1.5" />}
                            <span>{data.countDiff.diff >= 0 ? '+' : ''}{data.countDiff.diff.toFixed(0)} workers ({data.countDiff.percentChange}%)</span>
                        </div>
                    )}
                </div>
            </div>

            {renderTopChanges(data.topChanges)}

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">{title} Payment Breakdown</h3>
                    <p className="text-sm text-gray-500 mt-1">{data.period1.label} • USD only</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Current Period</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Previous Period</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Change</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.period1.payments.map(p => (
                                <tr key={p.contractId} className={`hover:bg-gray-50 transition-colors ${p.isTopChange ? 'bg-amber-50/50' : ''}`}>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center">
                                        {p.isTopChange && (
                                          <Award size={16} className="text-amber-500 mr-2 flex-shrink-0" />
                                        )}
                                        <span className="font-semibold text-gray-900">{p.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{p.role}</td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">{formatCurrency(p.amount)}</td>
                                    <td className="px-6 py-4 text-right text-gray-600">
                                      {p.previousAmount !== undefined ? formatCurrency(p.previousAmount) : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      {p.change !== undefined && p.change !== 0 ? (
                                        <div className="flex items-center justify-end">
                                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold ${p.change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {p.change >= 0 ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
                                            {formatCurrency(Math.abs(p.change))}
                                            <span className="ml-1 text-xs">({Math.abs(p.percentChange!).toFixed(1)}%)</span>
                                          </span>
                                        </div>
                                      ) : p.previousAmount === undefined ? (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold bg-blue-100 text-blue-700">New</span>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                          p.status === 'in_progress' || p.status === 'active' 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-gray-100 text-gray-700'
                                        }`}>
                                          {p.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
  };

  const renderDashboard = () => (
    <div className="w-full">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl shadow-xl p-8 mb-8 text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Global Workforce Dashboard</h1>
            <p className="text-blue-100">Analyzing {activeTab} workforce costs and trends</p>
          </div>
          <button 
            onClick={handleFetchData} 
            disabled={loading} 
            className="mt-4 sm:mt-0 px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition flex items-center justify-center disabled:opacity-50 border border-white/30"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><RefreshCw size={18} className="mr-2" />Refresh</>}
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
          <nav className="flex space-x-2" aria-label="Tabs">
            {(['EOR', 'PEO', 'Contractors'] as ViewType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  activeTab === tab 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>
      
      <div className="mt-8">
        {activeTab === 'EOR' && renderDataView(eorData, 'EOR')}
        {activeTab === 'PEO' && renderDataView(peoData, 'PEO')}
        {activeTab === 'Contractors' && renderDataView(contractorData, 'Contractors')}
      </div>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 min-h-screen font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
        {!isAuthenticated ? renderAuthScreen() : renderDashboard()}
      </div>
    </div>
  );
};

export default DeelPayrollApp;
