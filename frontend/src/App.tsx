import React, { useState, useEffect } from 'react';
import { Activity, UploadCloud, Calendar, Download, FileText, FileSpreadsheet, LayoutDashboard, History, Trash2, Check, Brain, Lightbulb, BarChart2, Users, PlusCircle, BookOpen } from 'lucide-react';
import { ClassData, DailyReport, StudentRecord } from './types';
import { getClasses, saveClasses, getReports, getReportsByClass, saveReport, deleteReport, deleteReportsForClass } from './store/localStorage';
import { parseVttContent, analyzeTranscript } from './utils/vttParser';
import { downloadJSON, downloadCSV, downloadExcel } from './utils/exportUtils';
import { getPdfPageCount } from './utils/pdfParser';
import Tesseract from 'tesseract.js';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';

import { TopBar } from './components/TopBar';
import { ClassSetup } from './components/ClassSetup';
import { AttendanceRecordBook } from './components/AttendanceRecordBook';
import { StudentDirectory } from './components/StudentDirectory';
import { PaymentsTracker } from './components/PaymentsTracker';

function App() {
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [activeClassId, setActiveClassId] = useState<string>('');


    const [view, setView] = useState<'dashboard' | 'new_report' | 'history' | 'student_analytics' | 'class_analytics' | 'attendance' | 'global_analytics' | 'directory' | 'payments'>('dashboard');
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
    const [analyticsStartDate, setAnalyticsStartDate] = useState<string>('');
    const [analyticsEndDate, setAnalyticsEndDate] = useState<string>('');
    const [reports, setReports] = useState<DailyReport[]>([]);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [duration, setDuration] = useState<number>(101);
    const [attendanceText, setAttendanceText] = useState('');
    const [teacherName, setTeacherName] = useState('');
    const [fixedStudentsText, setFixedStudentsText] = useState('');
    const [vttData, setVttData] = useState<Record<string, number>>({});
    const [vttFileName, setVttFileName] = useState('');
    const [vttRawText, setVttRawText] = useState('');
    const [currentReport, setCurrentReport] = useState<DailyReport | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [includesTest, setIncludesTest] = useState(false);

    // Wise Integration
    const [showWiseModal, setShowWiseModal] = useState(false);
    const [wiseUserId, setWiseUserId] = useState(localStorage.getItem('wise_user_id') || '');
    const [wiseApiKey, setWiseApiKey] = useState(localStorage.getItem('wise_api_key') || '');
    const [wiseNamespace, setWiseNamespace] = useState(localStorage.getItem('wise_namespace') || '');
    const [wiseSessionId, setWiseSessionId] = useState('');
    const [wiseClassId, setWiseClassId] = useState('');


    const [isWiseLoading, setIsWiseLoading] = useState(false);

    // Books mapping
    const [book1CoveredPagesText, setBook1CoveredPagesText] = useState('');
    const [book2CoveredPagesText, setBook2CoveredPagesText] = useState('');
    const [isScanningBookPdf, setIsScanningBookPdf] = useState(false);
    const [paymentsUnlocked, setPaymentsUnlocked] = useState(false);
    
    // Global App Security
    const [appUnlocked, setAppUnlocked] = useState(
        localStorage.getItem('health_analyzer_unlocked') === 'true'
    );

    const [selectedLanguage, setSelectedLanguage] = useState('German');
    const [selectedLevel, setSelectedLevel] = useState('A1');
    const [selectedBatch, setSelectedBatch] = useState('1');

    const derivedClassId = `${selectedLanguage}-${selectedLevel}-${selectedBatch}`.toLowerCase().replace(/\s+/g, '-');

    useEffect(() => {
        const loadedClasses = getClasses();
        setClasses(loadedClasses);
    }, []);

    useEffect(() => {
        setActiveClassId(derivedClassId);
    }, [derivedClassId]);

    // Block Backspace/Delete from navigating the browser history when not in a text field
    useEffect(() => {
        const blockNavKeys = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const tag = target.tagName.toLowerCase();
            const isEditable = target.isContentEditable;
            if ((e.key === 'Backspace' || e.key === 'Delete') && tag !== 'input' && tag !== 'textarea' && !isEditable) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        // Use capture phase so we intercept before browser processes it
        window.addEventListener('keydown', blockNavKeys, true);
        return () => window.removeEventListener('keydown', blockNavKeys, true);
    }, []);

    // Only reset view/reports when the selected class CHANGES
    useEffect(() => {
        if (activeClassId) {
            setReports(getReportsByClass(activeClassId));
            setCurrentReport(null);
            setView('dashboard');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeClassId]);

    // Separately, load teacher/fixed students from class config (does NOT reset the view)
    useEffect(() => {
        if (activeClassId) {
            const c = classes.find(cls => cls.id === activeClassId);
            if (c) {
                setTeacherName(c.teacherName || '');
                setFixedStudentsText(c.fixedStudents?.join(', ') || '');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeClassId]);

    const activeClass = classes.find(c => c.id === activeClassId);

    useEffect(() => {
        if (activeClass) {
            setWiseClassId(localStorage.getItem(`wise_class_id_${activeClass.id} `) || localStorage.getItem('wise_class_id') || '');
        }
    }, [activeClass]);

    const updateCurrentClass = (updates: Partial<ClassData>) => {
        if (!activeClassId) return;
        const updated = classes.map(c => c.id === activeClassId ? { ...c, ...updates } : c);
        setClasses(updated);
        saveClasses(updated);
    };

    const handleDeleteClass = (idToDelete: string) => {
        // Delete the class
        const updatedClasses = classes.filter(c => c.id !== idToDelete);
        setClasses(updatedClasses);
        saveClasses(updatedClasses);

        // Delete all reports belonging to the class
        deleteReportsForClass(idToDelete);
        const remainingReports = getReportsByClass(activeClassId);
        setReports(remainingReports);

        // Reset active state if it was the currently selected class
        if (activeClassId === idToDelete) {
            setView('dashboard');
        }
    };



    const handleBookPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, isBook1: boolean) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsScanningBookPdf(true);
        try {
            const pages = await getPdfPageCount(file);
            if (pages > 0) {
                if (isBook1) {
                    updateCurrentClass({ book1TotalPages: pages, book1Name: activeClass?.book1Name || file.name.replace('.pdf', '').substring(0, 40) });
                } else {
                    updateCurrentClass({ book2TotalPages: pages, book2Name: activeClass?.book2Name || file.name.replace('.pdf', '').substring(0, 40) });
                }
            } else {
                alert('Could not detect page count from this PDF. Please enter the number manually.');
            }
        } catch {
            alert('Failed to read PDF. Please enter page count manually.');
        }
        setIsScanningBookPdf(false);
        e.target.value = '';
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check if spreadsheet
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const workbook = XLSX.read(bstr, { type: 'binary' });
                    const wsname = workbook.SheetNames[0];
                    const ws = workbook.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                    // Words that indicate a non-student row (first column)
                    const junkNames = /^(name|participant|attendee|student|no\.?|s\.?no\.?|skillcase|zoom|present|host|guest|duration|time|minutes|seconds|total|attendance|hours|sl)[\s(]*/i;
                    // Date pattern to detect date-only rows
                    const fullDatePattern = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/i;

                    let foundDate = false;
                    // colIsSeconds: only set when actual DATA cells are in HH:MM:SS format (NOT from header name)
                    let colIsSeconds = false;

                    const rawPairs: { name: string, rawVal: number }[] = [];

                    for (let i = 0; i < data.length; i++) {
                        const row = data[i];
                        if (!row || row.length < 2) continue;

                        // Check every cell in this row for a date
                        if (!foundDate) {
                            const rowStr = row.map(String).join(' ');
                            const dm = rowStr.match(fullDatePattern);
                            if (dm) {
                                try {
                                    const d = new Date(dm[1]);
                                    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
                                        setDate(d.toISOString().split('T')[0]);
                                        foundDate = true;
                                    }
                                } catch (_) { }
                            }
                        }

                        const firstCell = String(row[0]).trim();

                        // Skip header / junk / empty name rows — NO seconds detection from header words
                        if (!firstCell || firstCell === 'undefined' || junkNames.test(firstCell)) continue;
                        // Skip rows where the name itself looks like a date
                        if (fullDatePattern.test(firstCell)) continue;

                        // Clean up platform-specific words from name
                        let nameStr = firstCell.replace(/\b(Present|Absent|Zoom|Host|Guest|Yes|No|Late|Joined|om|o|Skillcase|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, '').trim();
                        if (nameStr.length < 2) continue;

                        // Find the time value from remaining columns
                        let rawVal = -1;
                        for (let c = row.length - 1; c >= 1; c--) {
                            const cell = row[c];
                            const num = Number(cell);
                            if (cell !== undefined && cell !== null && cell !== '' && !isNaN(num) && num >= 0) {
                                rawVal = num;
                                break;
                            } else if (typeof cell === 'string') {
                                // HH:MM:SS format → this is unambiguously seconds → convert
                                const hms = cell.match(/^(\d+):(\d{2}):(\d{2})$/);
                                if (hms) {
                                    rawVal = parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3]);
                                    colIsSeconds = true;
                                    break;
                                }
                                // MM:SS format → seconds
                                const ms = cell.match(/^(\d+):(\d{2})$/);
                                if (ms) {
                                    rawVal = parseInt(ms[1]) * 60 + parseInt(ms[2]);
                                    colIsSeconds = true;
                                    break;
                                }
                            }
                        }

                        if (rawVal < 0) continue;
                        rawPairs.push({ name: nameStr, rawVal });
                    }

                    // Convert to minutes only if:
                    // 1. We detected HH:MM:SS/MM:SS format (unambiguously seconds), OR
                    // 2. Max raw value > 300 (no realistic class runs for > 300 minutes = 5 hours)
                    const maxRaw = rawPairs.reduce((m, p) => Math.max(m, p.rawVal), 0);
                    const isSeconds = colIsSeconds || maxRaw > 300;

                    const finalEntries = rawPairs.map(p => {
                        const mins = isSeconds ? Math.round(p.rawVal / 60) : p.rawVal;
                        return `${p.name} - ${mins}`;
                    });

                    const finalDuration = isSeconds ? Math.round(maxRaw / 60) : maxRaw;
                    if (finalDuration > 0) setDuration(finalDuration);

                    if (finalEntries.length > 0) {
                        setAttendanceText(prev => prev + (prev ? '\n' : '') + finalEntries.join('\n'));
                        setErrorMsg('');
                    } else {
                        setErrorMsg('No valid attendance data found. Ensure names are in column 1 and time values are numeric.');
                    }
                } catch (err) {
                    setErrorMsg('Failed to process spreadsheet file.');
                }
            };
            reader.readAsBinaryString(file);
            e.target.value = '';
            return;
        }

        setIsOcrLoading(true);
        setErrorMsg('');
        try {
            const result = await Tesseract.recognize(file, 'eng', {
                logger: m => console.log(m)
            });

            // Regex to find "Name ... Number" patterns
            const text = result.data.text;
            const lines = text.split('\n');

            // Try to find a date in the text — multiple format support
            const datePatterns = [
                /(\d{4}-\d{2}-\d{2})/, // 2024-02-21
                /(\d{1,2}\/\d{1,2}\/\d{4})/, // 21/02/2024
                /(\d{1,2}-\d{1,2}-\d{4})/, // 21-02-2024
                /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/i // Feb 21, 2024
            ];
            let extractedDate = '';
            for (const pat of datePatterns) {
                const dm = text.match(pat);
                if (dm) { extractedDate = dm[1]; break; }
            }
            if (extractedDate) {
                try {
                    const d = new Date(extractedDate);
                    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
                        setDate(d.toISOString().split('T')[0]);
                    }
                } catch (_) { }
            }

            // Collect raw OCR entries first, then decide conversion
            const rawPairs: { name: string, rawVal: number }[] = [];
            for (const line of lines) {
                const cleanLine = line.replace(/[^a-zA-Z0-9\s-:]/g, ' ').trim();
                // match HH:MM:SS or H:MM:SS time string → convert seconds
                const hmsMatch = cleanLine.match(/^([a-zA-Z\s]+)[\s-:]+((\d+):(\d{2}):(\d{2}))/);
                if (hmsMatch) {
                    let name = hmsMatch[1].trim();
                    name = name.replace(/\b(Present|Absent|Zoom|Host|Guest|Yes|No|Late|Joined|om|o|Skillcase|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, '').trim();
                    const totalSecs = parseInt(hmsMatch[3]) * 3600 + parseInt(hmsMatch[4]) * 60 + parseInt(hmsMatch[5]);
                    if (name.length > 2 && /[a-zA-Z]{3,}/.test(name)) {
                        rawPairs.push({ name, rawVal: totalSecs });
                    }
                    continue;
                }
                const match = cleanLine.match(/^([a-zA-Z\s]+)[\s-:]+(\d+)/);
                if (match) {
                    let name = match[1].trim();
                    name = name.replace(/\b(Present|Absent|Zoom|Host|Guest|Yes|No|Late|Joined|om|o|Skillcase|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, '').trim();
                    const rawVal = Number(match[2].trim());
                    if (name.length > 2 && /[a-zA-Z]{3,}/.test(name) && !/PM|AM/i.test(name) && !isNaN(rawVal)) {
                        rawPairs.push({ name, rawVal });
                    }
                }
            }

            const maxRaw = rawPairs.reduce((m, p) => Math.max(m, p.rawVal), 0);
            const isSeconds = maxRaw > 200;
            const finalEntries = rawPairs.map(p => {
                const mins = isSeconds ? Math.round(p.rawVal / 60) : p.rawVal;
                return `${p.name} - ${mins}`;
            });
            const finalDuration = isSeconds ? Math.round(maxRaw / 60) : maxRaw;

            if (finalDuration > 0) setDuration(finalDuration);

            if (finalEntries.length > 0) {
                setAttendanceText(prev => prev + (prev ? '\n' : '') + finalEntries.join('\n'));
            } else {
                const rawFiltered = lines.filter((l: string) => l.trim().length > 3).map((l: string) => l.replace(/[^a-zA-Z0-9\s-]/g, '').trim());
                setAttendanceText(prev => prev + (prev ? '\n' : '') + rawFiltered.join('\n'));
            }
        } catch (err) {
            setErrorMsg('Failed to extract text from image.');
        } finally {
            setIsOcrLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.vtt')) {
            setErrorMsg('Please upload a valid .vtt file.');
            return;
        }

        try {
            const text = await file.text();
            setVttRawText(text);
            const parsed = parseVttContent(text);
            setVttData(parsed);
            setVttFileName(file.name);
            setErrorMsg('');
        } catch (err) {
            setErrorMsg('Failed to parse VTT file.');
        }
    };

    const calculateScores = () => {
        setErrorMsg('');
        if (!attendanceText) {
            setErrorMsg('Please enter attendance records.');
            return;
        }

        // Parse attendance safely with regex to handle tabs, spaces, formats 'Bob 60' or 'Alice 1 hour'
        const lines = attendanceText.split('\n').filter(l => l.trim().length > 0);
        const parsedAttendance: Record<string, number> = {};

        for (const line of lines) {
            // Find the last number in the line that could be minutes
            const match = line.match(/(.*?)(\d+(?:\.\d+)?)\s*(mins?|m|h|hours?)?\s*$/i);

            if (match) {
                let name = match[1].trim().replace(/^[-,\t:]+\s*|\s*[-,\t:]+$/g, '');
                if (!name) name = "Unknown";

                let mins = parseFloat(match[2]);
                if (match[3] && match[3].toLowerCase().startsWith('h')) {
                    mins *= 60; // Convert hours to minutes
                }

                if (!isNaN(mins)) {
                    parsedAttendance[name] = mins;
                }
            }
        }

        if (Object.keys(parsedAttendance).length === 0) {
            setErrorMsg('Invalid attendance format. Make sure each line ends with a number (e.g., "Student Name 60" or "Student Name - 60").');
            return;
        }

        // Determine max speaking time (excluding teacher)
        let maxSpeaking = 0;
        for (const [speaker, mins] of Object.entries(vttData)) {
            if (teacherName && speaker.toLowerCase() === teacherName.toLowerCase()) continue;
            if (mins > maxSpeaking) maxSpeaking = mins;
        }

        // Fallback if max is 0 to avoid division by zero
        if (maxSpeaking === 0) maxSpeaking = 1;

        const students: StudentRecord[] = [];

        const fixedStudentsList = fixedStudentsText.split(',').map(s => s.trim()).filter(Boolean);
        const hasFixedList = fixedStudentsList.length > 0;

        // If fixed list exists, initialize them all first
        if (hasFixedList) {
            for (const fixedName of fixedStudentsList) {
                // Check if they were in the attendance list via fuzzy match
                const attKey = Object.keys(parsedAttendance).find(k => {
                    const kLower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const nLower = fixedName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return kLower.includes(nLower) || nLower.includes(kLower);
                });

                const attMins = attKey ? parsedAttendance[attKey] : 0;

                // Remove from parsedAttendance so we don't process them again later below
                if (attKey) delete parsedAttendance[attKey];

                const speakingName = Object.keys(vttData).find(k => {
                    const kLower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const nLower = fixedName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return kLower.includes(nLower) || nLower.includes(kLower);
                });
                const speakingMins = speakingName ? vttData[speakingName] : 0;

                // Use safe divisors to prevent NaN if they are 0
                const safeDuration = duration > 0 ? duration : 1;
                const safeMaxSpeaking = maxSpeaking > 0 ? maxSpeaking : 1;

                const attScore = Math.min((attMins / safeDuration) * 100 * 0.6, 60);
                const speakScore = Math.min((speakingMins / safeMaxSpeaking) * 100 * 0.4, 40);

                const healthScore = Math.min(attScore + speakScore, 100);
                let healthTag: 'Excellent' | 'Good' | 'Needs Attention' = 'Needs Attention';
                if (healthScore > 90) healthTag = 'Excellent';
                else if (healthScore >= 70) healthTag = 'Good';

                students.push({
                    name: fixedName,
                    attendanceMinutes: attMins,
                    speakingTimeMinutes: speakingMins,
                    healthScore,
                    healthTag
                });
            }
        }

        // Add remaining students that weren't in the fixed list (unless we want to perfectly restrict it. The prompt implied "students should be fixed", indicating we should only track fixed if defined)
        if (!hasFixedList) {
            for (const [name, attMins] of Object.entries(parsedAttendance)) {
                // Find matching speaking time (case-insensitive fuzzy match)
                const speakingName = Object.keys(vttData).find(k => {
                    const kLower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const nLower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (!kLower || !nLower) return false;
                    // Match if one string is contained within the other
                    return nLower.includes(kLower) || kLower.includes(nLower);
                });
                const speakingMins = speakingName ? vttData[speakingName] : 0;

                // Use safe divisors to prevent NaN if they are 0
                const safeDuration = duration > 0 ? duration : 1;
                const safeMaxSpeaking = maxSpeaking > 0 ? maxSpeaking : 1;

                // Cap attendance score at max 60%
                const attScore = Math.min((attMins / safeDuration) * 100 * 0.6, 60);
                let speakScore = 0;

                // Do not score the teacher
                if (teacherName && name.toLowerCase() === teacherName.toLowerCase()) {
                    continue;
                } else {
                    // Cap speaking score at max 40%
                    speakScore = Math.min((speakingMins / safeMaxSpeaking) * 100 * 0.4, 40);
                }

                // Cap total health score at exactly 100%
                const healthScore = Math.min(attScore + speakScore, 100);
                let healthTag: 'Excellent' | 'Good' | 'Needs Attention' = 'Needs Attention';
                if (healthScore > 90) healthTag = 'Excellent';
                else if (healthScore >= 70) healthTag = 'Good';

                students.push({
                    name,
                    attendanceMinutes: attMins,
                    speakingTimeMinutes: speakingMins,
                    healthScore,
                    healthTag
                });
            }
        }

        students.sort((a, b) => b.healthScore - a.healthScore);

        const analysis = vttRawText ? analyzeTranscript(vttRawText, teacherName, vttData, duration, activeClass?.language, activeClass?.level) : { topic: undefined, teacherSuggestions: undefined, studentSuggestions: undefined, inferredPages: [] };

        const parsePagesInput = (text: string) => {
            const result = new Set<number>();
            const parts = text.split(',');
            for (const part of parts) {
                const rangeMatch = part.match(/(\d+)\s*[-to]+\s*(\d+)/i);
                if (rangeMatch) {
                    const start = parseInt(rangeMatch[1]);
                    const end = parseInt(rangeMatch[2]);
                    if (!isNaN(start) && !isNaN(end) && start <= end && end - start < 200) {
                        for (let i = start; i <= end; i++) result.add(i);
                    }
                } else {
                    const numMatch = part.match(/(\d+)/);
                    if (numMatch) {
                        const num = parseInt(numMatch[1]);
                        if (!isNaN(num)) result.add(num);
                    }
                }
            }
            return Array.from(result);
        };

        const book1ManualPages = parsePagesInput(book1CoveredPagesText);
        const book2ManualPages = parsePagesInput(book2CoveredPagesText);

        const book1CoveredPages = Array.from(new Set([...book1ManualPages, ...(analysis.inferredPages || [])])).sort((a, b) => a - b);
        const book2CoveredPages = book2ManualPages.sort((a, b) => a - b);

        const report: DailyReport = {
            id: Date.now().toString(),
            classId: activeClassId,
            date,
            durationMinutes: duration,
            students,
            topic: analysis.topic,
            teacherSuggestions: analysis.teacherSuggestions,
            studentSuggestions: analysis.studentSuggestions,
            includesTest,
            book1CoveredPages,
            book2CoveredPages
        };

        setCurrentReport(report);
    };

    const handleSaveReport = () => {
        if (currentReport) {
            saveReport(currentReport);
            setReports([currentReport, ...reports]);
            setView('history');
            setCurrentReport(null);
            // Reset form
            setAttendanceText('');
            setVttData({});
            setVttFileName('');
            setVttRawText('');
            setBook1CoveredPagesText('');
            setBook2CoveredPagesText('');
        }
    };

    const handleFetchFromWise = async () => {
        if (!wiseApiKey) {
            setErrorMsg('Please provide your Wise API Key.');
            return;
        }
        setIsWiseLoading(true);
        setErrorMsg('');

        try {
            // Some Wise API tokens use Bearer tokens instead of Basic Auth. 
            // We adapt dynamically based on whether the User ID was provided.
            const headers: Record<string, string> = {
                'x-api-key': wiseApiKey,
                'Content-Type': 'application/json'
            };

            let activeNamespace = wiseNamespace;
            if (activeNamespace && activeNamespace.trim() !== '') {
                activeNamespace = activeNamespace.trim().toLowerCase();
                headers['x-wise-namespace'] = activeNamespace;
            }

            if (wiseUserId && wiseUserId.trim() !== '') {
                const basicAuthToken = btoa(`${wiseUserId.trim()}:${wiseApiKey}`);
                headers['Authorization'] = `Basic ${basicAuthToken}`;
            } else {
                headers['Authorization'] = `Bearer ${wiseApiKey}`;
            }

            let cleanClassId = wiseClassId.trim();
            let cleanSessionId = wiseSessionId.trim();
            let attendanceRecords: any[] = [];

            // Auto-fetch if user left them blank
            if (!cleanClassId || !cleanSessionId) {
                if (!activeNamespace) {
                    setIsWiseLoading(false);
                    setErrorMsg('To auto-fetch the latest lesson, you must provide your Institute Namespace.');
                    return;
                }

                // Step 1: Resolve the namespace into the hexadecimal instituteId
                const instRes = await fetch(`/wise-api/teacher/institutes`, { headers });
                if (!instRes.ok) {
                    throw new Error(`Failed to resolve your Institute ID(${instRes.status}).Verify your API Key.`);
                }
                const instData = await instRes.json();
                const institutes = instData.data || instData;

                let actualInstituteId = '';
                if (Array.isArray(institutes)) {
                    // Find the one matching activeNamespace, or just grab the first one
                    const matched = institutes.find(i => i.namespace?.toLowerCase() === activeNamespace) || institutes[0];
                    if (matched) actualInstituteId = matched._id || matched.id;
                }

                if (!actualInstituteId) {
                    throw new Error(`Could not locate a hex Institute ID for namespace "${activeNamespace}".`);
                }

                // Step 2: Fetch the latest past sessions using the hex ID (fetch up to 30 to allow date mapping)
                let autoFetchUrl = `/wise-api/institutes/${actualInstituteId}/sessions?paginateBy=COUNT&page_number=1&page_size=30&status=PAST`;
                if (cleanClassId) {
                    autoFetchUrl += `&classId=${cleanClassId}`;
                }

                const latestSessionRes = await fetch(autoFetchUrl, { headers });

                if (!latestSessionRes.ok) {
                    const txt = await latestSessionRes.text();
                    throw new Error(`Auto-fetch failed (${latestSessionRes.status}). Your API Key might not have global institute permissions. Try putting your Class ID in the box, and leaving ONLY the Session ID blank! Details: ${txt}`);
                }

                const latestSessionData = await latestSessionRes.json();

                // The API can return the array directly in data, or nested inside data.sessions
                let pastSessions = latestSessionData.data?.sessions || latestSessionData.data || latestSessionData;

                if (!Array.isArray(pastSessions) || pastSessions.length === 0) {
                    throw new Error(`No past completed sessions were found. Try pasting your Class ID into the box! API Response: ${JSON.stringify(latestSessionData)}`);
                }

                // Try to find the session that matches the date selected in the UI
                const targetedSession = pastSessions.find(s => {
                    const startTimeStr = s.start_time || s.startTime || s.createdAt || '';
                    return startTimeStr.includes(date); // checks if YYYY-MM-DD matches
                });

                const latest = targetedSession || pastSessions[0];

                // classId might be a populated object rather than a string
                let rawClassId = latest.classId || latest.class_id;
                if (rawClassId && typeof rawClassId === 'object' && rawClassId._id) {
                    rawClassId = rawClassId._id;
                }

                cleanClassId = rawClassId || cleanClassId;
                cleanSessionId = latest._id || latest.id || latest.sessionId || cleanSessionId;

                if (!cleanClassId || typeof cleanClassId === 'object' || !cleanSessionId) {
                    throw new Error('Auto-fetch succeeded but the API response was unexpectedly missing the class or session ID. Response: ' + JSON.stringify(latest));
                }

                // If Auto-Fetch was used, it conveniently provides a fully aggregated list of participants directly inside the payload!
                if (Array.isArray(latest.participants) && latest.participants.length > 0) {
                    attendanceRecords = latest.participants;
                }

                // Backfill the UI inputs so the user sees what was found
                setWiseClassId(cleanClassId);
                setWiseSessionId(cleanSessionId);
            }

            // 1. Fetch Attendance (Only if we didn't just get it for free from Auto-Fetch)
            if (attendanceRecords.length === 0) {
                // API Endpoint: https://api.wiseapp.live/user/classes/{{class_id}}/sessions/{{zoom_session_id}}/rawAttendance
                const attendanceRes = await fetch(`/wise-api/user/classes/${cleanClassId}/sessions/${cleanSessionId}/rawAttendance`, { headers });

                if (!attendanceRes.ok) {
                    const errText = await attendanceRes.text();
                    throw new Error(`Wise API Error (${attendanceRes.status}): ${errText || 'Failed to fetch attendance.'}`);
                }

                const attendanceData = await attendanceRes.json();

                // Debug the exact format of attendanceData
                attendanceRecords = attendanceData.data?.attendance?.participants || attendanceData.data?.attendance?.students || attendanceData.data?.attendance?.attendees || attendanceData.data?.participants || attendanceData.attendance || attendanceData.data || [];

                // If it's still an object and not an array, extract the first inner array
                if (!Array.isArray(attendanceRecords) && typeof attendanceRecords === 'object' && attendanceRecords !== null) {
                    const arrayKey = Object.keys(attendanceRecords).find(k => Array.isArray((attendanceRecords as any)[k]));
                    if (arrayKey) {
                        attendanceRecords = (attendanceRecords as any)[arrayKey];
                    }
                }

                if (!Array.isArray(attendanceRecords)) {
                    // Return exact JSON keys so we can see what's what
                    const rootKeys = Object.keys(attendanceData).join(', ');
                    const dataKeys = attendanceData.data ? Object.keys(attendanceData.data).join(', ') : 'none';
                    const attKeys = attendanceData.data?.attendance ? Object.keys(attendanceData.data.attendance).join(', ') : 'none';
                    throw new Error(`Success but parsing failed! Root keys: [${rootKeys}]. Data keys: [${dataKeys}]. Attendance keys: [${attKeys}]`);
                }
            }

            // Aggregate attendance by name (Wise returns multiple join/leave events, often in seconds)
            const attendanceMap = new Map<string, number>();

            attendanceRecords.forEach((record: any) => {
                const name = record.name || record.studentName || record.firstName || 'Unknown Student';
                // Always assume Wise returns event durations natively in seconds
                const durationSecondsRaw = record.duration || record.minutesAttended || record.time || record.totalTime || record.totalTimeSpent || 0;

                attendanceMap.set(name, (attendanceMap.get(name) || 0) + Number(durationSecondsRaw));
            });

            // Format Wise Attendance Map into text string format
            const formattedAttendance = Array.from(attendanceMap.entries())
                // .filter(([name, ] => name.toLowerCase() !== 'skillcase') // optionally filter out host
                .map(([name, totalSeconds]) => {
                    // Convert the grand total seconds to minutes
                    const totalMins = Math.round(totalSeconds / 60);
                    return `${name} - ${totalMins}`;
                })
                .join('\n');

            setAttendanceText(formattedAttendance);

            // Auto-fill the Class Duration (minutes) based on the maximum attended time
            if (attendanceMap.size > 0) {
                const maxSeconds = Math.max(0, ...Array.from(attendanceMap.values()));
                if (maxSeconds > 0) {
                    setDuration(Math.round(maxSeconds / 60));
                }
            }

            // 2. Fetch Transcript / Insights (based on session insight API since explicit VTT isn't documented)
            // https://api.wiseapp.live/user/classes/{{class_id}}/sessions/{{session_id}}?showLiveClassInsight=true&showSessionFiles=true
            try {
                const insightRes = await fetch(`/wise-api/user/classes/${cleanClassId}/sessions/${cleanSessionId}?showLiveClassInsight=true&showSessionFiles=true`, { headers });

                if (insightRes.ok) {
                    const insightData = await insightRes.json();

                    // Look at the new keys provided: rawTranscript
                    const transcriptDataRaw = insightData.data?.rawTranscript || insightData.rawTranscript || insightData.data?.transcript || insightData.transcript;

                    // Filter out completely empty arrays or empty strings
                    const isTranscriptDataEmpty = !transcriptDataRaw ||
                        (Array.isArray(transcriptDataRaw) && transcriptDataRaw.length === 0) ||
                        (typeof transcriptDataRaw === 'string' && transcriptDataRaw.trim() === '');

                    const transcriptData = isTranscriptDataEmpty ? null : transcriptDataRaw;

                    if (transcriptData) {
                        let rawText = '';
                        // Sometimes it's a string (VTT), sometimes it's an object with a URL or array of lines

                        if (typeof transcriptData === 'string') {
                            rawText = transcriptData;
                        } else if (Array.isArray(transcriptData)) {
                            // Check if this is an array of URL objects (Wise sometimes returns an array of transcript file info)
                            const firstItem = transcriptData[0] || {};
                            if (firstItem.url && typeof firstItem.url === 'string' && firstItem.url.includes('.vtt')) {
                                try {
                                    let fetchUrl = firstItem.url;
                                    if (fetchUrl.includes('https://files.wiseapp.live')) {
                                        fetchUrl = fetchUrl.replace('https://files.wiseapp.live', '/wise-files');
                                    }
                                    const vttRes = await fetch(fetchUrl);
                                    if (vttRes.ok) {
                                        rawText = await vttRes.text();
                                    } else {
                                        throw new Error('Failed to download VTT from provided URL array');
                                    }
                                } catch (e) {
                                    rawText = "Please download transcript from: " + firstItem.url;
                                }
                            } else if (firstItem.text || firstItem.message || firstItem.speaker || firstItem.userName) {
                                // Convert the JSON array of dialogue lines into a valid VTT string!
                                rawText = transcriptData.map((l: any, i: number) => {
                                    // Default fallback to 5 sec intervals if start/end times missing
                                    const start = l.start_time || l.startTime || l.start || (i * 5); // seconds
                                    const end = l.end_time || l.endTime || l.end || (start + 5);

                                    const toVttTime = (secs: number) => {
                                        const s = Number(secs) || 0;
                                        const m = Math.floor(s / 60);
                                        const h = Math.floor(m / 60);
                                        const resS = (s % 60).toFixed(3).padStart(6, '0');
                                        return `${h.toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}:${resS}`;
                                    };

                                    return `${i + 1}\n${toVttTime(start)} --> ${toVttTime(end)}\n${l.speaker || l.speakerName || l.speaker_name || l.userName || l.user_name || l.name || l.participant || 'Speaker'}: ${l.text || l.message || l.dialogue || ''}\n`;
                                }).join('\n');
                            } else {
                                // Array of unknown objects!
                                rawText = JSON.stringify(transcriptData, null, 2);
                            }
                        } else if (transcriptData.vtt) {
                            rawText = transcriptData.vtt;
                        } else if (transcriptData.url) {
                            rawText = "Please download transcript from: " + transcriptData.url;
                        } else {
                            rawText = JSON.stringify(transcriptData, null, 2);
                        }

                        setVttRawText(rawText);
                        const parsedVtt = parseVttContent(rawText);
                        setVttData(parsedVtt);
                        setVttFileName(`wise_${wiseSessionId}_transcript`);

                        // Check if we extracted any speaking times, if not throw warning
                        if (Object.keys(parsedVtt).length === 0 || parsedVtt['Speaker']) {
                            let sampleInfo = '';
                            if (Array.isArray(transcriptData) && transcriptData.length > 0) {
                                sampleInfo = JSON.stringify(transcriptData[0]);
                            } else {
                                sampleInfo = JSON.stringify(transcriptData).substring(0, 500);
                            }
                            setErrorMsg(`Warning: Failed to extract proper names! Sample data: ${sampleInfo}`);
                            setIsWiseLoading(false);
                            return; // Stop and keep modal open so user can read the error!
                        } else {
                            setErrorMsg(`Success: Attendance and Transcript loaded successfully!`);
                        }
                    } else if (insightData.data?.recordings || insightData.data?.rawRecordings) {
                        // Fallback: If no raw VTT but they return recordings array, they usually have a transcript URL inside
                        const recs = insightData.data?.rawRecordings || insightData.data?.recordings || [];
                        const firstRec = Array.isArray(recs) && recs.length > 0 ? recs[0] : null;

                        if (firstRec && (firstRec.transcriptUrl || firstRec.vtt_url || firstRec.vttUrl || firstRec.downloadUrl)) {
                            let dlUrl = firstRec.transcriptUrl || firstRec.vtt_url || firstRec.vttUrl || firstRec.downloadUrl;
                            if (dlUrl.includes('https://files.wiseapp.live')) {
                                dlUrl = dlUrl.replace('https://files.wiseapp.live', '/wise-files');
                            }
                            try {
                                // Fetch the actual VTT file
                                const vttRes = await fetch(dlUrl);
                                if (vttRes.ok) {
                                    const vttText = await vttRes.text();
                                    setVttRawText(vttText);
                                    setVttData(parseVttContent(vttText));
                                    setVttFileName(`wise_${wiseSessionId}_transcript.vtt`);
                                    setErrorMsg(`Success: Attendance and Transcript loaded successfully!`);
                                } else {
                                    setErrorMsg(`Success: Attendance loaded! Note: Found Transcript URL but failed to download it.`);
                                }
                            } catch (e) {
                                setErrorMsg(`Success: Attendance loaded! Note: Transcript URL found but browser prevented download (CORS). URL: ${dlUrl}`);
                            }
                        } else {
                            const recInfo = firstRec ? Object.keys(firstRec).join(', ') : 'Empty array';
                            setErrorMsg(`Success: Attendance loaded! Note: No transcript URL found. Recording keys: [${recInfo}]. Data: ${JSON.stringify(firstRec).substring(0, 200)}`);
                            setIsWiseLoading(false);
                            return; // Stop and keep modal open so user can read!
                        }
                    } else if (insightData.data?.sessionFiles && Array.isArray(insightData.data.sessionFiles) && insightData.data.sessionFiles.length > 0) {
                        // Sometimes the transcript is uploaded as a standalone session file!
                        const f = insightData.data.sessionFiles.find((file: any) =>
                            (file.name && file.name.toLowerCase().includes('transcript')) ||
                            (file.url && file.url.toLowerCase().includes('.vtt'))
                        );

                        if (f && f.url) {
                            const dlUrl = f.url;
                            try {
                                const vttRes = await fetch(dlUrl);
                                if (vttRes.ok) {
                                    const vttText = await vttRes.text();
                                    setVttRawText(vttText);
                                    setVttData(parseVttContent(vttText));
                                    setVttFileName(`wise_${wiseSessionId}_transcript.vtt`);
                                    setErrorMsg(`Success: Attendance and Transcript loaded successfully!`);
                                } else {
                                    setErrorMsg(`Success: Attendance loaded! Note: Transcript File found but failed to download (${vttRes.status}).`);
                                }
                            } catch (e) {
                                setErrorMsg(`Success: Attendance loaded! Note: Transcript File URL found but browser prevented download (CORS). URL: ${dlUrl}`);
                            }
                        } else {
                            const fnames = insightData.data.sessionFiles.map((x: any) => x.name || 'Unnamed').join(', ');
                            setErrorMsg(`Success: Attendance loaded! Note: 'sessionFiles' were found, but no transcript. Files found: [${fnames}]`);
                            setIsWiseLoading(false);
                            return;
                        }
                    } else if (isTranscriptDataEmpty) {
                        setErrorMsg(`Success: Attendance loaded! Note: The Wise API returned an explicitly EMPTY transcript "[]" for this session. Is the class recording/transcript enabled?`);
                    } else {
                        // Fallback: Dump payload keys to debug where transcript is hiding
                        const keysStr = insightData.data ? Object.keys(insightData.data).join(', ') : Object.keys(insightData).join(', ');
                        setErrorMsg(`Success: Attendance loaded! Note: Transcript missing. The API returned these keys in insights: [${keysStr}].`);
                    }
                }
            } catch (transcriptErr) {
                console.error("Transcript fetch error:", transcriptErr);
                // Non-blocking, VTT is optional
            }

            setShowWiseModal(false);
            localStorage.setItem('wise_api_key', wiseApiKey);
            localStorage.setItem('wise_user_id', wiseUserId);
            localStorage.setItem('wise_namespace', wiseNamespace);

            // Save the resolved class ID globally and for this specific tracker profile
            localStorage.setItem('wise_class_id', cleanClassId);
            if (activeClass) {
                localStorage.setItem(`wise_class_id_${activeClass.id}`, cleanClassId);
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error connecting to Wise LMS platform.');
        } finally {
            setIsWiseLoading(false);
        }
    };

    const renderDashboard = () => (
        <div className="animate-fade-in">
            <div className="row">
                <div className="col card">
                    <div className="flex justify-between items-center mb-4">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            <Users className="icon" style={{ color: 'var(--primary)' }} />
                            Total Reports
                        </h3>
                        <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>{reports.length}</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reports generated for {activeClass?.name}</p>
                </div>

                <div className="col card" style={{ cursor: 'pointer', border: '2px dashed var(--primary)' }} onClick={() => setView('new_report')}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--primary)' }}>
                        <PlusCircle size={32} />
                        <span style={{ fontWeight: 600 }}>Create New Daily Report</span>
                    </div>
                </div>
            </div>

            <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Recent History</h3>
            {reports.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No reports yet for this class.</p>
            ) : (
                <div className="history-list">
                    {reports.slice(0, 5).map(r => (
                        <div key={r.id} className="history-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <Calendar className="icon" style={{ color: 'var(--text-muted)' }} />
                                <span style={{ fontWeight: 500 }}>{r.date}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>({r.students.length} students)</span>
                            </div>
                            <button className="btn btn-secondary" onClick={() => { setCurrentReport(r); setView('history'); }} style={{ padding: '0.25rem 0.75rem' }}>
                                View
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderNewReport = () => (
        <div className="animate-fade-in" onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, color: 'var(--primary)' }}>New Health Check Report</h2>
                    <button
                        className="btn btn-secondary"
                        style={{ border: '1px solid #7c3aed', color: '#7c3aed', background: 'rgba(124, 58, 237, 0.05)' }}
                        onClick={() => setShowWiseModal(true)}
                    >
                        <UploadCloud size={16} /> Fast-Import from Wise LMS
                    </button>
                </div>

                {errorMsg && <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '0.5rem', marginBottom: '1.5rem', fontWeight: 500 }}>{errorMsg}</div>}

                <div className="row">
                    <div className="col form-group">
                        <label>Date</label>
                        <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div className="col form-group">
                        <label>Class Duration (minutes)</label>
                        <input type="number" className="form-control" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="col form-group">
                        <label>Teacher Name (Exclude from scores)</label>
                        <input type="text" className="form-control" placeholder="e.g. John Doe" value={teacherName}
                            onChange={e => { setTeacherName(e.target.value); updateCurrentClass({ teacherName: e.target.value }); }}
                        />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>Fixed Students List (Comma separated, optional)</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>If set, ONLY these students will appear. Missing students will get 0%.</p>
                    <textarea
                        className="form-control"
                        placeholder="Alice, Bob, Charlie..."
                        style={{ minHeight: '60px' }}
                        value={fixedStudentsText}
                        onChange={e => { setFixedStudentsText(e.target.value); updateCurrentClass({ fixedStudents: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }); }}
                    />
                </div>

                <div className="form-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Attendance Input (Format: Name - minutes)</span>
                        <div className="file-upload-wrapper">
                            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', pointerEvents: 'none' }}>
                                {isOcrLoading ? 'Scanning...' : <><FileSpreadsheet size={14} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} />Extract Image/Excel</>}
                            </button>
                            <input type="file" accept="image/*,.xlsx,.xls,.csv" onChange={handleImageUpload} disabled={isOcrLoading} />
                        </div>
                    </label>
                    <textarea
                        className="form-control"
                        placeholder="Alice Smith - 95&#10;Bob Jones - 101&#10;Charlie - 45"
                        value={attendanceText}
                        onChange={e => setAttendanceText(e.target.value)}
                    />
                </div>

                <div className="form-group">
                    <label>Transcript Upload (.vtt)</label>
                    <div className="file-upload-wrapper">
                        <button className="btn btn-secondary" style={{ pointerEvents: 'none' }}>
                            <UploadCloud size={18} /> {vttFileName || 'Select .vtt file'}
                        </button>
                        <input type="file" accept=".vtt" onChange={handleFileUpload} />
                    </div>
                    {Object.keys(vttData).length > 0 && (
                        <p style={{ fontSize: '0.875rem', color: 'var(--success)', marginTop: '0.5rem', fontWeight: 500 }}>
                            <Check size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                            Extracted {Object.keys(vttData).length} speakers from transcript: {Object.keys(vttData).join(', ').substring(0, 100)}...
                        </p>
                    )}
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                    <input
                        type="checkbox"
                        id="test-toggle"
                        checked={includesTest}
                        onChange={e => setIncludesTest(e.target.checked)}
                        style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <label htmlFor="test-toggle" style={{ margin: 0, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Include Test Scores Formula <span className="tag" style={{ background: 'var(--primary)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '1rem', fontSize: '0.7rem' }}>Coming Soon</span>
                    </label>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem', background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BookOpen size={18} /> Syllabus Books (Auto-Detected from Transcript)
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>Set up your books once. Pages will be auto-extracted from the transcript each session.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Book 1 Name</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. Netzwerk Neu A1"
                                value={activeClass?.book1Name || ''}
                                onChange={e => updateCurrentClass({ book1Name: e.target.value })}
                                style={{ marginBottom: '0.5rem' }}
                            />
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Total Pages</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    className="form-control"
                                    placeholder="e.g. 160"
                                    value={activeClass?.book1TotalPages || ''}
                                    onChange={e => updateCurrentClass({ book1TotalPages: parseInt(e.target.value) || 0 })}
                                    style={{ flex: 1 }}
                                />
                                <div style={{ position: 'relative' }}>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }} disabled={isScanningBookPdf}>
                                        {isScanningBookPdf ? '...' : <><UploadCloud size={14} /> PDF</>}
                                    </button>
                                    <input type="file" accept="application/pdf" onChange={e => handleBookPdfUpload(e, true)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Book 2 Name (Optional)</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. Studio d A1"
                                value={activeClass?.book2Name || ''}
                                onChange={e => updateCurrentClass({ book2Name: e.target.value })}
                                style={{ marginBottom: '0.5rem' }}
                            />
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Total Pages</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    className="form-control"
                                    placeholder="e.g. 200"
                                    value={activeClass?.book2TotalPages || ''}
                                    onChange={e => updateCurrentClass({ book2TotalPages: parseInt(e.target.value) || 0 })}
                                    style={{ flex: 1 }}
                                />
                                <div style={{ position: 'relative' }}>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }} disabled={isScanningBookPdf}>
                                        {isScanningBookPdf ? '...' : <><UploadCloud size={14} /> PDF</>}
                                    </button>
                                    <input type="file" accept="application/pdf" onChange={e => handleBookPdfUpload(e, false)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button className="btn btn-primary" onClick={calculateScores}>
                    <Activity size={18} />
                    Calculate Health Scores
                </button>
            </div>

            {currentReport && renderReportResults(currentReport, true)}
        </div>
    );

    const renderReportResults = (report: DailyReport, isNew: boolean) => (
        <div className="card animate-fade-in" style={{ marginTop: '2rem' }}>
            <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3>Results for {report.date}</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => downloadJSON(report, activeClass?.name || 'Class')}>
                        <FileText size={16} /> JSON
                    </button>
                    <button className="btn btn-secondary" onClick={() => downloadCSV(report, activeClass?.name || 'Class')}>
                        <Download size={16} /> CSV
                    </button>
                    <button className="btn btn-secondary" onClick={() => downloadExcel(report, activeClass?.name || 'Class')}>
                        <FileSpreadsheet size={16} /> Excel
                    </button>
                    {isNew && (
                        <button className="btn btn-primary" onClick={handleSaveReport}>
                            Save Report
                        </button>
                    )}
                </div>
            </div>

            {report.topic && (
                <div style={{ marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.5)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginTop: 0 }}>
                        <Brain size={18} /> Extracted Topic
                    </h4>
                    <p style={{ margin: 0, fontWeight: 500, textTransform: 'capitalize' }}>{report.topic}</p>
                </div>
            )}

            {(activeClass?.book1Name || activeClass?.book2Name) && (
                <div style={{ marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.5)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginTop: 0 }}>
                        <BookOpen size={18} /> Syllabus Covered Today
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                        {activeClass?.book1Name && (
                            <div>
                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{activeClass.book1Name}</span>
                                {report.book1CoveredPages && report.book1CoveredPages.length > 0 ? (
                                    <>
                                        <p style={{ margin: '0.25rem 0 0 0', fontWeight: 500, color: 'var(--success)' }}>Pages detected: {report.book1CoveredPages.join(', ')}</p>
                                        {activeClass?.book1TotalPages && (
                                            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                                                <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.25rem' }}>
                                                    <div style={{ height: '100%', background: 'var(--primary)', width: `${Math.min((report.book1CoveredPages.length / activeClass.book1TotalPages) * 100, 100)}%` }}></div>
                                                </div>
                                                <span style={{ fontWeight: 600 }}>+{((report.book1CoveredPages.length / activeClass.book1TotalPages) * 100).toFixed(1)}% progress recorded</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        No exact page numbers were spoken in this transcript.
                                    </p>
                                )}
                            </div>
                        )}
                        {activeClass?.book2Name && (
                            <div>
                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{activeClass.book2Name}</span>
                                {report.book2CoveredPages && report.book2CoveredPages.length > 0 ? (
                                    <>
                                        <p style={{ margin: '0.25rem 0 0 0', fontWeight: 500, color: 'var(--success)' }}>Pages detected: {report.book2CoveredPages.join(', ')}</p>
                                        {activeClass?.book2TotalPages && (
                                            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                                                <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.25rem' }}>
                                                    <div style={{ height: '100%', background: 'var(--primary)', width: `${Math.min((report.book2CoveredPages.length / activeClass.book2TotalPages) * 100, 100)}%` }}></div>
                                                </div>
                                                <span style={{ fontWeight: 600 }}>+{((report.book2CoveredPages.length / activeClass.book2TotalPages) * 100).toFixed(1)}% progress recorded</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        No explicit page mentions found.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(report.teacherSuggestions || report.studentSuggestions) && (
                <div className="row" style={{ marginBottom: '1.5rem' }}>
                    <div className="col" style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', marginTop: 0 }}>
                            <Lightbulb size={18} /> Teacher Suggestions
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                            {report.teacherSuggestions?.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    </div>
                    <div className="col" style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', marginTop: 0 }}>
                            <Lightbulb size={18} /> Student Suggestions
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                            {report.studentSuggestions?.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    </div>
                </div>
            )}

            <div style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Name</th>
                            <th>Attendance (min)</th>
                            <th>Speaking (min)</th>
                            <th>Health %</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.students.map((st, i) => (
                            <tr key={st.name}>
                                <td><span style={{ fontWeight: 700, color: i < 3 ? 'var(--primary)' : 'inherit' }}>#{i + 1}</span></td>
                                <td style={{ fontWeight: 500 }}>{st.name}</td>
                                <td>{st.attendanceMinutes}</td>
                                <td>{st.speakingTimeMinutes.toFixed(2)}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.min(st.healthScore, 100)}%`, background: st.healthScore > 90 ? 'var(--success)' : st.healthScore >= 70 ? 'var(--warning)' : 'var(--danger)' }}></div>
                                        </div>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{st.healthScore.toFixed(1)}%</span>
                                    </div>
                                </td>
                                <td>
                                    <span className={`tag ${st.healthTag === 'Excellent' ? 'tag-excellent' : st.healthTag === 'Good' ? 'tag-good' : 'tag-needs-attention'}`}>
                                        {st.healthTag}
                                    </span>
                                </td>
                                <td>
                                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => { setSelectedStudent(st.name); setView('student_analytics'); }}>
                                        <BarChart2 size={14} /> Analytics
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {report.students.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No students data</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderHistory = () => (
        <div className="animate-fade-in">
            <div className="header-area" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Report History</h2>
                {!currentReport && reports.length > 0 && (
                    <button className="btn btn-secondary" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => {
                        if (confirm('Are you sure you want to delete ALL reports for this class? This cannot be undone.')) {
                            deleteReportsForClass(activeClassId);
                            setReports([]);
                        }
                    }}>
                        <Trash2 size={16} /> Delete All Reports
                    </button>
                )}
            </div>

            {currentReport && (
                <div style={{ marginBottom: '2rem' }}>
                    <button className="btn btn-secondary" onClick={() => setCurrentReport(null)} style={{ marginBottom: '1rem' }}>&larr; Back to list</button>
                    {renderReportResults(currentReport, false)}
                </div>
            )}

            {!currentReport && reports.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <History size={48} style={{ color: 'var(--border)', margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--text-muted)' }}>No reports saved in history.</p>
                </div>
            )}

            {!currentReport && reports.length > 0 && (
                <div className="card">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Topic</th>
                                <th>Students</th>
                                <th>Avg Health Score</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map(r => (
                                <tr key={r.id}>
                                    <td style={{ fontWeight: 500 }}>{r.date}</td>
                                    <td style={{ textTransform: 'capitalize' }}>{r.topic || 'N/A'}</td>
                                    <td>{r.students.length}</td>
                                    <td>
                                        {(r.students.reduce((acc, s) => acc + s.healthScore, 0) / (r.students.length || 1)).toFixed(1)}%
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setCurrentReport(r)}>
                                                View Details
                                            </button>
                                            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', border: 'none' }} title="Delete Report" onClick={() => {
                                                if (confirm('Are you sure you want to delete this report?')) {
                                                    deleteReport(r.id);
                                                    setReports(prev => prev.filter(req => req.id !== r.id));
                                                }
                                            }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const renderStudentAnalytics = () => {
        if (!selectedStudent) return null;

        // Optionally filter by dates
        let sortedReports = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (analyticsStartDate) {
            sortedReports = sortedReports.filter(r => new Date(r.date) >= new Date(analyticsStartDate));
        }
        if (analyticsEndDate) {
            sortedReports = sortedReports.filter(r => new Date(r.date) <= new Date(analyticsEndDate));
        }

        const chartData = sortedReports.map((r, i) => {
            const studentEntry = r.students.find(s => s.name === selectedStudent);
            return {
                dateLabel: `${r.date} (${i + 1})`,
                healthScore: studentEntry ? studentEntry.healthScore : 0,
                attendance: studentEntry ? studentEntry.attendanceMinutes : 0,
                speaking: studentEntry ? studentEntry.speakingTimeMinutes : 0
            };
        });

        // Monthly Aggregation
        const monthlyDataMap: Record<string, { sumScore: number, sumAtt: number, count: number }> = {};
        sortedReports.forEach(r => {
            const studentEntry = r.students.find(s => s.name === selectedStudent);
            if (studentEntry) {
                try {
                    const dateObj = new Date(r.date);
                    if (!isNaN(dateObj.getTime())) {
                        const monthKey = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' }); // e.g., "Jan 2024"
                        if (!monthlyDataMap[monthKey]) monthlyDataMap[monthKey] = { sumScore: 0, sumAtt: 0, count: 0 };
                        monthlyDataMap[monthKey].sumScore += studentEntry.healthScore;
                        monthlyDataMap[monthKey].sumAtt += studentEntry.attendanceMinutes;
                        monthlyDataMap[monthKey].count += 1;
                    }
                } catch (e) { }
            }
        });

        const monthlyChartData = Object.keys(monthlyDataMap).map(key => ({
            monthLabel: key,
            avgHealth: monthlyDataMap[key].sumScore / monthlyDataMap[key].count,
            avgAttendance: monthlyDataMap[key].sumAtt / monthlyDataMap[key].count,
        }));

        const studentRecords = sortedReports.map(r => r.students.find(s => s.name === selectedStudent)).filter(Boolean) as StudentRecord[];
        const avgScore = studentRecords.length ? (studentRecords.reduce((acc, s) => acc + s.healthScore, 0) / studentRecords.length) : 0;
        const avgScoreFormatted = avgScore.toFixed(1);
        const totalSpeaking = studentRecords.reduce((acc, s) => acc + s.speakingTimeMinutes, 0);

        // Generate Detailed Report & Suggestions
        const suggestions: string[] = [];
        if (avgScore > 90) {
            suggestions.push(`${selectedStudent} is performing exceptionally well! Their engagement is consistently high.`);
        } else if (avgScore >= 70) {
            suggestions.push(`${selectedStudent} is doing good, but there's room for improvement in speaking participation.`);
        } else if (studentRecords.length > 0) {
            suggestions.push(`${selectedStudent} needs attention. Their average health score is below 70%.`);
        } else {
            suggestions.push(`No class records found for ${selectedStudent} in the selected date range.`);
        }

        if (studentRecords.length > 0) {
            const avgSpeaking = totalSpeaking / studentRecords.length;
            if (avgSpeaking < 1) {
                suggestions.push(`Their speaking time is very low (${avgSpeaking.toFixed(1)} mins/class avg). Encourage them to participate more in discussions.`);
            } else if (avgSpeaking > 10) {
                suggestions.push(`They are highly active in class discussions (${avgSpeaking.toFixed(1)} mins/class avg). Great leadership skills!`);
            }
        }

        return (
            <div className="animate-fade-in card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn btn-secondary" onClick={() => setView('history')}>&larr; Back</button>
                        <h2 style={{ margin: 0, color: 'var(--primary)' }}>Analytics: {selectedStudent}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>From:</label>
                        <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem' }} value={analyticsStartDate} onChange={e => setAnalyticsStartDate(e.target.value)} />
                        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>To:</label>
                        <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem' }} value={analyticsEndDate} onChange={e => setAnalyticsEndDate(e.target.value)} />
                        <button className="btn btn-secondary" onClick={() => { setAnalyticsStartDate(''); setAnalyticsEndDate(''); }} style={{ padding: '0.25rem 0.5rem' }}>Clear</button>
                    </div>
                </div>

                <div className="row" style={{ marginBottom: '2rem' }}>
                    <div className="col card" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Average Health Score</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{avgScoreFormatted}%</span>
                    </div>
                    <div className="col card" style={{ background: 'var(--warning)', color: 'white', border: 'none' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Total Speaking (History)</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{totalSpeaking.toFixed(1)} mins</span>
                    </div>
                    <div className="col card" style={{ background: 'var(--success)', color: 'white', border: 'none' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Classes Attended</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{studentRecords.length} Classes</span>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem', background: 'rgba(255, 255, 255, 0.5)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginTop: 0, marginBottom: '1rem' }}>
                        <Brain size={20} /> Detailed Performance Report
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </div>

                {monthlyChartData.length > 0 && (
                    <>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--success)' }}>Monthly Progress (Avg Health Score)</h3>
                        <div style={{ height: '350px', width: '100%', marginBottom: '3rem' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="monthLabel" height={60} />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Avg Health']} />
                                    <Bar dataKey="avgHealth" fill="var(--success)" radius={[4, 4, 0, 0]} name="Avg Health (%)" barSize={60} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Monthly Progress (Avg Attendance)</h3>
                        <div style={{ height: '350px', width: '100%', marginBottom: '3rem' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={monthlyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="monthLabel" height={60} />
                                    <YAxis />
                                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)} mins`, 'Avg Attendance']} />
                                    <Line type="monotone" dataKey="avgAttendance" stroke="var(--primary)" strokeWidth={3} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}

                <h3 style={{ marginBottom: '1rem' }}>Per-Class Breakdown - Health Score</h3>
                <div style={{ height: '350px', width: '100%', marginBottom: '2rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="dateLabel" angle={-45} textAnchor="end" height={60} />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Bar dataKey="healthScore" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Health Score (%)" barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <h3 style={{ marginBottom: '1rem' }}>Engagement Breakdown (Minutes)</h3>
                <div style={{ height: '350px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="dateLabel" angle={-45} textAnchor="end" height={60} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="attendance" fill="var(--success)" stackId="a" radius={[0, 0, 0, 0]} name="Attendance (min)" barSize={40} />
                            <Bar dataKey="speaking" fill="var(--warning)" stackId="a" radius={[4, 4, 0, 0]} name="Speaking (min)" barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const renderClassAnalytics = () => {
        let sortedReports = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (analyticsStartDate) {
            sortedReports = sortedReports.filter(r => new Date(r.date) >= new Date(analyticsStartDate));
        }
        if (analyticsEndDate) {
            sortedReports = sortedReports.filter(r => new Date(r.date) <= new Date(analyticsEndDate));
        }

        if (sortedReports.length === 0) {
            return (
                <div className="animate-fade-in card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button className="btn btn-secondary" onClick={() => setView('dashboard')}>&larr; Back</button>
                            <h2 style={{ margin: 0, color: 'var(--primary)' }}>Class Analytics</h2>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>From:</label>
                            <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem' }} value={analyticsStartDate} onChange={e => setAnalyticsStartDate(e.target.value)} />
                            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>To:</label>
                            <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem' }} value={analyticsEndDate} onChange={e => setAnalyticsEndDate(e.target.value)} />
                            <button className="btn btn-secondary" onClick={() => { setAnalyticsStartDate(''); setAnalyticsEndDate(''); }} style={{ padding: '0.25rem 0.5rem' }}>Clear</button>
                        </div>
                    </div>
                    <p style={{ color: 'var(--text-muted)' }}>No reports match this date range.</p>
                </div>
            );
        }

        const statsByStudent: Record<string, { healthSum: number, count: number, speakingSum: number, totalAttendanceMins: number, actualClassesAttended: number, monthly: Record<string, { healthSum: number, count: number }> }> = {};
        const uniqueMonthsSet = new Set<string>();

        sortedReports.forEach(r => {
            let monthKey = '';
            try {
                const d = new Date(r.date);
                if (!isNaN(d.getTime())) {
                    monthKey = d.toLocaleString('default', { month: 'short', year: 'numeric' });
                    uniqueMonthsSet.add(monthKey);
                }
            } catch (e) { }

            r.students.forEach(s => {
                if (!statsByStudent[s.name]) {
                    statsByStudent[s.name] = { healthSum: 0, count: 0, speakingSum: 0, totalAttendanceMins: 0, actualClassesAttended: 0, monthly: {} };
                }
                statsByStudent[s.name].healthSum += Math.max(0, s.healthScore);
                statsByStudent[s.name].count += 1;
                statsByStudent[s.name].speakingSum += s.speakingTimeMinutes;
                statsByStudent[s.name].totalAttendanceMins += s.attendanceMinutes;
                if (s.attendanceMinutes > 5) {
                    statsByStudent[s.name].actualClassesAttended += 1;
                }

                if (monthKey) {
                    if (!statsByStudent[s.name].monthly[monthKey]) {
                        statsByStudent[s.name].monthly[monthKey] = { healthSum: 0, count: 0 };
                    }
                    statsByStudent[s.name].monthly[monthKey].healthSum += Math.max(0, s.healthScore);
                    statsByStudent[s.name].monthly[monthKey].count += 1;
                }
            });
        });

        // Ensure chronological order of months
        const uniqueMonths = Array.from(uniqueMonthsSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        const studentAverages = Object.entries(statsByStudent).map(([name, stats]) => {
            const monthlyAvgs: Record<string, number> = {};
            for (const [m, mdata] of Object.entries(stats.monthly)) {
                monthlyAvgs[m] = mdata.count > 0 ? (mdata.healthSum / mdata.count) : -1;
            }

            return {
                name,
                avgHealth: stats.count > 0 ? stats.healthSum / stats.count : 0,
                avgSpeaking: stats.count > 0 ? stats.speakingSum / stats.count : 0,
                avgAttendanceMins: stats.count > 0 ? stats.totalAttendanceMins / stats.count : 0,
                classesAttended: stats.actualClassesAttended,
                totalClassesPlayed: stats.count,
                monthlyAvgs
            };
        }).sort((a, b) => b.avgHealth - a.avgHealth);

        const classAverageHealth = studentAverages.length > 0 ? studentAverages.reduce((acc, s) => acc + s.avgHealth, 0) / studentAverages.length : 0;

        // Take top and bottom 5 for the charts
        const topStudents = studentAverages.slice(0, 5);
        const needsAttention = studentAverages.slice(-5).reverse();

        return (
            <div className="animate-fade-in card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn btn-secondary" onClick={() => setView('dashboard')}>&larr; Back</button>
                        <h2 style={{ margin: 0, color: 'var(--primary)' }}>Leaderboard & Trends</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>From:</label>
                        <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem' }} value={analyticsStartDate} onChange={e => setAnalyticsStartDate(e.target.value)} />
                        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>To:</label>
                        <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem' }} value={analyticsEndDate} onChange={e => setAnalyticsEndDate(e.target.value)} />
                        <button className="btn btn-secondary" onClick={() => { setAnalyticsStartDate(''); setAnalyticsEndDate(''); }} style={{ padding: '0.25rem 0.5rem' }}>Clear</button>
                    </div>
                </div>

                <div className="row" style={{ marginBottom: '2rem' }}>
                    <div className="col card" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Class Average Health</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{classAverageHealth.toFixed(1)}%</span>
                    </div>
                    <div className="col card" style={{ background: 'var(--warning)', color: 'white', border: 'none' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Total Reports Analyzed</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{sortedReports.length} Classes</span>
                    </div>

                    <div className="row" style={{ marginBottom: '2rem' }}>
                        <div className="col card" style={{ background: 'var(--success)', color: 'white', border: 'none' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Active Students</h4>
                            <span style={{ fontSize: '2rem', fontWeight: 800 }}>{studentAverages.length} Students</span>
                        </div>

                        {activeClass?.book1Name && activeClass.book1TotalPages && (
                            <div className="col card" style={{ background: '#3b82f6', color: 'white', border: 'none' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>{activeClass.book1Name}</h4>
                                <div style={{ display: 'flex', alignItems: 'end', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '2rem', fontWeight: 800 }}>
                                        {Math.round((new Set(sortedReports.flatMap(r => r.book1CoveredPages || [])).size / activeClass.book1TotalPages) * 100)}%
                                    </span>
                                    <span style={{ opacity: 0.8, marginBottom: '0.5rem' }}>Completed</span>
                                </div>
                            </div>
                        )}

                        {activeClass?.book2Name && activeClass.book2TotalPages && (
                            <div className="col card" style={{ background: '#8b5cf6', color: 'white', border: 'none' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>{activeClass.book2Name}</h4>
                                <div style={{ display: 'flex', alignItems: 'end', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '2rem', fontWeight: 800 }}>
                                        {Math.round((new Set(sortedReports.flatMap(r => r.book2CoveredPages || [])).size / activeClass.book2TotalPages) * 100)}%
                                    </span>
                                    <span style={{ opacity: 0.8, marginBottom: '0.5rem' }}>Completed</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="row">
                        <div className="col">
                            <h3 style={{ marginBottom: '1rem', color: 'var(--success)' }}>Top 5 Students (Timeframe)</h3>
                            <div style={{ height: '350px', width: '100%', marginBottom: '2rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topStudents} margin={{ top: 20, right: 30, left: 0, bottom: 65 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                                        <YAxis domain={[0, 100]} />
                                        <Tooltip />
                                        <Bar dataKey="avgHealth" fill="var(--success)" radius={[4, 4, 0, 0]} name="Avg Health (%)" barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="col">
                            <h3 style={{ marginBottom: '1rem', color: 'var(--danger)' }}>Needs Attention (Timeframe)</h3>
                            <div style={{ height: '350px', width: '100%', marginBottom: '2rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={needsAttention} margin={{ top: 20, right: 30, left: 0, bottom: 65 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                                        <YAxis domain={[0, 100]} />
                                        <Tooltip />
                                        <Bar dataKey="avgHealth" fill="var(--danger)" radius={[4, 4, 0, 0]} name="Avg Health (%)" barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ marginTop: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Detailed Data (Excel Format)</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Name</th>
                                        <th>Classes Attended</th>
                                        <th>Avg Attendance (min)</th>
                                        <th>Overall Health Score</th>
                                        {uniqueMonths.map(m => <th key={m}>{m} Health</th>)}
                                        <th>Status Tracker</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentAverages.map((st, i) => {
                                        // Calculate if their most recent month is significantly lower than average
                                        let needsContact = false;
                                        if (uniqueMonths.length > 0) {
                                            const lastMonth = uniqueMonths[uniqueMonths.length - 1];
                                            const lastHealth = st.monthlyAvgs[lastMonth];
                                            if (lastHealth !== undefined && lastHealth < 70 && lastHealth < st.avgHealth - 10) {
                                                needsContact = true;
                                            }
                                        }

                                        return (
                                            <tr key={st.name}>
                                                <td><span style={{ fontWeight: 700, color: i < 3 ? 'var(--primary)' : 'inherit' }}>#{i + 1}</span></td>
                                                <td style={{ fontWeight: 600 }}>{st.name}</td>
                                                <td>{st.classesAttended} / {st.totalClassesPlayed}</td>
                                                <td>{st.avgAttendanceMins.toFixed(1)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${Math.min(st.avgHealth, 100)}%`, background: st.avgHealth > 90 ? 'var(--success)' : st.avgHealth >= 70 ? 'var(--warning)' : 'var(--danger)' }}></div>
                                                        </div>
                                                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{st.avgHealth.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                                {uniqueMonths.map(m => {
                                                    const mVal = st.monthlyAvgs[m];
                                                    if (mVal === undefined || mVal < 0) {
                                                        return <td key={m} style={{ color: 'var(--text-muted)' }}>-</td>;
                                                    }
                                                    const c = mVal > 90 ? 'var(--success)' : mVal >= 70 ? 'var(--warning)' : 'var(--danger)';
                                                    return (
                                                        <td key={m} style={{ color: c, fontWeight: 700 }}>
                                                            {mVal.toFixed(1)}%
                                                        </td>
                                                    );
                                                })}
                                                <td>
                                                    {needsContact ? (
                                                        <a href={`mailto:?subject=Checking in on your Class Progress&body=Hi ${st.name},%0D%0A%0D%0AI noticed a drop in your recent class engagement.`} className="tag tag-needs-attention" style={{ textDecoration: 'none', cursor: 'pointer', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                                            Contact Now
                                                        </a>
                                                    ) : (
                                                        <span className={`tag ${st.avgHealth > 90 ? 'tag-excellent' : st.avgHealth >= 70 ? 'tag-good' : 'tag-needs-attention'}`}>
                                                            {st.avgHealth > 90 ? 'Excellent' : st.avgHealth >= 70 ? 'Good' : 'Needs Attention'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    const renderGlobalAnalytics = () => {
        const allReports = getReports();
        const allClasses = classes;

        const batchStats: Record<string, { id: string, healthSum: number, count: number, name: string, studentCount: number, createdAt: string }> = {};

        allClasses.forEach(c => {
            batchStats[c.id] = {
                id: c.id,
                healthSum: 0,
                count: 0,
                name: c.name,
                studentCount: c.fixedStudents ? c.fixedStudents.length : 0,
                createdAt: c.createdAt
            };
        });

        allReports.forEach(r => {
            if (batchStats[r.classId]) {
                const reportHealth = r.students.length > 0 ? r.students.reduce((sum, s) => sum + s.healthScore, 0) / r.students.length : 0;
                batchStats[r.classId].healthSum += reportHealth;
                batchStats[r.classId].count += 1;
            }
        });

        const compareData = Object.values(batchStats)
            .filter(b => b.count > 0 || b.studentCount > 0)
            .map(b => {
                const msPassed = new Date().getTime() - new Date(b.createdAt).getTime();
                const weeks = Math.max(0, Math.floor(msPassed / (1000 * 60 * 60 * 24 * 7)));
                return {
                    id: b.id,
                    name: b.name,
                    avgHealth: b.count > 0 ? b.healthSum / b.count : 0,
                    avgHealthFormatted: (b.count > 0 ? b.healthSum / b.count : 0).toFixed(1),
                    totalClasses: b.count,
                    studentCount: b.studentCount,
                    weeksActive: weeks
                };
            }).sort((a, b) => b.avgHealth - a.avgHealth);

        return (
            <div className="animate-fade-in card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn btn-secondary" onClick={() => setView('dashboard')}>&larr; Back</button>
                        <h2 style={{ margin: 0, color: 'var(--primary)' }}>Global Compare All Batches</h2>
                    </div>
                </div>

                <div className="row" style={{ marginBottom: '2rem' }}>
                    <div className="col card" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Total Branches/Batches Analyzed</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{compareData.length}</span>
                    </div>
                    <div className="col card" style={{ background: 'var(--warning)', color: 'white', border: 'none' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', opacity: 0.9 }}>Total Lessons Logged Global</h4>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{allReports.length}</span>
                    </div>
                </div>

                {compareData.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No data to compare across multiple batches yet. Try uploading reports for multiple different batches.</p>
                ) : (
                    <>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--success)' }}>Average Health Score by Batch</h3>
                        <div style={{ height: '400px', width: '100%', marginBottom: '2rem' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={compareData} margin={{ top: 20, right: 30, left: 0, bottom: 65 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Avg Health Score']} />
                                    <Bar dataKey="avgHealth" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <h3 style={{ marginBottom: '1rem' }}>Batch Details</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Batch Name</th>
                                        <th>Students Logged</th>
                                        <th>Weeks Since Start</th>
                                        <th>Lessons Logged</th>
                                        <th>Avg Health Score</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {compareData.map((b, i) => (
                                        <tr key={b.name}>
                                            <td><span style={{ fontWeight: 700, color: i < 3 ? 'var(--primary)' : 'inherit' }}>#{i + 1}</span></td>
                                            <td style={{ fontWeight: 500 }}>{b.name}</td>
                                            <td>{b.studentCount} Students</td>
                                            <td>{b.weeksActive} Weeks</td>
                                            <td>{b.totalClasses} Lessons</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${Math.min(b.avgHealth, 100)}%`, background: b.avgHealth > 90 ? 'var(--success)' : b.avgHealth >= 70 ? 'var(--warning)' : b.avgHealth > 0 ? 'var(--danger)' : 'var(--border)' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{b.avgHealthFormatted}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                {b.avgHealth > 0 ? (
                                                    <span className={`tag ${b.avgHealth > 90 ? 'tag-excellent' : b.avgHealth >= 70 ? 'tag-good' : 'tag-needs-attention'}`}>
                                                        {b.avgHealth > 90 ? 'Excellent' : b.avgHealth >= 70 ? 'Good' : 'Needs Attention'}
                                                    </span>
                                                ) : (
                                                    <span className="tag" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>No Data</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(`Are you sure you want to completely delete "${b.name}" and all of its corresponding reports?`)) {
                                                            handleDeleteClass(b.id);
                                                        }
                                                    }}
                                                    style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.5rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title={`Permanently delete ${b.name}`}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const handleSetupComplete = (teacherName: string, students: string[], book1Name: string, book1TotalPages: number, book2Name: string, book2TotalPages: number) => {
        const newClass: ClassData = {
            id: derivedClassId,
            language: selectedLanguage,
            level: selectedLevel,
            batch: selectedBatch,
            name: `${selectedLanguage} ${selectedLevel} (Batch ${selectedBatch})`,
            createdAt: new Date().toISOString(),
            teacherName,
            fixedStudents: students,
            book1Name,
            book1TotalPages,
            book2Name,
            book2TotalPages
        };
        const updated = [...classes, newClass];
        setClasses(updated);
        saveClasses(updated);
        setTeacherName(teacherName);
        setFixedStudentsText(students.join(', '));
        setView('dashboard');
    };

    if (!appUnlocked) {
        return (
            <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
                <div className="card animate-fade-in" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                    <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>Protected Dashboard</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>Please enter the master password to access.</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const val = (e.currentTarget.elements.namedItem('pwd') as HTMLInputElement).value;
                        if (val === 'skillcase2024') { 
                            localStorage.setItem('health_analyzer_unlocked', 'true');
                            setAppUnlocked(true);
                        } else {
                            alert('Incorrect Password');
                            (e.currentTarget.elements.namedItem('pwd') as HTMLInputElement).value = '';
                        }
                    }}>
                        <input
                            type="password"
                            name="pwd"
                            placeholder="Enter Password"
                            required
                            autoFocus
                            className="form-control"
                            style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2rem', marginBottom: '1rem', padding: '1rem' }}
                        />
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>Login to Dashboard</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container" style={{ flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            <TopBar
                view={view}
                setView={(v: 'dashboard' | 'attendance' | 'global_analytics' | 'directory' | 'payments') => { setView(v); if (v !== 'payments') setPaymentsUnlocked(false); }}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
                selectedLevel={selectedLevel}
                setSelectedLevel={setSelectedLevel}
                selectedBatch={selectedBatch}
                setSelectedBatch={setSelectedBatch}
            />

            <main className="main-content" style={{ display: 'flex', flexDirection: 'column', padding: '2rem', overflowY: 'auto' }}>
                {view === 'global_analytics' && renderGlobalAnalytics()}

                {view !== 'global_analytics' && view !== 'payments' && view !== 'directory' && !activeClass && (
                    <ClassSetup
                        classId={derivedClassId}
                        language={selectedLanguage}
                        level={selectedLevel}
                        batch={selectedBatch}
                        onSetupComplete={handleSetupComplete}
                    />
                )}

                {activeClass && view === 'attendance' && (
                    <AttendanceRecordBook activeClass={activeClass} />
                )}

                {view === 'directory' && (
                    <StudentDirectory classes={classes} onDeleteClass={handleDeleteClass} />
                )}

                {view === 'payments' && (
                    paymentsUnlocked ? (
                        <PaymentsTracker classes={classes} onDeleteClass={handleDeleteClass} />
                    ) : (
                        <div className="card animate-fade-in" style={{ maxWidth: '400px', margin: '4rem auto', textAlign: 'center', padding: '2.5rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                            <h3 style={{ marginTop: 0, color: 'var(--primary)' }}>Payments — Protected</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Enter your PIN to access payment records.</p>
                            <form onSubmit={e => {
                                e.preventDefault();
                                const pin = (e.currentTarget.elements.namedItem('paypin') as HTMLInputElement).value;
                                if (pin === '1234') {
                                    setPaymentsUnlocked(true);
                                } else {
                                    alert('Incorrect PIN. Please try again.');
                                    (e.currentTarget.elements.namedItem('paypin') as HTMLInputElement).value = '';
                                }
                            }}>
                                <input
                                    name="paypin"
                                    type="password"
                                    maxLength={8}
                                    placeholder="Enter PIN"
                                    autoFocus
                                    className="form-control"
                                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem', marginBottom: '1rem' }}
                                />
                                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Unlock Payments</button>
                            </form>
                        </div>
                    )
                )}

                {activeClass && view !== 'attendance' && view !== 'global_analytics' && view !== 'directory' && view !== 'payments' && (
                    <>
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.5rem', borderRadius: '0.5rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem', width: 'fit-content' }}>
                            <button className={`btn ${view === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} style={{ border: 'none' }} onClick={() => setView('dashboard')}>
                                <LayoutDashboard size={18} /> Overview
                            </button>
                            <button className={`btn ${view === 'new_report' ? 'btn-primary' : 'btn-secondary'}`} style={{ border: 'none' }} onClick={() => setView('new_report')}>
                                <UploadCloud size={18} /> Upload Data
                            </button>
                            <button className={`btn ${view === 'history' ? 'btn-primary' : 'btn-secondary'}`} style={{ border: 'none' }} onClick={() => setView('history')}>
                                <History size={18} /> Upload History
                            </button>
                            <button className={`btn ${view === 'class_analytics' ? 'btn-primary' : 'btn-secondary'}`} style={{ border: 'none' }} onClick={() => setView('class_analytics')}>
                                <BarChart2 size={18} /> Class Analytics
                            </button>
                        </div>

                        {view === 'dashboard' && renderDashboard()}
                        {view === 'new_report' && renderNewReport()}
                        {view === 'history' && renderHistory()}
                        {view === 'student_analytics' && renderStudentAnalytics()}
                        {view === 'class_analytics' && renderClassAnalytics()}
                    </>
                )}
            </main>

            {/* Wise Integration Modal */}
            {showWiseModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}>
                    <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', margin: '2rem' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--primary)', marginBottom: '1.5rem' }}>Import from Wise LMS</h3>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label>Wise User ID (Optional)</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Leave blank if using a Bearer token"
                                value={wiseUserId}
                                onChange={e => setWiseUserId(e.target.value)}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only required if using HTTP Basic Auth (User + Key Format).</p>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label>Wise API Token</label>
                            <input
                                type="password"
                                className="form-control"
                                placeholder="Paste your Wise Tutor API Token here"
                                value={wiseApiKey}
                                onChange={e => setWiseApiKey(e.target.value)}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>You can generate this in your Wise account settings.</p>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label>Institute Namespace</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. acme_institute"
                                value={wiseNamespace}
                                onChange={e => setWiseNamespace(e.target.value)}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Required for most endpoints to identify your specific school or organization within Wise.</p>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label>Course / Class Database ID (Optional)</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. 68e787ccc6685941d61144a8"
                                value={wiseClassId}
                                onChange={e => setWiseClassId(e.target.value)}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Leave blank to auto-fetch the most recently completed class.</p>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label>Session Database ID (Optional)</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. 6912e9eba1d105bb09a6c951"
                                value={wiseSessionId}
                                onChange={e => setWiseSessionId(e.target.value)}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Leave blank to auto-fetch the most recently completed session.</p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowWiseModal(false)} disabled={isWiseLoading}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleFetchFromWise} disabled={isWiseLoading}>
                                {isWiseLoading ? 'Connecting...' : 'Fetch Attendance & Transcript'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


export default App;
