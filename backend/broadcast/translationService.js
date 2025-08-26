const dictionary = {
  es: {
    'Market update': 'Actualización del mercado',
    'Weather alert': 'Alerta meteorológica',
    'Community announcement': 'Anuncio comunitario'
  },
  fr: {
    'Market update': 'Mise à jour du marché',
    'Weather alert': 'Alerte météo',
    'Community announcement': 'Annonce communautaire'
  }
};

function translate(text, lang) {
  return dictionary[lang]?.[text] || text;
}

module.exports = { translate };
