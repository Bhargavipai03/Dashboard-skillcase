import React, { useState, useEffect } from 'react';
import { ClassData, ManualAttendanceRecord } from '../types';
import { getManualAttendance, updateSingleManualAttendance, getReportsByClass } from '../store/localStorage';
import { Calendar, Lock, Unlock } from 'lucide-react';

interface Props {
    activeClass: ClassData;
}

export const AttendanceRecordBook: React.FC<Props> = ({ activeClass }) => {
    // Merge dates from manual attendance + dates from uploaded transcript reports to form columns
    const [allDates, setAllDates] = useState<string[]>([]);
    const [attendanceData, setAttendanceData] = useState<ManualAttendanceRecord[]>([]);
    const [isLocked, setIsLocked] = useState(true);

    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState(monthOrder[new Date().getMonth()]);

    useEffect(() => {
        loadData();
    }, [activeClass.id]);

    const loadData = () => {
        const manual = getManualAttendance().filter(a => a.classId === activeClass.id);
        const autoReports = getReportsByClass(activeClass.id);

        // Find all unique dates
        const dateSet = new Set<string>();
        manual.forEach(m => dateSet.add(m.date));
        autoReports.forEach(r => dateSet.add(r.date));

        let sortedDates = Array.from(dateSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        setAllDates(sortedDates);
        setAttendanceData(manual);
    };

    // Derived states
    const displayedDates = allDates.filter(d => {
        if (!d) return false;
        const parts = d.split('-');
        if (parts.length >= 2) {
            const y = parts[0];
            const m = parseInt(parts[1], 10) - 1;
            return y === selectedYear && m === monthOrder.indexOf(selectedMonth);
        }
        return false;
    });

    const addDateColumn = () => {
        if (isLocked) {
            alert('Please unlock editing first to add a new date.');
            return;
        }
        // Force pre-fill with the currently selected year/month so the date automatically lands in their view
        const targetMonth = (monthOrder.indexOf(selectedMonth) + 1).toString().padStart(2, '0');
        const defaultDate = `${selectedYear}-${targetMonth}-01`;

        const today = prompt("Enter new date (YYYY-MM-DD)", defaultDate);
        if (!today) return;
        if (allDates.includes(today)) {
            alert('Date already exists');
            return;
        }
        setAllDates(prev => [today, ...prev].sort((a, b) => new Date(b).getTime() - new Date(a).getTime()));
        // Auto mark empty
        updateSingleManualAttendance(activeClass.id, today, {});
        loadData();
    };

    const toggleAttendance = (date: string, student: string) => {
        if (isLocked) return;

        const dateRecord = attendanceData.find(a => a.date === date);
        const currentRec = dateRecord?.records || {};
        const currentP = currentRec[student];

        // Cycle: none -> P -> A -> none
        let newStatus: 'P' | 'A' | undefined = 'P';
        if (currentP === 'P') newStatus = 'A';
        else if (currentP === 'A') newStatus = undefined;

        const newRecords = { ...currentRec };
        if (newStatus) {
            newRecords[student] = newStatus;
        } else {
            delete newRecords[student];
        }

        updateSingleManualAttendance(activeClass.id, date, newRecords);
        loadData();
    };

    const getStatus = (date: string, student: string) => {
        const manualStatus = attendanceData.find(a => a.date === date)?.records?.[student];
        if (manualStatus) return manualStatus;

        // Fallback to auto-reports if transcript/excel uploaded
        const autoRep = getReportsByClass(activeClass.id).find(r => r.date === date);
        if (autoRep) {
            const studentInAuto = autoRep.students.find(s => s.name.toLowerCase() === student.toLowerCase());
            if (studentInAuto && studentInAuto.attendanceMinutes > 5) {
                return 'Auto-P'; // Present by Excel/Transcript
            } else if (studentInAuto) {
                return 'Auto-A';
            }
        }
        return '-';
    };

    if (!activeClass.fixedStudents || activeClass.fixedStudents.length === 0) {
        return <p>No fixed students configured.</p>;
    }

    return (
        <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar /> Attendance Record Book
                </h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'white', minWidth: '120px', fontWeight: 600 }}
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

                    <button
                        className={`btn ${isLocked ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => {
                            if (isLocked) {
                                const pin = prompt("Enter PIN to unlock editing:");
                                if (pin === "1234") {
                                    setIsLocked(false);
                                } else if (pin !== null) {
                                    alert("Incorrect PIN");
                                }
                            } else {
                                setIsLocked(true);
                            }
                        }}
                        style={{ border: isLocked ? '1px solid var(--border)' : 'none', background: isLocked ? 'white' : 'var(--danger)', color: isLocked ? '#333' : 'white', marginLeft: '1rem' }}
                        title={isLocked ? "Unlock to edit attendance" : "Lock to prevent accidental edits"}
                    >
                        {isLocked ? <><Lock size={16} /> Locked View</> : <><Unlock size={16} /> Editing Unlocked</>}
                    </button>
                    {!isLocked && (
                        <button className="btn btn-primary" onClick={addDateColumn}>+ Add Date Column</button>
                    )}
                </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                <table style={{ minWidth: '100%', opacity: isLocked ? 0.9 : 1 }}>
                    <thead>
                        <tr>
                            <th style={{ position: 'sticky', left: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', minWidth: '200px' }}>
                                Student
                            </th>
                            {displayedDates.map(d => (
                                <th key={d} style={{ textAlign: 'center', minWidth: '80px', padding: '1rem', whiteSpace: 'nowrap' }}>
                                    {d}
                                </th>
                            ))}
                            {displayedDates.length === 0 && <th style={{ color: 'var(--text-muted)', fontWeight: 400 }}>No dates in {selectedMonth} {selectedYear}. Unlock to add dates.</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {activeClass.fixedStudents.map((student, i) => (
                            <tr key={i}>
                                <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', fontWeight: 600 }}>
                                    {student}
                                </td>
                                {displayedDates.map(date => {
                                    const st = getStatus(date, student);
                                    let bg = 'transparent';
                                    let col = 'var(--text-muted)';

                                    if (st === 'P') { bg = 'var(--success)'; col = 'white'; }
                                    if (st === 'A') { bg = 'var(--danger)'; col = 'white'; }
                                    if (st === 'Auto-P') { bg = 'rgba(34, 197, 94, 0.2)'; col = 'var(--success)'; }
                                    if (st === 'Auto-A') { bg = 'rgba(239, 68, 68, 0.2)'; col = 'var(--danger)'; }

                                    return (
                                        <td
                                            key={date}
                                            style={{ textAlign: 'center', cursor: isLocked ? 'default' : 'pointer', verticalAlign: 'middle', userSelect: 'none' }}
                                            onClick={() => toggleAttendance(date, student)}
                                            title={isLocked ? "Unlock to edit" : "Click to toggle Present/Absent/Clear"}
                                        >
                                            <div style={{
                                                width: '32px', height: '32px',
                                                margin: '0 auto',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                borderRadius: '4px',
                                                background: bg, color: col,
                                                fontWeight: 'bold', fontSize: '0.85rem',
                                                transition: 'all 0.2s ease',
                                                border: (!isLocked && bg === 'transparent') ? '1px dashed var(--border)' : 'none'
                                            }}>
                                                {st === 'Auto-P' ? 'P' : st === 'Auto-A' ? 'A' : st}
                                            </div>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span><strong>P:</strong> Manual Present</span>
                <span><strong>A:</strong> Manual Absent</span>
                <span><strong style={{ color: 'var(--success)' }}>P (light):</strong> Uploaded Present</span>
                <span><strong style={{ color: 'var(--danger)' }}>A (light):</strong> Uploaded Absent</span>
                {!isLocked && <span>Click boxes to cycle statuses.</span>}
                {isLocked && <span><strong><Lock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Read-Only Mode.</strong> Unlock to edit.</span>}
            </div>
        </div>
    );
};
