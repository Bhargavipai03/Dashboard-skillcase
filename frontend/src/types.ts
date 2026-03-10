export interface ClassData {
    id: string; // typically language-level-batch
    language: string;
    level: string;
    batch: string;
    name: string;
    createdAt: string;
    teacherName?: string;
    fixedStudents?: string[];
    book1Name?: string;
    book1TotalPages?: number;
    book2Name?: string;
    book2TotalPages?: number;
}

export interface StudentRecord {
    name: string;
    attendanceMinutes: number;
    speakingTimeMinutes: number;
    healthScore: number;
    healthTag: 'Excellent' | 'Good' | 'Needs Attention';
    testScore?: number; // For future test formula
}

export interface DailyReport {
    id: string;
    classId: string;
    date: string;
    durationMinutes: number;
    students: StudentRecord[];
    topic?: string;
    studentSuggestions?: string[];
    teacherSuggestions?: string[];
    includesTest?: boolean;
    book1CoveredPages?: number[];
    book2CoveredPages?: number[];
}

export interface ManualAttendanceRecord {
    classId: string;
    date: string;
    records: Record<string, 'P' | 'A'>; // studentName -> Present/Absent
}

export interface SpeakingData {
    speakerName: string;
    speakingTimeMinutes: number;
}
