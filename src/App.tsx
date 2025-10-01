import React, { useState, useMemo } from 'react';
import { AlertCircle, DollarSign, Loader2, RefreshCw, Users } from 'lucide-react';
import { callDeelApi } from './services/deelApiService';

// --- Type Definitions for API Responses ---
interface DeelContract {
  id: string;
  name: string;
  job_title_name: string;
  status: string;
  contract_type: 'eor' | 'peo' | 'ongoing_time_based' | 'pay_as_you_go_time_based' | 'milestones' | 'fixed_rate';
  compensation_details?: { // Make optional to handle cases where it might be missing
    amount: number;
    currency: string;
  };
  worker?: {
    full_name: string;
  }
}

// --- Type Definitions for Application State ---
type ViewType = 'EOR' | 'PEO' | 'Contractors';

interface Employee {
  id: string;
  name: string;
  role: string;
  status: string;
  compensation: string;
}

interface DashboardData {
    totalCost: number;
    count: number;
    employees: Employee[];
}

const DeelPayrollApp: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  const [allContracts, setAllContracts] = useState<DeelContract[]>([]);
  const [activeTab, setActiveTab] = useState<ViewType>('EOR');

  const handleFetchData = async () => {
    if (!apiKey) {
      setError('Please enter your Deel API Key.');
      return;
    }
    setLoading(true);
    setError('');
    setAllContracts([]);

    try {
      const contracts = await callDeelApi<DeelContract[]>('/contracts', apiKey);
      setAllContracts(contracts || []);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while fetching contracts.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (value: number, currency: string) => 
    value.toLocaleString(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const processContracts = (contracts: DeelContract[]): DashboardData => {
    const employees: Employee[] = contracts.map(c => ({
        id: c.id,
        name: c.worker?.full_name || c.name,
        role: c.job_title_name || 'N/A',
        status: c.status,
        compensation: c.compensation_details 
            ? formatCurrency(c.compensation_details.amount, c.compensation_details.currency)
            : 'N/A',
    }));

    const totalCost = contracts.reduce((acc, c) => acc + (c.compensation_details?.amount || 0), 0);
    
    return { totalCost, count: employees.length, employees };
  };

  const eorData = useMemo(() => processContracts(allContracts.filter(c => c.contract_type === 'eor')), [allContracts]);
  const peoData = useMemo(() => processContracts(allContracts.filter(c => c.contract_type === 'peo')), [allContracts]);
  const contractorData = useMemo(() => processContracts(allContracts.filter(c => ['ongoing_time_based', 'pay_as_you_go_time_based', 'milestones', 'fixed_rate'].includes(c.contract_type))), [allContracts]);

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
    if (data.count === 0) return <div className="text-center text-gray-500 p-8">No {title} data found.</div>;

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center text-gray-500 mb-2"><DollarSign size={16} className="mr-2" /><span>Total Cost ({title})</span></div>
                    {/* Note: Total cost for different currencies is summed up without conversion */}
                    <p className="text-3xl font-bold text-gray-800">${data.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center text-gray-500 mb-2"><Users size={16} className="mr-2" /><span>Total Workers ({title})</span></div>
                    <p className="text-3xl font-bold text-gray-800">{data.count}</p>
                </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-800">{title} Details</h3>
                    <p className="text-gray-500 mt-1">List of active {title.toLowerCase()} and their compensation.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3">Name</th>
                                <th scope="col" className="px-6 py-3">Role</th>
                                <th scope="col" className="px-6 py-3 text-right">Compensation</th>
                                <th scope="col" className="px-6 py-3 text-center">Contract Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.employees.map(emp => (
                                <tr key={emp.id} className="bg-white border-b hover:bg-gray-50">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{emp.name}</th>
                                    <td className="px-6 py-4">{emp.role}</td>
                                    <td className="px-6 py-4 text-right font-semibold text-gray-800">{emp.compensation}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${emp.status === 'in_progress' || emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{emp.status}</span>
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
