import React, { useState, useMemo, useEffect } from 'react';
import { AlertCircle, Download, RefreshCw, Users, DollarSign, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { callDeelApi } from './services/deelApiService';

// --- Type Definitions for Deel API Responses ---
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
    contract_type: 'eor' | 'peo' | 'ongoing_time_based' | 'pay_as_you_go_time_based' | 'milestones' | 'fixed_rate';
  }
}

// --- Type Definitions for Application State ---
type EmployeeType = 'EOR' | 'PEO' | 'Contractor';

interface Employee {
  id: string;
  name: string;
  country: string;
  net: number;
  status: 'Paid' | 'Processing' | 'Pending' | 'Completed';
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

interface DifferenceCalculation {
  diff: number;
  percentChange: string;
}

const DeelPayrollApp: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
  const [activeTab, setActiveTab] = useState<EmployeeType>('EOR');

  const handleFetchData = async () => {
    if (!apiKey) {
      setError('Please enter your Deel API Key.');
      return;
    }
    setLoading(true);
    setError('');
    setPayrollData(null);

    try {
      // Fetch payroll reports to get cycle data
      const reports = await callDeelApi<DeelPayrollReport[]>('/gp/reports', apiKey);
      if (!reports || reports.length === 0) {
        setError('No payroll reports found. This data is needed for cycle comparison.');
        setLoading(false);
        return;
      }
      
      const currentReport = reports[0];
      const previousReport = reports.length > 1 ? reports[1] : null;

      // Fetch payslips for the current and previous reports
      const payslipPromises = [
        callDeelApi<DeelPayslip[]>(`/gp/reports/${currentReport.id}/payslips`, apiKey),
      ];

      if (previousReport) {
        payslipPromises.push(callDeelApi<DeelPayslip[]>(`/gp/reports/${previousReport.id}/payslips`, apiKey));
      } else {
        payslipPromises.push(Promise.resolve([]));
      }

      const [currentPayslips, previousPayslips] = await Promise.all(payslipPromises);
      
      const formatCycle = (report: DeelPayrollReport, payslips: DeelPayslip[]): PayrollCycle => {
        const date = new Date(report.start_date + 'T00:00:00Z');
        const month = date.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
        const year = date.getUTCFullYear();
        
        return {
          cycle: `${month} ${year}`,
          totalCost: parseFloat(report.total),
          employeeCount: report.employees_count,
          employees: payslips.map(p => ({
            id: p.id,
            name: p.employee_name,
            country: p.country,
            net: parseFloat(p.net_pay),
            status: (p.status.charAt(0).toUpperCase() + p.status.slice(1)) as Employee['status'],
          })),
        };
      };

      const formattedData: PayrollData = {
        current: formatCycle(currentReport, currentPayslips),
        previous: previousReport && previousPayslips ? formatCycle(previousReport, previousPayslips) : null,
      };

      setPayrollData(formattedData);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const calculateDifference = (current: number, previous: number | undefined): DifferenceCalculation => {
    if (previous === undefined || previous === 0) return { diff: current, percentChange: '100.00' };
    const diff = current - previous;
    const percentChange = ((diff / previous) * 100).toFixed(2);
    return { diff, percentChange };
  };

  const totalCostDiff = payrollData ? calculateDifference(payrollData.current.totalCost, payrollData.previous?.totalCost) : null;
  const employeeCountDiff = payrollData ? calculateDifference(payrollData.current.employeeCount, payrollData.previous?.employeeCount) : null;
  
  const formatCurrency = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderAuthScreen = () => (
    <div className="w-full max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Connect to Deel</h2>
      <p className="text-center text-gray-500 mb-6">Enter your API key to view your payroll dashboard.</p>
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
          {loading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={20} />
              Connecting...
            </>
          ) : (
            'Connect & View Payroll'
          )}
        </button>
      </div>
      {error && (
        <div className="mt-4 text-center text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-center justify-center">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-4 text-center">Your API key is used only for this session and is not stored.</p>
    </div>
  );

  const renderDashboard = () => (
    payrollData && (
      <div className="w-full">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Payroll Overview</h1>
            <p className="text-gray-500 mt-1">Cycle: {payrollData.current.cycle}</p>
          </div>
          <div className="flex items-center space-x-2 mt-4 sm:mt-0">
            <button onClick={handleFetchData} disabled={loading} className="p-2 rounded-lg border bg-white hover:bg-gray-50 transition flex items-center justify-center disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            </button>
            <button className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 transition flex items-center space-x-2">
              <Download size={16} />
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center text-gray-500 mb-2">
              <DollarSign size={16} className="mr-2" />
              <span>Total Payroll Cost</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">${formatCurrency(payrollData.current.totalCost)}</p>
            {totalCostDiff && payrollData.previous && (
              <div className={`flex items-center mt-2 text-sm ${totalCostDiff.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalCostDiff.diff >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                <span>{totalCostDiff.diff >= 0 ? '+' : ''}${formatCurrency(totalCostDiff.diff)} ({totalCostDiff.percentChange}%) vs last cycle</span>
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center text-gray-500 mb-2">
              <Users size={16} className="mr-2" />
              <span>Employees Paid</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{payrollData.current.employeeCount}</p>
            {employeeCountDiff && payrollData.previous && (
              <div className={`flex items-center mt-2 text-sm ${employeeCountDiff.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {employeeCountDiff.diff >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                <span>{employeeCountDiff.diff >= 0 ? '+' : ''}{employeeCountDiff.diff.toFixed(0)} employees ({employeeCountDiff.percentChange}%) vs last cycle</span>
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center text-gray-500 mb-2">
              <DollarSign size={16} className="mr-2" />
              <span>Previous Cycle Cost</span>
            </div>
            <p className="text-3xl font-bold text-gray-500">
              {payrollData.previous ? `$${formatCurrency(payrollData.previous.totalCost)}` : 'N/A'}
            </p>
            <p className="text-sm text-gray-400 mt-2">{payrollData.previous ? payrollData.previous.cycle : 'No previous cycle data'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-gray-800">Employee Payments</h3>
            <p className="text-gray-500 mt-1">Detailed breakdown of payments for the current cycle.</p>
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
                {payrollData.current.employees.map(emp => (
                  <tr key={emp.id} className="bg-white border-b hover:bg-gray-50">
                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{emp.name}</th>
                    <td className="px-6 py-4">{emp.country}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-800">${formatCurrency(emp.net)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        emp.status === 'Paid' || emp.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>{emp.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
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
