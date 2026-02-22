import fs from 'fs';
const content = fs.readFileSync('c:/Users/User/Downloads/project1/backend/routes/escrow.js', 'utf8');
const lines = content.split('\n');
const line267 = lines[266];
console.log('Line 267 length:', line267.length);
console.log('Line 267 codes:', line267.split('').map(c => c.charCodeAt(0)));
