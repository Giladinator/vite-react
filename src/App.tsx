import React, { useState, useMemo } from 'react';
import { AlertCircle, DollarSign, Loader2, RefreshCw, Users } from 'lucide-react';
import { callDeelApi } from './services/deelApiService';

// --- Type Definitions for API Responses ---
interface DeelPayrollReport {
  id: string;
  start_date: string;
  end_date: string;
  total: string;
  employees_count: number;
}

interface DeelPayslip {
  id: string;
  employee_name: string;
  country: string;
  net_pay: string;
  status: string;
  contract: {
    contract_type: 'eor' | 'peo';
  }
}

interface DeelContract {
  id: string;
  name: string;
  job_title_name: string;
  status: string;
  contract_type: 'ongoing_time_based' | 'pay_as_you_go_time_based' | 'milestones' | 'fixed_rate';
  compensation_details: {
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
  roleOrCountry: string;
  net: number;
  currencyOrStatus: string;
}

interface PayrollCycle {
  cycle: string;
  totalCost: number;
  employeeCount: number;
  employees: Employee[];
}

interface PayrollData {
  current: PayrollCycle;
  previous: PayrollCycle | null;
}

interface ContractorData {
    totalCost: number;
    count: number;
    employees: Employee[];
}

const DeelPayrollApp: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // State for different data sources
  const [allPayslips, setAllPayslips] = useState<DeelPayslip[]>([]);
  const [payrollReports, setPayrollReports] = useState<DeelPayrollReport[]>([]);
  const [contractorContracts, setContractorContracts] = useState<DeelContract[]>([]);
  const [activeTab, setActiveTab] = useState<ViewType>('EOR');

  const handleFetchData = async () => {
    if (!apiKey) {
      setError('Please enter your Deel API Key.');
      return;
    }
    setLoading(true);
    setError('');
    setPayrollReports([]);
    setAllPayslips([]);
    setContractorContracts([]);

    try {
      const [reports, contracts] = await Promise.all([
        callDeelApi<DeelPayrollReport[]>('/gp/reports', apiKey),
        callDeelApi<DeelContract[]>('/contracts', apiKey)
      ]);
      
      if (reports && reports.length > 0) {
        setPayrollReports(reports);
        const currentReport = reports[0];
        const payslips = await callDeelApi<DeelPayslip[]>(`/gp/reports/${currentReport.id}/payslips`, apiKey);
        setAllPayslips(payslips);
      }

      if (contracts) {
          const filtered = contracts.filter(c => ['ongoing_time_based', 'pay_as_you_go_time_based', 'milestones', 'fixed_rate'].includes(c.contract_type));
          setContractorContracts(filtered);
      }

      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCycle = (report: DeelPayrollReport, payslips: DeelPayslip[]): PayrollCycle => {
    const totalCost = payslips.reduce((acc, p) => acc + parseFloat(p.net_pay), 0);
    return {
        cycle: `${new Date(report.start_date + 'T00:00:00Z').toLocaleString('default', { month: 'long', timeZone: 'UTC' })} ${new Date(report.start_date + 'T00:00:00Z').getUTCFullYear()}`,
        totalCost: totalCost,
        employeeCount: payslips.length,
        employees: payslips.map(p => ({
            id: p.id,
            name: p.employee_name,
            roleOrCountry: p.country,
            net: parseFloat(p.net_pay),
            currencyOrStatus: (p.status.charAt(0).toUpperCase() + p.status.slice(1)),
        })),
    }
  };

  const eorData = useMemo<PayrollData | null>(() => {
    if (!payrollReports.length) return null;
    const eorPayslips = allPayslips.filter(p => p.contract?.contract_type === 'eor');
    return {
        current: formatCycle(payrollReports[0], eorPayslips),
        previous: null, // Note: Previous cycle comparison per type is complex and omitted for clarity
    };
  }, [allPayslips, payrollReports]);

  const peoData = useMemo<PayrollData | null>(() => {
    if (!payrollReports.length) return null;
    const peoPayslips = allPayslips.filter(p => p.contract?.contract_type === 'peo');
    return {
        current: formatCycle(payrollReports[0], peoPayslips),
        previous: null,
    };
  }, [allPayslips, payrollReports]);
  
  const contractorData = useMemo<ContractorData>(() => {
    const employees: Employee[] = contractorContracts.map(c => ({
        id: c.id,
        name: c.worker?.full_name || c.name,
        roleOrCountry: c.job_title_name || 'N/A',
        net: c.compensation_details?.amount || 0,
        currencyOrStatus: c.status,
    }));
    const totalCost = employees.reduce((acc, emp) => acc + emp.net, 0);
    return { totalCost, count: employees.length, employees };
  }, [contractorContracts]);

  const formatCurrency = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      <p className="text-xs text-gray-400 mt-4 text-center">Your API key is used only for this session and is not stored.</p>
    </div>
  );
  
  const renderPayrollView = (data: PayrollData | null, title: string) => {
    if (!data) return <div className="text-center text-gray-500">No payroll data available for {title}.</div>;

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center text-gray-500 mb-2"><DollarSign size={16} className="mr-2" /><span>Total Cost ({title})</span></div>
                    <p className="text-3xl font-bold text-gray-800">${formatCurrency(data.current.totalCost)}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center text-gray-500 mb-2"><Users size={16} className="mr-2" /><span>Employees Paid ({title})</span></div>
                    <p className="text-3xl font-bold text-gray-800">{data.current.employeeCount}</p>
                </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-800">{title} Payments</h3>
                    <p className="text-gray-500 mt-1">Detailed breakdown for the {data.current.cycle} cycle.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3">Employee</th>
                                <th scope="col" className="px-6 py-3">Country</th>
                                <th scope="col" className="px-6 py-3 text-right">Net Payment</th>
                                <th scope="col" className="px-6 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.current.employees.map(emp => (
                                <tr key={emp.id} className="bg-white border-b hover:bg-gray-50">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{emp.name}</th>
                                    <td className="px-6 py-4">{emp.roleOrCountry}</td>
                                    <td className="px-6 py-4 text-right font-semibold text-gray-800">${formatCurrency(emp.net)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${emp.currencyOrStatus === 'Paid' || emp.currencyOrStatus === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{emp.currencyOrStatus}</span>
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

  const renderContractorView = () => (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center text-gray-500 mb
