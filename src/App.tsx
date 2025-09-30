import React, { useState } from 'react';
import { AlertCircle, Download, RefreshCw, Users, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

// Type Definitions
interface Employee {
  id: number;
  name: string;
  role: string;
  country: string;
  salary: number;
  bonus: number;
  deductions: number;
  net: number;
  status: 'Paid' | 'Processing' | 'Pending';
}

interface PayrollCycle {
  cycle: string;
  totalCost: number;
  employeeCount: number;
  employees: Employee[];
}

interface PayrollData {
  current: PayrollCycle;
  previous: PayrollCycle;
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

  // Mock data for demonstration (replace with actual API calls)
  const mockPayrollData: PayrollData = {
    current: {
      cycle: 'September 2025',
      totalCost: 245780.50,
      employeeCount: 24,
      employees: [
        { id: 1, name: 'Sarah Johnson', role: 'Senior Developer', country: 'Brazil', salary: 8500, bonus: 1000, deductions: 850, net: 8650, status: 'Paid' },
        { id: 2, name: 'Miguel Rodriguez', role: 'Product Manager', country: 'Mexico', salary: 7200, bonus: 500, deductions: 720, net: 6980, status: 'Paid' },
        { id: 3, name: 'Anna Kowalski', role: 'UX Designer', country: 'Poland', salary: 6800, bonus: 0, deductions: 680, net: 6120, status: 'Processing' },
        { id: 4, name: 'Chen Wei', role: 'DevOps Engineer', country: 'Singapore', salary: 9200, bonus: 1500, deductions: 920, net: 9780, status: 'Paid' },
        { id: 5, name: 'Emma Thompson', role: 'Marketing Lead', country: 'UK', salary: 7500, bonus: 800, deductions: 750, net: 7550, status: 'Paid' }
      ]
    },
    previous: {
      cycle: 'August 2025',
      totalCost: 238450.25,
      employeeCount: 23,
      employees: [
        { id: 1, name: 'Sarah Johnson', role: 'Senior Developer', country: 'Brazil', salary: 8500, bonus: 500, deductions: 850, net: 8150, status: 'Paid' },
        { id: 2, name: 'Miguel Rodriguez', role: 'Product Manager', country: 'Mexico', salary: 7200, bonus: 0, deductions: 720, net: 6480, status: 'Paid' },
        { id: 3, name: 'Anna Kowalski', role: 'UX Designer', country: 'Poland', salary: 6800, bonus: 200, deductions: 680, net: 6320, status: 'Paid' },
        { id: 4, name: 'Chen Wei', role: 'DevOps Engineer', country: 'Singapore', salary: 9200, bonus: 1000, deductions: 920, net: 9280, status: 'Paid' },
        { id: 6, name: 'Lucas Silva', role: 'Backend Developer', country: 'Brazil', salary: 7800, bonus: 0, deductions: 780, net: 7020, status: 'Paid' }
      ]
    }
  };

  const handleAuthenticate = async (): Promise<void> => {
    if (!apiKey.trim()) {
      setError('Please enter your Deel API key');
      return;
    }
    
    setLoading(true);
    setError('');
    
    // Simulate API authentication
    setTimeout(() => {
      setIsAuthenticated(true);
      setLoading(false);
      fetchPayrollData();
    }, 1000);
  };

  const fetchPayrollData = async (): Promise<void> => {
    setLoading(true);
    setError('');
    
    // Simulate API call
    setTimeout(() => {
      setPayrollData(mockPayrollData);
      setLoading(false);
    }, 1500);
  };

  const calculateDifference = (current: number, previous: number): DifferenceCalculation => {
    const diff = current - previous;
    const percentChange = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : '0';
    return { diff, percentChange };
  };

  const exportToCSV = (): void => {
    if (!payrollData) return;
    
    const csvRows: string[][] = [
      ['Payroll Comparison Report', '', '', '', '', '', ''],
      ['Current Cycle:', payrollData.current.cycle, '', 'Previous Cycle:', payrollData.previous.cycle],
      [''],
      ['Employee Name', 'Role', 'Country', 'Current Salary', 'Previous Salary', 'Difference', 'Status'],
    ];

    payrollData.current.employees.forEach((emp: Employee) => {
      const prevEmp = payrollData.previous.employees.find((e: Employee) => e.id === emp.id);
      const prevSalary = prevEmp ? prevEmp.net : 0;
      const diff = emp.net - prevSalary;
      
      csvRows.push([
        emp.name,
        emp.role,
        emp.country,
        `$${emp.net.toFixed(2)}`,
        `$${prevSalary.toFixed(2)}`,
        `$${diff.toFixed(2)}`,
        emp.status
      ]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_comparison_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Deel Payroll Dashboard</h1>
            <p className="text-gray-600">Connect your Deel account to view payroll reports</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deel API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
                <AlertCircle className="text-red-500 mt-0.5 mr-2 flex-shrink-0" size={20} />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            <button
              onClick={handleAuthenticate}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : 'Connect to Deel'}
            </button>

            <div className="text-center text-sm text-gray-500 mt-4">
              <p>Get your API key from</p>
              <a href="https://developer.deel.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                developer.deel.com
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !payrollData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-4" size={48} />
          <p className="text-gray-700 text-lg">Loading payroll data...</p>
        </div>
      </div>
    );
  }

  const costDiff = payrollData ? calculateDifference(
    payrollData.current.totalCost,
    payrollData.previous.totalCost
  ) : { diff: 0, percentChange: '0' };

  const employeeDiff = payrollData ? 
    payrollData.current.employeeCount - payrollData.previous.employeeCount : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Payroll Comparison Dashboard</h1>
              <p className="text-gray-600">EOR Employee Payroll Analysis</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchPayrollData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download size={18} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {payrollData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <DollarSign className="text-blue-600" size={24} />
                </div>
                <div className={`flex items-center gap-1 text-sm font-semibold ${costDiff.diff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {costDiff.diff >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {Math.abs(Number(costDiff.percentChange))}%
                </div>
              </div>
              <h3 className="text-gray-600 text-sm mb-1">Total Payroll Cost</h3>
              <p className="text-2xl font-bold text-gray-800">${payrollData.current.totalCost.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-2">
                Previous: ${payrollData.previous.totalCost.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Users className="text-purple-600" size={24} />
                </div>
                {employeeDiff !== 0 && (
                  <div className={`flex items-center gap-1 text-sm font-semibold ${employeeDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {employeeDiff > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {Math.abs(employeeDiff)}
                  </div>
                )}
              </div>
              <h3 className="text-gray-600 text-sm mb-1">Active Employees</h3>
              <p className="text-2xl font-bold text-gray-800">{payrollData.current.employeeCount}</p>
              <p className="text-sm text-gray-500 mt-2">
                Previous: {payrollData.previous.employeeCount}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <TrendingUp className="text-green-600" size={24} />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm mb-1">Average Cost per Employee</h3>
              <p className="text-2xl font-bold text-gray-800">
                ${(payrollData.current.totalCost / payrollData.current.employeeCount).toLocaleString(undefined, {maximumFractionDigits: 0})}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Previous: ${(payrollData.previous.totalCost / payrollData.previous.employeeCount).toLocaleString(undefined, {maximumFractionDigits: 0})}
              </p>
            </div>
          </div>
        )}

        {/* Comparison Table */}
        {payrollData && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Employee Comparison</h2>
              <p className="text-gray-600 text-sm mt-1">
                {payrollData.current.cycle} vs {payrollData.previous.cycle}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Country</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Current Net</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Previous Net</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Change</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payrollData.current.employees.map((emp: Employee) => {
                    const prevEmp = payrollData.previous.employees.find((e: Employee) => e.id === emp.id);
                    const prevNet = prevEmp ? prevEmp.net : 0;
                    const change = emp.net - prevNet;
                    const isNew = !prevEmp;

                    return (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-800">{emp.name}</div>
                          {isNew && <span className="text-xs text-green-600 font-semibold">NEW</span>}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{emp.role}</td>
                        <td className="px-6 py-4 text-gray-600">{emp.country}</td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-800">
                          ${emp.net.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {prevNet > 0 ? `$${prevNet.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {change !== 0 && (
                            <span className={`font-semibold ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                              {change > 0 ? '+' : ''}{change > 0 || change < 0 ? `$${change.toLocaleString()}` : '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            emp.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeelPayrollApp;
