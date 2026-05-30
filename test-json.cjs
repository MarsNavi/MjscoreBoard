const fs = require('fs');
['zh', 'en', 'ja'].forEach(lang => {
  try {
    JSON.parse(fs.readFileSync('src/i18n/locales/' + lang + '.json', 'utf8'));
    console.log(lang + ' ok');
  } catch(e) {
    console.log(lang + ' error: ' + e);
  }
});
