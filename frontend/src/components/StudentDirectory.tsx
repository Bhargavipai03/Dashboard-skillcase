import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Plus, Trash2, Search, Save, Lock, Unlock } from 'lucide-react';
import { ClassData } from '../types';

interface StudentDirectoryProps {
    classes: ClassData[];
    onDeleteClass?: (classId: string) => void;
}

const DEFAULT_HEADERS = [
    "Candidate ID", "Current Batch", "Full Name", "Status", "Confirmed Fees",
    "Fees Paid", "Balance Due", "First Entry", "Timestamp", "Mobile Number:",
    "WhatsApp Number (if different):", "Email ID:", "Date of Birth:", "Gender:",
    "Nationality:", "Current Location (City):", "Educational Qualification:",
    "Year of Passing:", "Do you work the same shift every day or different shifts on different days/weeks?",
    "First shift timing", "Second shift timing", "Third shift timing", "Daily shift timing",
    "Passport (Front & Back Page):", "Degree Certificate (Final year or consolidated):",
    "Updated Resume (PDF format):", "I agree with terms and condition."
];

// Only these 3 columns are shown in the table — all other data is still stored & exported
const VISIBLE_HEADERS = ["Candidate ID", "Current Batch", "Full Name"];

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({ classes: _classes, onDeleteClass: _onDeleteClass }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [headers, setHeaders] = useState<string[]>(DEFAULT_HEADERS);
    const [data, setData] = useState<Record<string, string>[]>([]);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLocked, setIsLocked] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('health_analyzer_enrollment_data');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.headers && parsed.data) {
                    setHeaders(parsed.headers);
                    setData(parsed.data);
                }
            } catch (e) {
                console.error("Failed to parse directory memory", e);
            }
        }
    }, []);

    const saveData = (newHeaders: string[], newData: Record<string, string>[]) => {
        setIsSaving(true);
        setHeaders(newHeaders);
        setData(newData);
        localStorage.setItem('health_analyzer_enrollment_data', JSON.stringify({ headers: newHeaders, data: newData }));
        setTimeout(() => setIsSaving(false), 500);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (rawData.length > 0) {
                    const extractedHeaders = (rawData[0] || []).map((h: any) => String(h || '').trim());
                    const validHeaders = extractedHeaders.filter((h: string) => h.length > 0);

                    const extractedData = rawData.slice(1).map((row, i) => {
                        const obj: Record<string, string> = { _id: `row_${Date.now()}_${i}` };
                        validHeaders.forEach((h: string) => {
                            const trueIdx = extractedHeaders.indexOf(h);
                            obj[h] = (row[trueIdx] !== undefined && row[trueIdx] !== null) ? String(row[trueIdx]) : '';
                        });
                        return obj;
                    }).filter(row => Object.keys(row).some(k => k !== '_id' && row[k].trim() !== ''));

                    saveData(validHeaders, extractedData);
                    alert("Enrollment sheet successfully loaded!");
                }
            } catch (err) {
                console.error(err);
                alert("Failed to parse this file. Make sure it's a valid CSV or XLSX file.");
            }
        };
        reader.readAsBinaryString(file);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleCellChange = (rowId: string, colName: string, val: string) => {
        const newData = data.map(row => {
            if (row._id === rowId) {
                return { ...row, [colName]: val };
            }
            return row;
        });
        saveData(headers, newData);
    };

    const addRow = () => {
        const newRow: Record<string, string> = { _id: `row_${Date.now()}` };
        headers.forEach(h => newRow[h] = '');
        saveData(headers, [newRow, ...data]);
    };

    const removeRow = (id: string, name: string) => {
        if (!window.confirm(`Delete the record for "${name || 'this student'}"?`)) return;
        saveData(headers, data.filter(d => d._id !== id));
    };

    const exportToExcel = () => {
        // Export ONLY the 3 visible columns — private data stays protected
        const exportData = data.map(row => {
            const cleanRow: any = {};
            VISIBLE_HEADERS.forEach(h => {
                cleanRow[h] = row[h] || '';
            });
            return cleanRow;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Enrollments");
        XLSX.writeFile(wb, "Student_Enrollment_Directory.xlsx");
    };

    // Search filtering across visible + all columns
    const filteredData = data.filter(row => {
        if (!search) return true;
        const q = search.toLowerCase();
        return VISIBLE_HEADERS.some(h => (row[h] || '').toLowerCase().includes(q));
    });

    return (
        <div className="animate-fade-in card" style={{ padding: 0 }}>
            <div style={{ padding: '2rem 2rem 0 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2 style={{ margin: 0, color: 'var(--primary)' }}>Master Enrollment Directory</h2>
                        {isSaving && <span style={{ color: 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Save size={14} /> Saved</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search by name, ID or batch..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ padding: '0.5rem 0.5rem 0.5rem 2.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)', minWidth: '250px' }}
                            />
                        </div>

                        <input type="file" ref={fileRef} accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ display: 'none' }} />

                        {!isLocked && (
                            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                                <UploadCloud size={18} /> Import XLSX
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={exportToExcel}>
                            Export Sheet
                        </button>
                        {!isLocked && (
                            <button className="btn btn-primary" onClick={addRow}>
                                <Plus size={18} /> New Entry
                            </button>
                        )}
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
                            style={{ border: isLocked ? '1px solid var(--border)' : 'none', background: isLocked ? 'white' : 'var(--danger)', color: isLocked ? '#333' : 'white' }}
                            title={isLocked ? "Unlock to edit directory" : "Lock to prevent accidental edits"}
                        >
                            {isLocked ? <><Lock size={16} /> Locked View</> : <><Unlock size={16} /> Editing Unlocked</>}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <div className="card" style={{ background: 'var(--primary)', color: 'white', padding: '1rem 1.5rem', flex: '0 0 auto' }}>
                        <h4 style={{ margin: '0 0 0.25rem 0', opacity: 0.9, fontSize: '0.85rem' }}>Total Enrolled</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{filteredData.length}</span>
                    </div>
                    <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1rem 1.5rem', flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔒 Private Info Protected</h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Only <strong>Enrollment ID, Batch & Name</strong> are visible and exportable.
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)', paddingBottom: '2rem' }}>
                <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', opacity: isLocked ? 0.9 : 1 }}>
                    <thead>
                        <tr style={{ background: 'var(--surface)' }}>
                            {!isLocked && <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '0.75rem', minWidth: '40px' }}></th>}
                            {VISIBLE_HEADERS.map((h, i) => (
                                <th key={i} style={{ padding: '0.75rem', border: '1px solid var(--border)', textAlign: 'left', minWidth: '180px', whiteSpace: 'nowrap' }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={VISIBLE_HEADERS.length + 1} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    No enrollment data found. Click <strong>Import XLSX</strong> to upload your master sheet!
                                </td>
                            </tr>
                        ) : (
                            filteredData.map(row => (
                                <tr key={row._id} className="table-row-hover">
                                    {!isLocked && (
                                        <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'white', borderRight: '1px solid var(--border)', padding: '0.25rem', textAlign: 'center' }}>
                                            <button
                                                onClick={() => removeRow(row._id, row["Full Name"] || row["Candidate ID"])}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}
                                                title="Delete Enrollment Row"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    )}
                                    {VISIBLE_HEADERS.map((h, i) => (
                                        <td key={i} style={{ padding: 0, border: '1px solid var(--border)' }}>
                                            <input
                                                type="text"
                                                value={row[h] || ''}
                                                onChange={e => handleCellChange(row._id, h, e.target.value)}
                                                placeholder={`Enter ${h}`}
                                                readOnly={isLocked}
                                                style={{
                                                    width: '100%',
                                                    border: 'none',
                                                    padding: '0.75rem',
                                                    background: 'transparent',
                                                    outline: 'none',
                                                    fontSize: '0.85rem',
                                                    cursor: isLocked ? 'default' : 'text',
                                                    minWidth: '160px'
                                                }}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
