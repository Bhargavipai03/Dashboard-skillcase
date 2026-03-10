import { ClassData, DailyReport, ManualAttendanceRecord } from '../types';

const CLASS_STORAGE_KEY = 'health_analyzer_classes';
const REPORT_STORAGE_KEY = 'health_analyzer_reports';

export const getClasses = (): ClassData[] => {
    const data = localStorage.getItem(CLASS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveClasses = (classes: ClassData[]) => {
    localStorage.setItem(CLASS_STORAGE_KEY, JSON.stringify(classes));
};

const ATTENDANCE_STORAGE_KEY = 'health_analyzer_manual_attendance';

export const getManualAttendance = (): ManualAttendanceRecord[] => {
    const data = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveManualAttendance = (records: ManualAttendanceRecord[]) => {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(records));
};

export const updateSingleManualAttendance = (classId: string, date: string, records: Record<string, 'P' | 'A'>) => {
    const all = getManualAttendance();
    const existingIdx = all.findIndex(a => a.classId === classId && a.date === date);
    if (existingIdx >= 0) {
        all[existingIdx].records = records;
    } else {
        all.push({ classId, date, records });
    }
    saveManualAttendance(all);
};

export const getReports = (): DailyReport[] => {
    const data = localStorage.getItem(REPORT_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveReport = (report: DailyReport) => {
    const reports = getReports();
    // Update if exists, else append
    const idx = reports.findIndex(r => r.id === report.id);
    if (idx >= 0) {
        reports[idx] = report;
    } else {
        reports.push(report);
    }
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
};

export const getReportsByClass = (classId: string): DailyReport[] => {
    return getReports().filter(r => r.classId === classId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const deleteReport = (reportId: string) => {
    const reports = getReports();
    const filtered = reports.filter(r => r.id !== reportId);
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(filtered));
};

export const deleteReportsForClass = (classId: string) => {
    const reports = getReports();
    const filtered = reports.filter(r => r.classId !== classId);
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(filtered));
};
