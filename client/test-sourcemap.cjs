const fs = require('fs');
const { SourceMapConsumer } = require('source-map');

const rawSourceMap = fs.readFileSync('../dist/public/assets/index-B1juNFqE.js.map', 'utf8');

const positions = [
  { line: 48, column: 27671 },
  { line: 48, column: 27244 },
  { line: 48, column: 53608 },
  { line: 48, column: 53437 },
  { line: 48, column: 93662 },
  { line: 48, column: 108998 },
  { line: 48, column: 108882 },
  { line: 48, column: 109766 }
];

SourceMapConsumer.with(rawSourceMap, null, consumer => {
  positions.forEach(pos => {
    const orig = consumer.originalPositionFor({
      line: pos.line,
      column: pos.column
    });
    console.log(`Minified ${pos.line}:${pos.column} -> ${orig.source}:${orig.line}:${orig.column} (name: ${orig.name})`);
  });
});
