import React, { useState, useMemo } from 'react';
import { AlertCircle, DollarSign, Loader2, RefreshCw, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { callDeelApi } from './services/deelApiService';

// --- Type Definitions for API Responses ---
interface DeelContract {
  id: string;
  name: string;
  job_title_name: string;
  status: string;
  contract_type: 'eor' | 'peo' | 'ongoing_time_based' | 'pay_as_you_go_time_based' | 'milestones' | 'fixed_rate';
  worker?: { full_name: string; };
}

interface Payment {
  id: string;
  contract_id: string;
  amount: string;
  // Add other relevant payment fields if needed
}

// --- Type Definitions for Application State ---
type ViewType = 'EOR' | 'PEO' | 'Contractors';

interface EmployeePayment {
  contractId: string;
  name: string;
  role: string;
  status: string;
  amount: number;
}

interface DashboardData {
    current: {
        totalCost: number;
        count: number;
        payments: EmployeePayment[];
    };
    previous: {
        totalCost: number;
        count: number;
    };
    costDiff: DifferenceCalculation | null;
    countDiff: DifferenceCalculation | null;
}

interface DifferenceCalculation {
  diff: number;
  percentChange: string;
}

const DeelPayrollApp: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  const [allContracts, setAllContracts] = useState<DeelContract[]>([]);
  const [currentMonthPayments, setCurrentMonthPayments] = useState<Payment[]>([]);
  const [previousMonthPayments, setPreviousMonthPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<ViewType>('EOR');

  const fetchAllPaginatedData = async (baseUrl: string, params: Record<string, string>): Promise<Payment[]> => {
    let allData: Payment[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while(hasMore) {
        const queryParams = new URLSearchParams(params);
        const url = `${baseUrl}?limit=${limit}&offset=${offset}&${queryParams.toString()}`;
        
        const pageData = await callDeelApi<Payment[]>(url, apiKey);
        
        if (pageData && pageData.length > 0) {
            allData = [...allData, ...pageData];
            offset += pageData.length;
            if (pageData.length < limit) {
                hasMore = false;
            }
        } else {
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
        const contracts = await callDeelApi<DeelContract[]>('/contracts', apiKey);
        setAllContracts(contracts || []);

        // Corrected date formatting to full ISO 8601 timestamp
        const today = new Date();
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999).toISOString();

        // Corrected parameter names to from_date and to_date
        const [currentPayments, previousPayments] = await Promise.all([
            fetchAllPaginatedData('/reports/detailed-payments', { from_date: currentMonthStart }),
            fetchAllPaginatedData('/reports/detailed-payments', { from_date: lastMonthStart, to_date: lastMonthEnd })
        ]);
        
        setCurrentMonthPayments(currentPayments);
        setPreviousMonthPayments(previousPayments);

        setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching data.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (value: number) => 
    value.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const calculateDifference = (current: number, previous: number | undefined): DifferenceCalculation | null => {
    if (previous === undefined || current === previous) return null;
    if (previous === 0) return { diff: current, percentChange: '100.00' };
    const diff = current - previous;
    const percentChange = ((diff / previous) * 100).toFixed(2);
    return { diff, percentChange };
  };

  const processDashboardData = (contracts: DeelContract[]): DashboardData => {
    const contractIds = new Set(contracts.map(c => c.id));

    const processPayments = (payments: Payment[]) => {
        const filteredPayments = payments.filter(p => contractIds.has(p.contract_id));
        const totalCost = filteredPayments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
        
        const paymentsByContract = filteredPayments.reduce((acc, p) => {
            acc[p.contract_id] = (acc[p.contract_id] || 0) + parseFloat(p.amount);
            return acc;
        }, {} as Record<string, number>);

        const employeePayments: EmployeePayment[] = Object.keys(paymentsByContract).map(contractId => {
            const contract = contracts.find(c => c.id === contractId);
            return {
                contractId: contractId,
                name: contract?.worker?.full_name || contract?.name || 'N/A',
                role: contract?.job_title_name || 'N/A',
                status: contract?.status || 'active',
                amount: paymentsByContract[contractId]
            }
        });
        
        return { totalCost, count: employeePayments.length, payments: employeePayments };
    };

    const current = processPayments(currentMonthPayments);
    const previous = processPayments(previousMonthPayments);

    return {
        current,
        previous: { totalCost: previous.totalCost, count: previous.count },
        costDiff: calculateDifference(current.totalCost, previous.totalCost),
        countDiff: calculateDifference(current.count, previous.count),
    };
  };

  const eorData = useMemo(() => processDashboardData(allContracts.filter(c => c.contract_type === 'eor')), [allContracts, currentMonthPayments, previousMonthPayments]);
  const peoData = useMemo(() => processDashboardData(allContracts.filter(c => c.contract_type === 'peo')), [allContracts, currentMonthPayments, previousMonthPayments]);
  const contractorData = useMemo(() => processDashboardData(allContracts.filter(c => ['ongoing_time_based', 'pay_as_you_go_time_based', 'milestones', 'fixed_rate'].includes(c.contract_type))), [allContracts, currentMonthPayments, previousMonthPayments]);

  const renderAuthScreen = () => (
    <div className="w-full max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Connect to Deel</h2>
      <p className="text-center text-gray-500 mb-6">Enter your API key to view your dashboard.</p>
      <div className="space-y-4">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your Deel API Key"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        <button
          onClick={handleFetchData}
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center disabled:bg-blue-300"
        >
          {loading ? <><Loader2 className="animate-spin mr-2" size={20} />Connecting...</> : 'Connect & View Dashboard'}
        </button>
      </div>
      {error && <div className="mt-4 text-center text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-center justify-center"><AlertCircle size={16} className="mr-2" />{error}</div>}
      <p className="text-xs text-gray-400 mt-4 text-center">Your API key is not stored.</p>
    </div>
  );
  
  const renderDataView = (data: DashboardData, title: ViewType) => {
    if (data.current.count === 0 && !loading) return <div className="text-center text-gray-500 p-8">No current payment data found for {title}.</div>;

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center text-gray-500 mb-2"><DollarSign size={16} className="mr-2" /><span>Total Cost ({title})</span></div>
                    <p className="text-3xl font-bold text-gray-800">{formatCurrency(data.current.totalCost)}</p>
                    {data.costDiff && (
                         <div className={`flex items-center mt-2 text-sm ${data.costDiff.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {data.costDiff.diff >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                            <span>{data.costDiff.diff >= 0 ? '+' : ''}{formatCurrency(data.costDiff.diff)} ({data.costDiff.percentChange}%) vs last month</span>
                        </div>
                    )}
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center text-gray-500 mb-2"><Users size={16} className="mr-2" /><span>Workers Paid ({title})</span></div>
                    <p className="text-3xl font-bold text-gray-800">{data.current.count}</p>
                     {data.countDiff && (
                         <div className={`flex items-center mt-2 text-sm ${data.countDiff.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {data.countDiff.diff >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                            <span>{data.countDiff.diff >= 0 ? '+' : ''}{data.countDiff.diff.toFixed(0)} workers ({data.countDiff.percentChange}%) vs last month</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-800">{title} Payment Details</h3>
                    <p className="text-gray-500 mt-1">Breakdown of payments for the current month.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3">Name</th>
                                <th scope="col" className="px-6 py-3">Role</th>
                                <th scope="col" className="px-6 py-3 text-right">Payment Amount</th>
                                <th scope="col" className="px-6 py-3 text-center">Contract Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.current.payments.map(p => (
                                <tr key={p.contractId} className="bg-white border-b hover:bg-gray-50">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{p.name}</th>
                                    <td className="px-6 py-4">{p.role}</td>
                                    <td className="px-6 py-4 text-right font-semibold text-gray-800">{formatCurrency(p.amount)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${p.status === 'in_progress' || p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status}</span>
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
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Global Workforce Dashboard</h1>
          <p className="text-gray-500 mt-1">Viewing data for: {activeTab}</p>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button onClick={handleFetchData} disabled={loading} className="p-2 rounded-lg border bg-white hover:bg-gray-50 transition flex items-center justify-center disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
          </button>
        </div>
      </header>

      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {(['EOR', 'PEO', 'Contractors'] as ViewType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
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
    <div className="bg-gray-50 min-h-screen font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {!isAuthenticated ? renderAuthScreen() : renderDashboard()}
      </div>
    </div>
  );
};

export default DeelPayrollApp;
