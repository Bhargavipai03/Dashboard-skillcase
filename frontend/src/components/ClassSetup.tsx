import React, { useState } from 'react';
import { getPdfPageCount } from '../utils/pdfParser';

interface ClassSetupProps {
    classId: string;
    language: string;
    level: string;
    batch: string;
    onSetupComplete: (teacherName: string, studentsList: string[], b1Name: string, b1Pages: number, b2Name: string, b2Pages: number) => void;
}

export const ClassSetup: React.FC<ClassSetupProps> = ({ language, level, batch, onSetupComplete }) => {
    const [teacher, setTeacher] = useState('');
    const [studentsText, setStudentsText] = useState('');

    // Books
    const [book1Name, setBook1Name] = useState('');
    const [book1Pages, setBook1Pages] = useState<number>(0);
    const [book2Name, setBook2Name] = useState('');
    const [book2Pages, setBook2Pages] = useState<number>(0);
    const [isScanningPdf, setIsScanningPdf] = useState(false);

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, isBook1: boolean) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsScanningPdf(true);
        try {
            const pages = await getPdfPageCount(file);
            if (pages > 0) {
                if (isBook1) {
                    setBook1Pages(pages);
                    if (!book1Name) setBook1Name(file.name.replace('.pdf', '').substring(0, 30));
                } else {
                    setBook2Pages(pages);
                    if (!book2Name) setBook2Name(file.name.replace('.pdf', '').substring(0, 30));
                }
            }
        } catch (err) {
            console.error('Failed to parse PDF', err);
            alert('Failed to detect pages from PDF. Is it a valid PDF?');
        }
        setIsScanningPdf(false);
        e.target.value = '';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacher.trim()) {
            alert("Please enter the instructor's name.");
            return;
        }
        if (!studentsText.trim()) {
            alert("Please add at least one student.");
            return;
        }
        const studentList = studentsText.split(',').map(s => s.trim()).filter(Boolean);
        if (studentList.length === 0) {
            alert("Please provide a valid comma-separated list of students.");
            return;
        }

        onSetupComplete(teacher, studentList, book1Name, book1Pages, book2Name, book2Pages);
    };

    return (
        <div style={{
            maxWidth: '600px',
            margin: '4rem auto',
            background: 'var(--surface)',
            padding: '3rem',
            borderRadius: '1rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            border: '1px solid var(--border)'
        }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--primary)', textAlign: 'center' }}>
                Class Setup Required
            </h2>
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2rem' }}>
                You are accessing <strong>{language} {level} (Batch {batch})</strong> for the first time.
                Please configure the following fixed details. These cannot be easily modified later.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Instructor Name</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. John Doe"
                        value={teacher}
                        onChange={e => setTeacher(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Fixed Students List (Comma Separated)</label>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        Enter the exact registered students. Only these students will be scored.
                    </p>
                    <textarea
                        className="input-field"
                        rows={4}
                        placeholder="Alice, Bob, Charlie..."
                        value={studentsText}
                        onChange={e => setStudentsText(e.target.value)}
                    />
                </div>

                <div className="form-group" style={{ border: '1px solid var(--border)', padding: '1rem', borderRadius: '0.5rem', background: 'var(--background)' }}>
                    <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '1rem', color: 'var(--primary)' }}>Syllabus Tracking (Optional)</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Book 1 Name</label>
                            <input type="text" className="input-field" placeholder="e.g. Netzwerk A1" value={book1Name} onChange={e => setBook1Name(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Total Pages</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="number" className="input-field" placeholder="150" value={book1Pages || ''} onChange={e => setBook1Pages(parseInt(e.target.value) || 0)} style={{ flex: 1 }} />
                                <div style={{ position: 'relative' }}>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem', whiteSpace: 'nowrap' }} disabled={isScanningPdf}>
                                        {isScanningPdf ? '...' : 'Upload PDF'}
                                    </button>
                                    <input type="file" accept="application/pdf" onChange={e => handlePdfUpload(e, true)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Book 2 Name</label>
                            <input type="text" className="input-field" placeholder="e.g. Studio d A1" value={book2Name} onChange={e => setBook2Name(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Total Pages</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="number" className="input-field" placeholder="200" value={book2Pages || ''} onChange={e => setBook2Pages(parseInt(e.target.value) || 0)} style={{ flex: 1 }} />
                                <div style={{ position: 'relative' }}>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem', whiteSpace: 'nowrap' }} disabled={isScanningPdf}>
                                        {isScanningPdf ? '...' : 'Upload PDF'}
                                    </button>
                                    <input type="file" accept="application/pdf" onChange={e => handlePdfUpload(e, false)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>
                        Lock In Class Details
                    </button>
                </div>
            </form>
        </div>
    );
};
