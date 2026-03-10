import * as pdfjsLib from 'pdfjs-dist';

// Use Vite's native worker URL resolution to avoid CORS and CDN issues
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

export const extractTextFromPdf = async (file: File): Promise<string[]> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const maxPages = pdf.numPages;
        const pageTextPromises = [];

        for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
            const page = await pdf.getPage(pageNo);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            pageTextPromises.push(pageText);
        }

        return pageTextPromises; // return array of pages
    } catch (e) {
        console.error('PDF extraction failed:', e);
        throw e;
    }
};

export const getPdfPageCount = async (file: File): Promise<number> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        return pdf.numPages;
    } catch (e) {
        console.error('PDF page count failed:', e);
        return 0;
    }
};
