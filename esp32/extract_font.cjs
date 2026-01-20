const tar = require('tar');
const fs = require('fs');

tar.x({
  file: 'assets/wqy.tar.gz',
  cwd: 'assets',
  filter: (path) => path.endsWith('.ttc')
}).then(() => {
  console.log('Extraction complete');
  // Move file if needed, but tar extracts with structure.
  // Likely assets/wqy-microhei/wqy-microhei.ttc
  if (fs.existsSync('assets/wqy-microhei/wqy-microhei.ttc')) {
    fs.renameSync('assets/wqy-microhei/wqy-microhei.ttc', 'assets/font.ttc');
    console.log('Moved to assets/font.ttc');
  }
}).catch(err => {
  console.error('Extraction failed:', err);
});
