export const parseVttContent = (vttText: string): Record<string, number> => {
    const speakingTimesMap: Record<string, number> = {};

    // Normalize newlines
    const text = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // A VTT file typically has blocks separated by double newlines.
    const blocks = text.split('\n\n');

    const parseTimeLine = (line: string): number => {
        const parts = line.split(' --> ');
        if (parts.length !== 2) return 0;

        const timeToSeconds = (timeStr: string) => {
            const parts = timeStr.trim().split(':');
            let seconds = 0;
            if (parts.length === 3) {
                // HH:MM:SS.mmm
                seconds += parseInt(parts[0], 10) * 3600;
                seconds += parseInt(parts[1], 10) * 60;
                seconds += parseFloat(parts[2]);
            } else if (parts.length === 2) {
                // MM:SS.mmm
                seconds += parseInt(parts[0], 10) * 60;
                seconds += parseFloat(parts[1]);
            }
            return seconds || 0;
        };

        const start = timeToSeconds(parts[0]);
        const end = timeToSeconds(parts[1]);
        return Math.max(0, end - start);
    };

    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) continue;

        // Find timestamp line
        const timeIdx = lines.findIndex(l => l.includes(' --> '));
        if (timeIdx === -1) continue;

        const durationSeconds = parseTimeLine(lines[timeIdx]);

        // The dialogue usually immediately follows the timestamp
        for (let i = timeIdx + 1; i < lines.length; i++) {
            const dialogLine = lines[i];

            // Try matching `<v SpeakerName>text` (Standard Zoom WebVTT format)
            const vMatch = dialogLine.match(/^<v\s+([^>]+)>/);
            if (vMatch) {
                const speakerName = vMatch[1].trim();
                speakingTimesMap[speakerName] = (speakingTimesMap[speakerName] || 0) + durationSeconds;
                break;
            }

            // Try matching `Speaker Name:` (Standard Text format)
            const colonMatch = dialogLine.match(/^([^:]+):/);
            if (colonMatch) {
                const speakerName = colonMatch[1].trim();
                // prevent false positives like "00" or just numbers
                if (!/^[0-9]+$/.test(speakerName)) {
                    speakingTimesMap[speakerName] = (speakingTimesMap[speakerName] || 0) + durationSeconds;
                    break;
                }
            }
        }
    }

    // Convert to minutes
    const result: Record<string, number> = {};
    for (const [speaker, sec] of Object.entries(speakingTimesMap)) {
        result[speaker] = sec / 60; // Keep fractional minutes
    }

    return result;
};

