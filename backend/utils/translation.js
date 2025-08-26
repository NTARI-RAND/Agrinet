const translations = {
  en: {
    messages: {
      high_listing_volume: '📈 High {listingTerm} volume detected in {region} – over 100 active {listingTermPlural}.',
      low_market_activity: '🌱 Low market activity in {region}. Consider broadcasting market needs.',
      top_rated_producers: '🏆 Top rated {producerTermPlural} this week: {names}',
      transaction_delays: '⚠️ Several {transactionTermPlural} are experiencing delays. Encourage {producerTermPlural} to respond to {pingTermPlural} promptly.',
      transaction_health_good: '✅ Average {transactionTerm} health is good. {pingTerm} responsiveness is within expected limits.',
      this_region: 'this region'
    },
    terms: {
      listing: 'listing',
      listingPlural: 'listings',
      producer: 'producer',
      producerPlural: 'producers',
      transaction: 'transaction',
      transactionPlural: 'transactions',
      ping: 'PING',
      pingPlural: 'PINGs'
    }
  },
  es: {
    messages: {
      high_listing_volume: '📈 Alto volumen de {listingTermPlural} detectado en {region} – más de 100 activos.',
      low_market_activity: '🌱 Baja actividad de mercado en {region}. Considera difundir las necesidades del mercado.',
      top_rated_producers: '🏆 {producerTermPlural} mejor valorados esta semana: {names}',
      transaction_delays: '⚠️ Varias {transactionTermPlural} están experimentando retrasos. Incentiva a los {producerTermPlural} a responder a los {pingTermPlural} rápidamente.',
      transaction_health_good: '✅ La salud promedio de las {transactionTermPlural} es buena. La respuesta a los {pingTermPlural} está dentro de lo esperado.',
      this_region: 'esta región'
    },
    terms: {
      listing: 'publicación',
      listingPlural: 'publicaciones',
      producer: 'productor',
      producerPlural: 'productores',
      transaction: 'transacción',
      transactionPlural: 'transacciones',
      ping: 'PING',
      pingPlural: 'PINGs'
    },
    dialects: {
      mx: {
        messages: {
          high_listing_volume: '📈 Chorro de {listingTermPlural} en {region} – más de 100 activos.',
          low_market_activity: '🌱 Poca movida de mercado en {region}. Difunde qué se anda buscando.'
        },
        terms: {
          listing: 'anuncio',
          listingPlural: 'anuncios',
          producer: 'productor',
          producerPlural: 'productores',
          transaction: 'transacción',
          transactionPlural: 'transacciones',
          ping: 'PING',
          pingPlural: 'PINGs'
        }
      }
    }
  },
  fr: {
    messages: {
      high_listing_volume: "📈 Volume élevé d'annonces détecté dans {region} – plus de 100 {listingTermPlural} actifs.",
      low_market_activity: "🌱 Faible activité du marché dans {region}. Envisagez de diffuser les besoins du marché.",
      top_rated_producers: "🏆 {producerTermPlural} les mieux notés cette semaine : {names}",
      transaction_delays: "⚠️ Plusieurs {transactionTermPlural} subissent des retards. Encouragez les {producerTermPlural} à répondre aux {pingTermPlural} rapidement.",
      transaction_health_good: "✅ La santé moyenne des {transactionTermPlural} est bonne. Les réponses aux {pingTermPlural} sont dans les limites prévues.",
      this_region: 'cette région'
    },
    terms: {
      listing: 'annonce',
      listingPlural: 'annonces',
      producer: 'producteur',
      producerPlural: 'producteurs',
      transaction: 'transaction',
      transactionPlural: 'transactions',
      ping: 'PING',
      pingPlural: 'PINGs'
    }
  }
};

function resolveLocale(locale = 'en') {
  const [lang, dialect] = locale.toLowerCase().split('-');
  const base = translations[lang] || translations.en;
  let dict = { ...base };
  if (dialect && base.dialects && base.dialects[dialect]) {
    dict = {
      messages: { ...base.messages, ...base.dialects[dialect].messages },
      terms: { ...base.terms, ...base.dialects[dialect].terms }
    };
  }
  return dict;
}

function qaCheck(output) {
  if (/{\w+}/.test(output)) {
    console.warn('Unresolved placeholder in translation:', output);
  }
  return output;
}

function translateTerm(key, locale = 'en') {
  const dict = resolveLocale(locale);
  return dict.terms[key] || translations.en.terms[key] || key;
}

function translateMessage(key, locale = 'en', vars = {}) {
  const dict = resolveLocale(locale);
  let template = dict.messages[key] || translations.en.messages[key] || key;
  Object.keys(vars).forEach(v => {
    template = template.replace(new RegExp(`{${v}}`, 'g'), vars[v]);
  });
  return qaCheck(template);
}

module.exports = {
  translateMessage,
  translateTerm,
  qaCheck
};
