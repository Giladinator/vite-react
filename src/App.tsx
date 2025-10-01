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

interface PaymentResponse {
  invoice: {
    id: string;
    document: string;
    issued_at: string;
  };
  line_item: {
    description: string;
    category: string;
    amount: string;
    currency: string;
  };
  payment: {
    paid_at: string;
    currency: string;
    amount: string;
    document: string;
  };
  contract: {
    id: string;
    name: string;
    legal_entity: string;
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
  
  // State for user-selected dates
  const [year1, setYear1] = useState(currentYear);
  const [month1, setMonth1] = useState(new Date().getMonth());
  const [year2, setYear2] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).getFullYear());
  const [month2, setMonth2] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).getMonth());

  const fetchAllPaginatedData = async (params: Record<string, string>): Promise<PaymentResponse[]> => {
    let allData: PaymentResponse[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while(hasMore) {
        const queryParams = new URLSearchParams(params);
        const url = `/reports/detailed-payments?limit=${limit}&offset=${offset}&${queryParams.toString()}`;
        const pageData = await callDeelApi<PaymentResponse[]>(url, apiKey);
        
        if (pageData && pageData.length > 0) {
            allData = [...allData, ...pageData];
            offset += pageData.length;
            if (pageData.length < limit) hasMore = false;
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
        console.log("--- Fetched Contracts ---", contracts);
        setAllContracts(contracts || []);

        const period1Start = new Date(year1, month1, 1).toISOString();
        const period1End = new Date(year1, month1 + 1, 0, 23, 59, 59, 999).toISOString();
        const period2Start = new Date(year2, month2, 1).toISOString();
        const period2End = new Date(year2, month2 + 1, 0, 23, 59, 59, 999).toISOString();

        const [p1Payments, p2Payments] = await Promise.all([
            fetchAllPaginatedData({ from_date: period1Start, to_date: period1End }),
            fetchAllPaginatedData({ from_date: period2Start, to_date: period2End })
        ]);
        
        console.log(`--- Payments for ${months[month1].name} ${year1} ---`, p1Payments);
        console.log(`--- Payments for ${months[month2].name} ${year2} ---`, p2Payments);
        
        setPeriod1Payments(p1Payments);
        setPeriod2Payments(p2Payments);

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

  const processDashboardData = useMemo(() => {
    return (contracts: DeelContract[]): DashboardData => {
      const contractIds = new Set(contracts.map(c => c.id));

      const processPayments = (payments: PaymentResponse[], year: number, month: number) => {
          const filteredPayments = payments.filter(p => contractIds.has(p.contract.id));
          const totalCost = filteredPayments.reduce((acc, p) => {
              const amount = parseFloat(p.line_item.amount.replace(/,/g, ''));
              return acc + amount;
          }, 0);
          
          const paymentsByContract = filteredPayments.reduce((acc, p) => {
              const amount = parseFloat(p.line_item.amount.replace(/,/g, ''));
              acc[p.contract.id] = (acc[p.contract.id] || 0) + amount;
              return acc;
          }, {} as Record<string, number>);

          const employeePayments: EmployeePayment[] = Object.keys(paymentsByContract).map(contractId => {
              const contract = contracts.find(c => c.id === contractId);
              const paymentData = filteredPayments.find(p => p.contract.id === contractId);
              return {
                  contractId: contractId,
                  name: contract?.worker?.full_name || contract?.name || paymentData?.contract.name || 'N/A',
                  role: contract?.job_title_name || 'N/A',
                  status: contract?.status || 'active',
                  amount: paymentsByContract[contractId]
              }
          });
          
          return { 
              totalCost, 
              count: employeePayments.length, 
              payments: employeePayments,
              label: `${months[month].name} ${year}`
          };
      };

      const period1 = processPayments(period1Payments, year1, month1);
      const period2 = processPayments(period2Payments, year2, month2);

      return {
          period1,
          period2: { totalCost: period2.totalCost, count: period2.count, label: period2.label },
          costDiff: calculateDifference(period1.totalCost, period2.totalCost),
          countDiff: calculateDifference(period1.count, period2.count),
      };
    };
  }, [period1Payments, period2Payments, year1, month1, year2, month2]);

  const eorData = useMemo(() => 
    processDashboardData(allContracts.filter(c => c.contract_type === 'eor')), 
    [allContracts, processDashboardData]
  );
  
  const peoData = useMemo(() => 
    processDashboardData(allContracts.filter(c => c.contract_type === 'peo')), 
    [allContracts, processDashboardData]
  );
  
  const contractorData = useMemo(() => 
    processDashboardData(allContracts.filter(c => ['ongoing_time_based', 'pay_as_you_go_time_based', 'milestones', 'fixed_rate'].includes(c.contract_type))), 
    [allContracts, processDashboardData]
  );

  const renderAuthScreen = () => (
    <div className="w-full max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Connect to Deel</h2>
      <p className="text-center text-gray-500 mb-6">Enter your API key and select two periods to compare.</p>
      
      <div className="space-y-4">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your Deel API Key"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />

        <fieldset className="border border-gray-200 p-4 rounded-lg">
            <legend className="text-sm font-medium text-gray-600 px-1">Primary Period</legend>
            <div className="flex space-x-2">
                <select value={month1} onChange={(e) => setMonth1(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg border border-gray-300">
                    {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                </select>
                <select value={year1} onChange={(e) => setYear1(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg border border-gray-300">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
        </fieldset>
        
        <fieldset className="border border-gray-200 p-4 rounded-lg">
            <legend className="text-sm font-medium text-gray-600 px-1">Comparison Period</legend>
             <div className="flex space-x-2">
                <select value={month2} onChange={(e) => setMonth2(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg border border-gray-300">
