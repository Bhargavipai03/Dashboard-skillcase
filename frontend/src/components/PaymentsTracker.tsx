import React, { useState, useEffect } from 'react';
import { ClassData } from '../types';
import { Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PaymentsTrackerProps {
    classes: ClassData[];
    onDeleteClass?: (classId: string) => void;
}

export const PaymentsTracker: React.FC<PaymentsTrackerProps> = ({ classes, onDeleteClass }) => {
    const [search, setSearch] = useState('');
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState(monthOrder[new Date().getMonth()]);

    // Key: "classId_studentName_year-month_colKey" -> string
    const [payments, setPayments] = useState<Record<string, string>>({});

    useEffect(() => {
        const data = localStorage.getItem('health_analyzer_custom_payments_v2');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                let migratedAny = false;
                const currentYM = `${new Date().getFullYear()}-${monthOrder[new Date().getMonth()]}`;
                const newPayments: Record<string, string> = {};

                Object.keys(parsed).forEach(key => {
                    if (/_\d{4}-[A-Z][a-z]{2}_/.test(key)) {
                        newPayments[key] = parsed[key];
                    } else {
                        // Legacy key migration
                        const cols = ['last_month_payment', 'booked_payment', 'booked_amount', 'paid', 'remaining', 'pending_amount', 'remarks', 'paid_date', 'next_month_date'];
                        const matchedCol = cols.find(c => key.endsWith(`_${c}`));
                        if (matchedCol) {
                            const prefix = key.slice(0, -(matchedCol.length + 1));
                            newPayments[`${prefix}_${currentYM}_${matchedCol}`] = parsed[key];
                            migratedAny = true;
                        } else {
                            newPayments[key] = parsed[key];
                        }
                    }
                });

                if (migratedAny) {
                    localStorage.setItem('health_analyzer_custom_payments_v2', JSON.stringify(newPayments));
                }
                setPayments(newPayments);
            } catch (e) { }
        }
    }, []);

    const savePayments = (newPayments: Record<string, string>) => {
        setPayments(newPayments);
        localStorage.setItem('health_analyzer_custom_payments_v2', JSON.stringify(newPayments));
    };

    const parseNum = (val: string | undefined) => {
        if (!val) return 0;
        const num = Number(val.replace(/[^0-9.-]+/g, ''));
        return isNaN(num) ? 0 : num;
    };

    const handleCellChange = (classId: string, studentName: string, colKey: string, value: string) => {
        const prefix = `${classId}_${studentName}_${selectedYear}-${selectedMonth}`;
        const key = `${prefix}_${colKey}`;
        const newPayments = { ...payments };
        if (value.trim() === '') delete newPayments[key];
        else newPayments[key] = value;

        // Auto-Calc Trigger for Pending Amount
        if (colKey === 'paid' || colKey === 'booked_amount') {
            const bookedStr = colKey === 'booked_amount' ? value : (newPayments[`${prefix}_booked_amount`] || '');
            const paidStr = colKey === 'paid' ? value : (newPayments[`${prefix}_paid`] || '');

            const bookedNum = parseNum(bookedStr);
            const paidNum = parseNum(paidStr);

            if (bookedStr || paidStr) {
                newPayments[`${prefix}_pending_amount`] = Math.max(0, bookedNum - paidNum).toLocaleString();
            } else {
                delete newPayments[`${prefix}_pending_amount`];
            }
        }

        savePayments(newPayments);
    };

    const allStudents = classes.flatMap(c =>
        (c.fixedStudents || []).map(studentName => ({
            name: studentName,
            className: c.name,
            classId: c.id
        }))
    );

    const filtered = allStudents.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.className.toLowerCase().includes(search.toLowerCase())
    );

    const studentsByBatch = filtered.reduce((acc, s) => {
        if (!acc[s.className]) acc[s.className] = [];
        acc[s.className].push(s);
        return acc;
    }, {} as Record<string, typeof allStudents>);

    const columns = [
        { key: 'last_month_payment', label: 'Last Month Payment', width: '130px' },
        { key: 'booked_payment', label: 'Booked Payment', width: '130px' },
        { key: 'booked_amount', label: 'Booked amount', width: '130px' },
        { key: 'paid', label: 'Paid', width: '100px' },
        { key: 'remaining', label: 'Remaining', width: '100px' },
        { key: 'pending_amount', label: 'Pending amount to be paid', width: '180px' },
        { key: 'remarks', label: 'REMARKS', width: '150px' },
        { key: 'paid_date', label: 'Paid Date', width: '120px' },
        { key: 'next_month_date', label: 'Next Month date', width: '130px' }
    ];

    const currentPrefix = (classId: string, name: string) => `${classId}_${name}_${selectedYear}-${selectedMonth}`;

    const totalBooked = filtered.reduce((sum, s) => sum + parseNum(payments[`${currentPrefix(s.classId, s.name)}_booked_amount`]), 0);
    const totalPaid = filtered.reduce((sum, s) => sum + parseNum(payments[`${currentPrefix(s.classId, s.name)}_paid`]), 0);
    const totalPending = filtered.reduce((sum, s) => sum + parseNum(payments[`${currentPrefix(s.classId, s.name)}_pending_amount`]), 0);

    // Dynamic Chart Data: Monthly Collections across the selected Year
    const monthlyData = monthOrder.map(month => {
        let collected = 0;
        filtered.forEach(s => {
            collected += parseNum(payments[`${s.classId}_${s.name}_${selectedYear}-${month}_paid`]);
        });
        return { month, collected };
    });

    // Dynamic Chart Data: Collections by Batch for selected Year and Month
    const batchData = Object.entries(studentsByBatch).map(([batchName, students]) => {
        const collected = students.reduce((sum, s) => sum + parseNum(payments[`${currentPrefix(s.classId, s.name)}_paid`]), 0);
        const pending = students.reduce((sum, s) => sum + parseNum(payments[`${currentPrefix(s.classId, s.name)}_pending_amount`]), 0);
        return { batchName: batchName.replace(' ', '\n'), collected, pending };
    });

    return (
        <div className="animate-fade-in card" style={{ padding: '0' }}>
            <div style={{ padding: '2rem 2rem 0 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ margin: 0, color: 'var(--primary)' }}>Master Payments Tracker</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'white', minWidth: '100px', fontWeight: 600 }}
                        >
                            {monthOrder.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'white', minWidth: '100px', fontWeight: 600 }}
                        >
                            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                        </select>
                        <input
                            type="text"
                            placeholder="Search by name or batch..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', minWidth: '250px' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
                    <div className="card col" style={{ background: 'var(--primary)', color: 'white', flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Total Booked Amount</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>
                            ₹{totalBooked.toLocaleString()}
                        </span>
                    </div>
                    <div className="card col" style={{ background: 'var(--success)', color: 'white', flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Total Paid Collected</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>
                            ₹{totalPaid.toLocaleString()}
                        </span>
                    </div>
                    <div className="card col" style={{ background: 'var(--card-bg)', flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Total Pending Amount</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger)' }}>
                            ₹{totalPending.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Autocreated Charts for Months and Batches */}
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 400px' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--success)', fontSize: '1rem' }}>Collections By Month (Paid Date)</h3>
                        {monthlyData.length === 0 ? (
                            <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: '0.5rem', color: 'var(--text-muted)' }}>
                                Enter a Paid Date to see monthly chart
                            </div>
                        ) : (
                            <div style={{ height: '250px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Collected']} />
                                        <Bar dataKey="collected" fill="var(--success)" radius={[4, 4, 0, 0]} name="Collections (₹)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    <div style={{ flex: '1 1 400px' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', fontSize: '1rem' }}>Collections By Batch</h3>
                        {batchData.length === 0 ? (
                            <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: '0.5rem', color: 'var(--text-muted)' }}>
                                Add classes to see batch collection chart
                            </div>
                        ) : (
                            <div style={{ height: '250px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={batchData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="batchName" angle={-25} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(val: number) => [`₹${val.toLocaleString()}`]} />
                                        <Legend verticalAlign="top" height={36} iconType="circle" />
                                        <Bar dataKey="collected" fill="var(--success)" radius={[4, 4, 0, 0]} name="Collected" />
                                        <Bar dataKey="pending" fill="var(--danger)" radius={[4, 4, 0, 0]} name="Pending" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)', background: '#fff' }}>
                <table style={{ minWidth: '1500px', width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                            <th style={{ minWidth: '150px', padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left', position: 'sticky', left: 0, background: '#f8f9fa', zIndex: 1 }}>Batch</th>
                            <th style={{ minWidth: '200px', padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left', position: 'sticky', left: '150px', background: '#f8f9fa', zIndex: 1 }}>Names</th>
                            {columns.map(col => (
                                <th key={col.key} style={{ minWidth: col.width, padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.keys(studentsByBatch).length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 2} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    No students found.
                                </td>
                            </tr>
                        ) : (
                            Object.entries(studentsByBatch).map(([batchName, students]) => {
                                const classId = students[0]?.classId;
                                return (
                                    <React.Fragment key={batchName}>
                                        {/* Yellow Separator Row just like the Excel Sheet */}
                                        <tr>
                                            <td colSpan={columns.length + 2} style={{ background: '#ffff00', padding: '4px 12px', border: '1px solid #ddd', fontWeight: 800, color: '#333' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>Class Group: {batchName}</span>
                                                    {onDeleteClass && (
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(`Are you sure you want to completely delete the entire class "${batchName}" and all of its associated histories, payments, and student directory data?`)) {
                                                                    onDeleteClass(classId);
                                                                }
                                                            }}
                                                            style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}
                                                        >
                                                            <Trash2 size={14} /> Delete Tracking Data for {batchName}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {students.map((s, i) => (
                                            <tr key={`${s.classId}-${s.name}-${i}`} style={{ background: '#fff' }}>
                                                <td style={{ padding: '0.5rem', border: '1px solid #ddd', fontWeight: 600, color: '#333', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{s.className}</td>
                                                <td style={{ padding: '0.5rem', border: '1px solid #ddd', position: 'sticky', left: '150px', background: '#fff', zIndex: 1 }}>{s.name}</td>

                                                {columns.map(col => {
                                                    const val = payments[`${s.classId}_${s.name}_${selectedYear}-${selectedMonth}_${col.key}`] || '';
                                                    return (
                                                        <td key={col.key} style={{ padding: '0', border: '1px solid #ddd' }}>
                                                            <input
                                                                type="text"
                                                                value={val}
                                                                onChange={(e) => handleCellChange(s.classId, s.name, col.key, e.target.value)}
                                                                style={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    minHeight: '35px',
                                                                    padding: '0.5rem',
                                                                    border: 'none',
                                                                    outline: 'none',
                                                                    background: 'transparent',
                                                                    boxSizing: 'border-box',
                                                                    color: col.key === 'pending_amount' ? 'var(--danger)' : col.key === 'paid' ? 'var(--success)' : '#333'
                                                                }}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div >
    );
};
