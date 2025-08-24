let franc;
try {
  franc = require('franc');
} catch (e) {
  franc = () => 'eng';
}

// Basic keyword translations for local languages
const translations = {
  swa: { bei: 'price', msaada: 'help', hali: 'weather' },
};

function normalize(text) {
  let cleaned = text.trim().toLowerCase();
  const lang = franc(cleaned, { minLength: 3 });
  const map = translations[lang];
  if (map) {
    Object.entries(map).forEach(([local, eng]) => {
      const regex = new RegExp(`\\b${local}\\b`, 'g');
      cleaned = cleaned.replace(regex, eng);
    });
  }
  return cleaned;
}

module.exports = { normalize };