// Generate insights from transcript explicitly based on engagement data
export const analyzeTranscript = (vttText: string, teacherName: string, speakingData: Record<string, number>, duration: number, classLanguage?: string, classLevel?: string) => {
    // 1. Smarter Topic Extraction
    // Get all speaker names to exclude them from topic words
    const speakerNames = Object.keys(speakingData).flatMap(n =>
        n.toLowerCase().split(/\s+/)
    );

    // Comprehensive stop-words list (English + German common words + filler)
    const stopWords = new Set([
        // English filler / common
        'there', 'where', 'which', 'about', 'would', 'could', 'should', 'these', 'those',
        'because', 'right', 'okay', 'like', 'just', 'know', 'think', 'really', 'going',
        'actually', 'something', 'everything', 'anything', 'nothing', 'that', 'this',
        'with', 'from', 'have', 'will', 'been', 'were', 'they', 'their', 'them', 'what',
        'when', 'then', 'much', 'some', 'also', 'very', 'your', 'into', 'more', 'over',
        'make', 'good', 'yeah', 'come', 'look', 'guys', 'said', 'want', 'need', 'mean',
        'sure', 'well', 'done', 'next', 'time', 'back', 'here', 'okay', 'okay', 'can',
        'now', 'understand', 'see', 'say', 'tell', 'give', 'take', 'call', 'read',
        'class', 'teacher', 'student', 'lesson', 'today', 'yesterday', 'tomorrow',
        'everyone', 'anybody', 'somebody', 'please', 'thank', 'thanks', 'hello', 'welcome',
        'start', 'begin', 'end', 'finish', 'doing', 'going', 'using', 'getting',
        // German filler / common
        'auch', 'aber', 'oder', 'haben', 'sein', 'werden', 'kann', 'dass', 'nicht',
        'eine', 'einen', 'einem', 'einer', 'eines', 'dieser', 'diese', 'dieses',
        'sind', 'wird', 'wird', 'wird', 'wie', 'und', 'der', 'die', 'das', 'den',
        'dem', 'des', 'ein', 'kein', 'noch', 'dann', 'wenn', 'weil', 'nach', 'bei',
        'mit', 'von', 'aus', 'auf', 'für', 'über', 'unter', 'durch', 'ohne',
        'mach', 'hast', 'bist', 'kann', 'will', 'soll', 'muss', 'darf', 'mag',
        'gut', 'okay', 'bitte', 'danke', 'nein', 'hier', 'dort', 'immer', 'schon',
        // Names / pronouns
        'hello', 'okay', 'hmm', 'uhh', 'ahh', 'yeah', 'yep', 'nope',
        'alright', 'great', 'perfect', 'exactly', 'correct', 'wrong'
    ]);

    // Extract all dialogue lines (remove timestamp and metadata lines from VTT)
    const dialogueLines = vttText
        .split('\n')
        .filter(l => !l.includes('-->') && !/^WEBVTT/i.test(l) && !/^\d+$/.test(l.trim()))
        .join(' ');

    // Strip speaker names pattern (e.g., "John Doe:") from dialogue
    const cleanedDialogue = dialogueLines
        .replace(/[a-zA-Z\s\-\.]+:/g, ' ') // remove "Speaker Name:" labels
        .toLowerCase()
        .replace(/[^a-zäöüß0-9\s]/gi, ' '); // keep German umlauts and numbers

    // --- NEW: Syllabus Page Number Extraction ---
    // Extract pages directly mentioned (page 12, seite 45, seite zwölf, etc)
    const numberWords: Record<string, number> = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
        'eins': 1, 'zwei': 2, 'drei': 3, 'vier': 4, 'fünf': 5, 'fuenf': 5, 'sechs': 6, 'sieben': 7, 'acht': 8, 'neun': 9, 'zehn': 10,
        'elf': 11, 'zwölf': 12, 'zwoelf': 12, 'dreizehn': 13, 'vierzehn': 14, 'fünfzehn': 15, 'sechzehn': 16, 'siebzehn': 17, 'achtzehn': 18, 'neunzehn': 19, 'zwanzig': 20,
        'einundzwanzig': 21, 'zweiundzwanzig': 22, 'dreiundzwanzig': 23, 'vierundzwanzig': 24, 'fünfundzwanzig': 25, 'sechsundzwanzig': 26, 'siebenundzwanzig': 27, 'achtundzwanzig': 28, 'neunundzwanzig': 29, 'dreißig': 30
    };
    const numPattern = Object.keys(numberWords).join('|');
    const pageRegex = new RegExp(`(?:page|seite|p\\.|s\\.)\\s*(\\d+|${numPattern})`, 'gi');

    const inferredPagesSet = new Set<number>();
    let pageMatch;
    while ((pageMatch = pageRegex.exec(cleanedDialogue)) !== null) {
        const matchedVal = pageMatch[1].toLowerCase();
        let pageNum = parseInt(matchedVal, 10);
        if (isNaN(pageNum) && numberWords[matchedVal]) {
            pageNum = numberWords[matchedVal];
        }

        if (pageNum > 0 && pageNum < 1000) {
            inferredPagesSet.add(pageNum);
        }
    }
    const inferredPages = Array.from(inferredPagesSet).sort((a, b) => a - b);

    // Continue with word frequency extraction, filtering out numbers now
    const wordsArr = cleanedDialogue
        .replace(/[0-9]+/g, ' ') // strip digits for topic modeling
        .split(/\s+/)
        .filter(w => {
            if (w.length < 3) return false;
            if (stopWords.has(w)) return false;
            // Exclude speaker name fragments
            if (speakerNames.some(n => n === w || (n.length > 3 && w === n))) return false;
            return true;
        });

    const freqs: Record<string, number> = {};
    for (const w of wordsArr) freqs[w] = (freqs[w] || 0) + 1;

    let topic = 'General Discussion';

    // --- NEW: Syllabus Module Mapping (Netzwerk Neu A1 & A2) ---
    if (classLanguage?.toLowerCase() === 'german') {
        let modules: any[] = [];

        if (classLevel?.toUpperCase() === 'A1') {
            modules = [
                { name: "Kapitel 1: Guten Tag!", pageStart: 8, pageEnd: 18, keywords: ["hallo", "guten", "tag", "heißen", "name", "sprachen", "tschüss", "wiedersehen", "buchstabieren", "alphabet", "länder", "vorstellen", "zahlen"] },
                { name: "Kapitel 2: Freunde, Kollegen und ich", pageStart: 19, pageEnd: 27, keywords: ["freunde", "kollegen", "beruf", "hobby", "hobbys", "wochentage", "zahlen", "arbeit", "arbeitszeiten", "formular", "deutsch", "artikel"] },
                { name: "Kapitel 3: In Hamburg", pageStart: 28, pageEnd: 37, keywords: ["hamburg", "plätze", "gebäude", "richtungen", "verkehrsmittel", "bus", "links", "rechts", "geradeaus", "hobbys", "monate", "jahreszeiten"] },
                { name: "Kapitel 4: Guten Appetit!", pageStart: 44, pageEnd: 53, keywords: ["essen", "trinken", "appetit", "frühstück", "mittagessen", "abendessen", "kaufen", "supermarkt", "restaurant", "obst", "gemüse", "fleisch", "getränke", "mahlzeiten", "lebensmittel", "möchten", "akkusativ"] },
                { name: "Kapitel 5: Alltag und Familie", pageStart: 54, pageEnd: 63, keywords: ["alltag", "familie", "uhrzeit", "uhr", "tagesablauf", "morgens", "mittags", "abends", "aufstehen", "tagesablauf", "termin", "verspätung", "entschuldigung", "modalverben", "müssen", "können", "wollen"] },
                { name: "Kapitel 6: Zeit mit Freunden", pageStart: 64, pageEnd: 73, keywords: ["freizeit", "kino", "theater", "konzert", "ausflug", "schwimmen", "verabreden", "einladung", "geburtstag", "ordinalzahlen", "datum", "veranstaltungen", "trennbare", "präteritum"] },
                { name: "Kapitel 7: Arbeitsalltag", pageStart: 80, pageEnd: 89, keywords: ["arbeitsalltag", "büroalltag", "ortsangaben", "bank", "medien", "abläufe", "briefe", "artikel", "dativ", "präposition", "small talk", "stress"] },
                { name: "Kapitel 8: Fit und gesund", pageStart: 90, pageEnd: 99, keywords: ["gesund", "arzt", "krank", "schmerzen", "kopf", "bauch", "rücken", "bein", "arm", "apotheke", "medikament", "sport", "fitness", "körper", "krankheiten", "imperativ", "tipps"] },
                { name: "Kapitel 9: Meine Wohnung", pageStart: 100, pageEnd: 109, keywords: ["zimmer", "wohnung", "haus", "möbel", "bett", "tisch", "stuhl", "schrank", "sofa", "küche", "bad", "balkon", "mieten", "wohnungsanzeigen", "farben", "wohnformen", "adjektiv"] },
                { name: "Kapitel 10: Studium und Beruf", pageStart: 116, pageEnd: 125, keywords: ["studium", "berufe", "jobs", "arbeitsorte", "bewerbungen", "perfekt", "partizip", "regelmäßige", "unregelmäßige", "haben", "sein", "tagesablauf", "vergangenes", "jobsuche"] },
                { name: "Kapitel 11: Die Jacke gefällt mir!", pageStart: 126, pageEnd: 135, keywords: ["jacke", "kleidung", "mode", "hose", "pullover", "schuhe", "hemd", "shirt", "farbe", "kaufhaus", "komplimente", "welcher", "dieser", "personalpronomen", "dativ", "verben mit dativ"] },
                { name: "Kapitel 12: Ab in den Urlaub!", pageStart: 136, pageEnd: 145, keywords: ["urlaub", "reise", "koffer", "packen", "hotel", "strand", "berge", "meer", "sommer", "winter", "sonne", "regen", "schnee", "reiseziele", "sehenswürdigkeiten", "himmelsrichtungen", "postkarte", "wegbeschreibung"] }
            ];
        } else if (classLevel?.toUpperCase() === 'A2') {
            modules = [
                { name: "Kapitel 1: Und was machst du?", pageStart: 8, pageEnd: 17, keywords: ["machen", "vergangen", "bericht", "verabreden", "begründen", "restaurant", "essen", "freizeit", "tätigkeiten"] },
                { name: "Kapitel 2: Nach der Schulzeit", pageStart: 18, pageEnd: 27, keywords: ["schulzeit", "erfahrung", "meinung", "schule", "fach", "schultyp", "präsentieren", "schulfächer"] },
                { name: "Kapitel 3: Immer online?", pageStart: 28, pageEnd: 37, keywords: ["online", "nachteile", "vorteile", "vergleiche", "interview", "medien", "film", "kino", "aktivitäten"] },
                { name: "Kapitel 4: Große und kleine Gefühle", pageStart: 44, pageEnd: 53, keywords: ["gefühle", "glückwunsch", "bedanken", "freude", "ereignis", "veranstaltung", "fest", "dank"] },
                { name: "Kapitel 5: Leben in der Stadt", pageStart: 54, pageEnd: 63, keywords: ["stadt", "bewerbung", "bank", "behörde", "norden", "wien", "vorstellungsgespräch"] },
                { name: "Kapitel 6: Arbeitswelten", pageStart: 64, pageEnd: 73, keywords: ["arbeit", "beruf", "fahrkarte", "telefonieren", "freizeit", "reisen", "arbeitswelt", "tätigkeiten"] },
                { name: "Kapitel 7: Ganz schön mobil", pageStart: 80, pageEnd: 89, keywords: ["mobil", "verkehr", "weg", "zug", "auto", "geschichte", "unterwegs", "öffentlicher"] },
                { name: "Kapitel 8: Gelernt ist gelernt!", pageStart: 90, pageEnd: 99, keywords: ["lernen", "berufsalltag", "ratschlag", "prüfung", "präsentation", "nachbar", "interview"] },
                { name: "Kapitel 9: Sportlich, sportlich", pageStart: 100, pageEnd: 109, keywords: ["sport", "hoffnung", "enttäuschung", "wettbewerb", "verein", "verabredungen", "fans"] },
                { name: "Kapitel 10: Zusammen leben", pageStart: 116, pageEnd: 125, keywords: ["zusammen", "umziehen", "tiere", "wg", "haustiere", "gefallen", "nachbarn", "wohnen"] },
                { name: "Kapitel 11: Wie die Zeit vergeht!", pageStart: 126, pageEnd: 135, keywords: ["zeit", "wünsche", "pläne", "sprichwort", "traum", "freizeit", "vergeht", "weihnachten", "silvester"] },
                { name: "Kapitel 12: Gute Unterhaltung!", pageStart: 136, pageEnd: 145, keywords: ["unterhaltung", "festival", "musik", "band", "malerei", "bild", "musiker", "feiern", "kunst"] }
            ];
        }

        if (modules.length > 0) {
            let bestModule: typeof modules[0] | null = null;
            let highestScore = 0;

            for (const mod of modules) {
                let score = 0;
                for (const kw of mod.keywords) {
                    for (const w of Object.keys(freqs)) {
                        if (w.includes(kw) || kw.includes(w)) {
                            score += freqs[w];
                        }
                    }
                }

                // Boost heavily if they explicitly state the chapter number
                const chapterNum = mod.name.match(/\d+/)?.[0];
                if (chapterNum) {
                    const numWords: Record<string, string[]> = {
                        '1': ['1', 'eins', 'one'], '2': ['2', 'zwei', 'two'], '3': ['3', 'drei', 'three'], '4': ['4', 'vier', 'four'],
                        '5': ['5', 'fünf', 'five'], '6': ['6', 'sechs', 'six'], '7': ['7', 'sieben', 'seven'], '8': ['8', 'acht', 'eight'],
                        '9': ['9', 'neun', 'nine'], '10': ['10', 'zehn', 'ten'], '11': ['11', 'elf', 'eleven'], '12': ['12', 'zwölf', 'twelve']
                    };

                    const variants = numWords[chapterNum] || [chapterNum];
                    for (const v of variants) {
                        const kapitelRegex = new RegExp(`(?:kapitel|chapter|modul|module|lektion)\\s*${v}`, 'i');
                        if (kapitelRegex.test(cleanedDialogue)) {
                            score += 100;
                            break;
                        }
                    }
                }

                if (score > highestScore && score >= 1) {
                    highestScore = score;
                    bestModule = mod;
                }
            }

            if (bestModule) {
                topic = bestModule.name;
                // Auto-populate inferredPages from the matched chapter's page range
                for (let p = bestModule.pageStart; p <= bestModule.pageEnd; p++) {
                    inferredPagesSet.add(p);
                }
            }

            // Re-derive inferredPages after possible chapter page injection
            inferredPages.length = 0;
            Array.from(inferredPagesSet).sort((a, b) => a - b).forEach(p => inferredPages.push(p));
        } else {
            // Fallback topic if A1/A2 is selected but modules array is empty
            const sortedWords = Object.entries(freqs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
            topic = sortedWords.length > 0 ? sortedWords.join(', ') : 'General Discussion';
        }
    } else {
        // Fallback topic for non-German classes or if no specific level is matched
        const sortedWords = Object.entries(freqs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
        topic = sortedWords.length > 0 ? sortedWords.join(', ') : 'General Discussion';
    }

    // 2. Data Driven Suggestions
    const teacherSuggestions: string[] = [];
    const studentSuggestions: string[] = [];

    let totalStudentSpeaking = 0;
    let topStudent = '';
    let topStudentMins = -1;
    let silentCount = 0;
    let teacherMins = 0;

    // Separate teacher from students
    const studentEntries = Object.entries(speakingData).filter(([name]) => {
        if (teacherName && name.toLowerCase().includes(teacherName.toLowerCase())) {
            return false;
        }
        return true;
    });

    for (const [name, mins] of Object.entries(speakingData)) {
        if (teacherName && name.toLowerCase().includes(teacherName.toLowerCase())) {
            teacherMins += mins;
        }
    }

    for (const [name, mins] of studentEntries) {
        totalStudentSpeaking += mins;
        if (mins > topStudentMins) {
            topStudentMins = mins;
            topStudent = name;
        }
        if (mins < 0.5) {
            silentCount++;
        }
    }

    // Teacher Logic
    if (teacherMins > duration * 0.7 && duration > 0) {
        teacherSuggestions.push(`You spoke for ${teacherMins.toFixed(1)} minutes (over 70% of the class). Consider asking more open-ended questions.`);
    } else if (teacherMins > 0) {
        teacherSuggestions.push(`Good balance! You spoke for ${teacherMins.toFixed(1)} mins, giving students room to engage.`);
    } else {
        teacherSuggestions.push(`Consider using breakout rooms to lower the barrier for speaking up.`);
    }

    if (silentCount > studentEntries.length * 0.5 && studentEntries.length > 0) {
        teacherSuggestions.push(`Over half of the tracked students spoke for less than 30 seconds. Try a "round robin" speaking activity next time.`);
    }

    // Student Logic
    if (topStudent) {
        studentSuggestions.push(`Acknowledge ${topStudent} for leading the engagement with ${topStudentMins.toFixed(1)} mins of speaking!`);
    } else {
        studentSuggestions.push(`No major student engagement detected in the transcript. Check microphone setups or rely on text chat!`);
    }

    if (silentCount > 0) {
        studentSuggestions.push(`There are ${silentCount} students who barely spoke. Try calling on them gently next time.`);
    }

    return { topic, teacherSuggestions, studentSuggestions, inferredPages };
};
