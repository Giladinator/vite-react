import React, { useState, useMemo } from 'react';
import { AlertCircle, RefreshCw, Users, DollarSign, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

// --- Type Definitions ---
type EmployeeType = 'EOR' | 'Contractor';

interface Employee {
  id: string;
  name: string;
  type: EmployeeType;
  country: string;
  net: number;
  status: string;
  uniqueId: string;
}

interface PayrollCycle {
  cycleId: string;
  cycleLabel: string;
  totalCost: number;
  employeeCount: number;
  employees: Employee[];
}

interface PayrollData {
  cycles: PayrollCycle[];
}

interface DifferenceCalculation {
  diff: number;
  percentChange: string;
}

// --- API Helper ---
const callDeelApi = async <T>(endpoint: string, apiKey: string, params: Record<string, string> = {}): Promise<T> => {
  const API_BASE_URL = 'https://api.letsdeel.com/rest/v2';
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  
  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.errors?.[0]?.message || `API error: ${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }
  return response.json();
};

// --- Data Fetching Logic ---
const fetchAllPayrollData = async (apiKey: string): Promise<PayrollCycle[]> => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setMonth(toDate.getMonth() - 2);
    
    const toDateString = toDate.toISOString().split('T')[0];
    const fromDateString = fromDate.toISOString().split('T')[0];

    const eorReports = await callDeelApi<any[]>('/gp/reports', apiKey);
    const eorPayslipsPromises = eorReports.map(report => 
        callDeelApi<any[]>(`/gp/reports/${report.id}/payslips`, apiKey).then(payslips => ({ report, payslips }))
    );
    const eorData = await Promise.all(eorPayslipsPromises);

    const contractorInvoices = await callDeelApi<any>('/invoices', apiKey, { issued_from: fromDateString, issued_to: toDateString, limit: '99' });

    const cyclesMap = new Map<string, PayrollCycle>();

    eorData.forEach(({ report, payslips }) => {
        const date = new Date(report.start_date + 'T00:00:00Z');
        let cycleId = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        let cycleLabel = date.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });

        if (payslips.some((p: any) => p.country === 'US')) {
             const day = date.getUTCDate();
             if (day < 16) {
                 cycleId += '-1';
                 cycleLabel += ' (1st Half)';
             } else {
                 cycleId += '-2';
                 cycleLabel += ' (2nd Half)';
             }
        }

        if (!cyclesMap.has(cycleId)) {
            cyclesMap.set(cycleId, { cycleId, cycleLabel, totalCost: 0, employeeCount: 0, employees: [] });
        }
        const cycle = cyclesMap.get(cycleId)!;
        cycle.totalCost += parseFloat(report.total);
        cycle.employeeCount += report.employees_count;
        payslips.forEach((p: any) => {
            cycle.employees.push({ id: p.id, name: p.employee_name, type: 'EOR', country: p.country, net: parseFloat(p.net_pay), status: p.status.toLowerCase(), uniqueId: `${p.employee_name}-EOR` });
        });
    });

    (contractorInvoices.data || contractorInvoices).forEach((inv: any) => {
        const date = new Date(inv.paid_at || inv.created_at);
        const cycleId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const cycleLabel = date.toLocaleString('default', { month: 'long', year: 'numeric' });

        if (!cyclesMap.has(cycleId)) {
            cyclesMap.set(cycleId, { cycleId, cycleLabel, totalCost: 0, employeeCount: 0, employees: [] });
        }
        const cycle = cyclesMap.get(cycleId)!;
        cycle.totalCost += parseFloat(inv.total);
        cycle.employeeCount += 1;
        cycle.employees.push({ id: inv.id, name: inv.contract.name, type: 'Contractor', country: inv.contract.client.legal_entity.country, net: parseFloat(inv.total), status: inv.status.toLowerCase(), uniqueId: `${inv.contract.name}-Contractor` });
    });

    return Array.from(cyclesMap.values()).sort((a, b) => b.cycleId.localeCompare(a.cycleId));
};

// --- React Component ---
const DeelPayrollApp: React.FC = () => {
    const [apiKey, setApiKey] = useState<string>('');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
    const [selectedType, setSelectedType] = useState<EmployeeType | 'All'>('All');
    const [currentCycleIndex, setCurrentCycleIndex] = useState(0);

    const handleFetchData = async () => {
        if (!apiKey) { setError('Please enter your Deel API Key.'); return; }
        setLoading(true); setError('');
        try {
          const cycles = await fetchAllPayrollData(apiKey);
          if (cycles.length === 0) {
            setError('No payroll data found for the recent period.'); setPayrollData(null);
          } else {
            setPayrollData({ cycles }); setIsAuthenticated(true); setCurrentCycleIndex(0);
          }
        } catch (err: any) {
          setError(err.message || 'An unknown error occurred.'); setIsAuthenticated(false);
        } finally { setLoading(false); }
    };

    const filteredCycles = useMemo(() => {
        if (!payrollData) return null;
        return payrollData.cycles.map(cycle => {
            if (selectedType === 'All') return cycle;
            const filteredEmployees = cycle.employees.filter(e => e.type === selectedType);
            return { ...cycle, employees: filteredEmployees, employeeCount: filteredEmployees.length, totalCost: filteredEmployees.reduce((sum, e) => sum + e.net, 0) };
        });
    }, [payrollData, selectedType]);

    const currentCycle = filteredCycles ? filteredCycles[currentCycleIndex] : null;
    const previousCycle = filteredCycles && currentCycleIndex + 1 < filteredCycles.length ? filteredCycles[currentCycleIndex + 1] : null;

    const calculateDifference = (current: number, previous: number | undefined): DifferenceCalculation => {
        if (previous === undefined || previous === 0) return { diff: current, percentChange: current > 0 ? '100.00' : '0.00' };
        const diff = current - previous;
        const percentChange = ((diff / previous) * 100).toFixed(2);
        return { diff, percentChange };
    };

    const totalCostDiff = currentCycle ? calculateDifference(currentCycle.totalCost, previousCycle?.totalCost) : null;
    const employeeCountDiff = currentCycle ? calculateDifference(currentCycle.employeeCount, previousCycle?.employeeCount) : null;
    const formatCurrency = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const renderAuthScreen = () => (
      <div className="w-full max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Connect to Deel</h2>
        <p className="text-center text-gray-500 mb-6">Enter API key for payroll comparison.</p>
        <div className="space-y-4">
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter your Deel API Key" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          <button onClick={handleFetchData} disabled={loading} className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center disabled:bg-blue-300">
            {loading ? <><Loader2 className="animate-spin mr-2" size={20} /><span>Connecting...</span></> : <span>Connect & View Payroll</span>}
          </button>
        </div>
        {error && <div className="mt-4 text-center text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-center justify-center"><AlertCircle size={16} className="mr-2" /><span>{error}</span></div>}
        <p className="text-xs text-gray-400 mt-4 text-center">API key is not stored and used for this session only.</p>
      </div>
    );
    
    const renderDashboard = () => {
        if (!currentCycle) return <div className="text-center text-gray-500 p-8 bg-white rounded-lg shadow-md">No data available for the selected filters. Please try another combination.</div>;

        return (
          <div className="w-full">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Payroll Comparison</h1>
                    <div className="flex items-center space-x-2 mt-2">
                        <select value={currentCycleIndex} onChange={e => setCurrentCycleIndex(Number(e.target.value))} className="p-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-600 font-semibold">
                            {filteredCycles?.map((c, index) => <option key={c.cycleId} value={index}>{c.cycleLabel}</option>)}
                        </select>
                        <span className="text-gray-500">vs {previousCycle?.cycleLabel || 'N/A'}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                    <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as EmployeeType | 'All')} className="p-2 rounded-lg border bg-white hover:bg-gray-50 font-semibold">
                        <option value="All">All Workers</option><option value="EOR">EOR Employees</option><option value="Contractor">Contractors</option>
                    </select>
                    <button onClick={handleFetchData} disabled={loading} className="p-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                    </button>
                </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard title="Total Payroll Cost" value={`$${formatCurrency(currentCycle.totalCost)}`} diff={totalCostDiff} />
                <StatCard title="Workers Paid" value={currentCycle.employeeCount.toString()} diff={employeeCountDiff} isInt={true} />
                <StatCard title="Previous Cycle Cost" value={previousCycle ? `$${formatCurrency(previousCycle.totalCost)}` : 'N/A'} />
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6"><h3 className="text-xl font-semibold text-gray-800">Payment Breakdown</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500"><thead className="bg-gray-50 text-xs text-gray-700 uppercase"><tr>
                        <th className="px-6 py-3">Worker Name</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Country</th>
                        <th className="px-6 py-3 text-right">Net Payment</th><th className="px-6 py-3 text-right">Previous Net</th>
                        <th className="px-6 py-3 text-right">Change</th><th className="px-6 py-3 text-center">Status</th>
                    </tr></thead><tbody>
                        {currentCycle.employees.map(emp => {
                            const prevEmp = previousCycle?.employees.find(p => p.uniqueId === emp.uniqueId);
                            const change = emp.net - (prevEmp?.net ?? 0);
                            const changeStr = !prevEmp ? <span className="text-green-600 font-semibold">New</span> : change !== 0 ? <span className={`font-semibold ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>{change > 0 ? '+' : ''}${formatCurrency(change)}</span> : <span className="text-gray-500">$0.00</span>;
                            const typeClassName = `px-2 py-1 text-xs rounded-full font-semibold ${emp.type === 'EOR' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`;

                            return (
                            <tr key={emp.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{emp.name}</td>
                                <td className="px-6 py-4"><span className={typeClassName}>{emp.type}</span></td>
                                <td className="px-6 py-4">{emp.country}</td>
                                <td className="px-6 py-4 text-right font-semibold text-gray-800">${formatCurrency(emp.net)}</td>
                                <td className="px-6 py-4 text-right">{prevEmp ? `$${formatCurrency(prevEmp.net)}` : '-'}</td>
                                <td className="px-6 py-4 text-right">{changeStr}</td>
                                <td className="px-6 py-4 text-center"><span className="capitalize px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{emp.status.replace('_', ' ')}</span></td>
                            </tr>);
                        })}
                    </tbody></table>
                </div>
            </div>
          </div>
        );
    };

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                {isAuthenticated ? renderDashboard() : renderAuthScreen()}
            </div>
        </div>
    );
};

interface StatCardProps {
    title: string;
    value: string;
    diff?: DifferenceCalculation | null;
    isInt?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, diff, isInt }) => {
    const diffString = useMemo(() => {
        if (!diff || diff.diff === 0) return null;
        const prefix = diff.diff > 0 ? '+' : '';
        const valueStr = isInt ? diff.diff.toFixed(0) : `$${diff.diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `${prefix}${valueStr} (${diff.percentChange}%) vs last cycle`;
    }, [diff, isInt]);

    const trendIcon = diff && diff.diff !== 0 ? (diff.diff > 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />) : null;
    const diffClassName = `flex items-center mt-2 text-sm ${!diff || diff.diff === 0 ? '' : diff.diff > 0 ? 'text-green-600' : 'text-red-600'}`;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center text-gray-500 mb-2">
                {title.includes("Cost") ? <DollarSign size={16} className="mr-2" /> : <Users size={16} className="mr-2" />}
                <span>{title}</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
            {diffString && (
                <div className={diffClassName}>
                    {trendIcon}
                    <span>{diffString}</span>
                </div>
            )}
        </div>
    );
};

export default DeelPayrollApp;

