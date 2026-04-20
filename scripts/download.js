const fs = require('fs');
const path = require('path');

/**
 * download_kingdoms.js
 * Builds kingdoms.json in the ../web/ directory.
 * * Usage: 
 * node download_kingdoms.js          (Resumes from last ID)
 * node download_kingdoms.js --clean  (Starts from 1)
 */

const FILE_PATH = path.join(__dirname, '../web/kingdoms.json');
const API_BASE = 'https://kingshot.net/api/kingdom-tracker?kingdomId=';
const DELAY_MS = 150; 

async function run() {
    const isClean = process.argv.includes('--clean');
    let kingdoms = {};

    // Ensure the ../web/ directory exists
    const dir = path.dirname(FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // 1. Initialize State
    if (!isClean && fs.existsSync(FILE_PATH)) {
        try {
            kingdoms = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
            console.log(`Loaded ${Object.keys(kingdoms).length} existing kingdoms from ${FILE_PATH}`);
        } catch (e) {
            console.error("Error parsing existing kingdoms.json. Starting fresh.");
        }
    }

    // 2. Determine Starting Point
    let currentId = 1;
    if (!isClean) {
        const existingIds = Object.keys(kingdoms).map(Number);
        if (existingIds.length > 0) {
            currentId = Math.max(...existingIds) + 1;
            console.log(`Resuming from Kingdom ${currentId}...`);
        }
    } else {
        console.log("Clean flag detected. Starting from Kingdom 1...");
    }

    // 3. Polling Loop
    let running = true;

    while (running) {
        try {
            const response = await fetch(`${API_BASE}${currentId}`);
            
            if (!response.ok) {
                console.log(`\nAPI error ${response.status} at ID ${currentId}. Stopping.`);
                running = false;
                break;
            }

            const json = await response.json();

            if (json.status === 'success' && json.data.servers.length > 0) {
                const server = json.data.servers[0];
                kingdoms[currentId] = server.openTime;
                
                process.stdout.write(`\r[✔] Found Kingdom ${currentId} | Total: ${Object.keys(kingdoms).length}`);

                // Save every 25 records as a checkpoint
                if (currentId % 25 === 0) {
                    fs.writeFileSync(FILE_PATH, JSON.stringify(kingdoms, null, 2));
                }
                
                currentId++;
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            } else {
                console.log(`\n[!] No data for Kingdom ${currentId}. End of sequence reached.`);
                running = false;
            }
        } catch (err) {
            console.error(`\n[X] Fetch failed at Kingdom ${currentId}:`, err.message);
            running = false;
        }
    }

    // 4. Final Save
    fs.writeFileSync(FILE_PATH, JSON.stringify(kingdoms, null, 2));
    console.log(`\nFinished! Data saved to: ${FILE_PATH}`);
}

run();