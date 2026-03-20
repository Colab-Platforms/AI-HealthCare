const fs = require('fs');
const content = fs.readFileSync('test_output.log', 'utf16le');
console.log(content);
