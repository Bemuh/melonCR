import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, '../data-src/cups.xlsx');
const outputFile = path.join(__dirname, '../public/data/cups.json');

// Ensure output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Reading from: ${inputFile}`);

try {
    const workbook = XLSX.readFile(inputFile);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const data = rawData.slice(1).map(row => {
        // Adjust indices based on actual Excel structure
        if (!row || row.length < 2) return null;

        const code = String(row[0]).trim();
        const name = String(row[1]).trim();

        // Filter out headers/sections
        if (!code || !name) return null;

        // Exclude rows starting with specific keywords
        if (code.match(/^(Sección|Capítulo|Incluye|Simultáneo|Excluye)/i)) return null;
        if (name.match(/^(Sección|Capítulo|Incluye|Simultáneo|Excluye)/i)) return null;

        // Exclude "1," type headers or "01.0." type headers if they don't look like full codes
        // We'll assume a valid code has at least some digits and maybe dots, but usually not ending in a dot or comma
        // Actually, the user example shows "01.0." as a header.
        // Let's exclude codes ending in "." or ","
        if (code.match(/[.,]$/)) return null;

        return { code, name };
    }).filter(item => item);

    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(`Successfully wrote ${data.length} items to ${outputFile}`);

} catch (error) {
    console.error('Error converting file:', error);
    process.exit(1);
}
