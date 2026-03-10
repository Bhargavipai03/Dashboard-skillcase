import { DailyReport } from '../types';
import * as XLSX from 'xlsx';

export const downloadJSON = (report: DailyReport, className: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${className}_Report_${report.date}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

export const downloadCSV = (report: DailyReport, className: string) => {
    const headers = ["Rank", "Name", "Attendance (min)", "Speaking (min)", "Health Score (%)", "Health Tag"];

    const csvRows = [headers.join(",")];

    // They are already supposed to be sorted but let's just use them
    report.students.forEach((student, index) => {
        const row = [
            index + 1,
            `"${student.name}"`,
            student.attendanceMinutes.toFixed(2),
            student.speakingTimeMinutes.toFixed(2),
            student.healthScore.toFixed(2),
            student.healthTag
        ];
        csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    downloadAnchorNode.setAttribute("download", `${className}_Report_${report.date}.csv`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

export const downloadExcel = (report: DailyReport, className: string) => {
    const data = report.students.map((student, index) => ({
        Rank: index + 1,
        Name: student.name,
        "Attendance (min)": student.attendanceMinutes.toFixed(2),
        "Speaking (min)": student.speakingTimeMinutes.toFixed(2),
        "Health Score (%)": student.healthScore.toFixed(2),
        "Health Tag": student.healthTag
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    XLSX.writeFile(workbook, `${className}_Report_${report.date}.xlsx`);
};
