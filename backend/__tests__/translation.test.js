const { translateMessage, translateTerm, qaCheck } = require('../utils/translation');

describe('translation', () => {
  let warn;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test.each([
    [undefined, 'listing'],
    ['es', 'publicación'],
    ['ES-MX', 'anuncio'],
    ['es-AR', 'publicación'],
    ['fr', 'annonce'],
    ['fr-CA', 'annonce'],
    ['unknown', 'listing']
  ])('resolves listing term for locale %s', (locale, expected) => {
    expect(translateTerm('listing', locale)).toBe(expected);
  });

  test('inherits base terms and messages when dialect does not override them', () => {
    expect(translateTerm('producerPlural', 'es-MX')).toBe('productores');
    expect(translateMessage('this_region', 'es-MX')).toBe('esta región');
  });

  test.each(['en', 'es-MX', 'fr'])('preserves PING terminology for %s', locale => {
    expect(translateTerm('ping', locale)).toBe('PING');
    expect(translateTerm('pingPlural', locale)).toBe('PINGs');
  });

  test('returns unknown keys unchanged', () => {
    expect(translateTerm('unknown_term', 'fr')).toBe('unknown_term');
    expect(translateMessage('unknown_message', 'es-MX')).toBe('unknown_message');
    expect(warn).not.toHaveBeenCalled();
  });

  test('substitutes every occurrence of a placeholder', () => {
    expect(translateMessage('high_listing_volume', 'en', {
      region: '{listingTerm}', listingTerm: 'listing', listingTermPlural: 'listings'
    })).toBe('📈 High listing volume detected in listing – over 100 active listings.');
    expect(warn).not.toHaveBeenCalled();
  });

  test('renders dialect message with supplied variables', () => {
    expect(translateMessage('low_market_activity', 'ES-MX', { region: 'Oaxaca' }))
      .toBe('🌱 Poca movida de mercado en Oaxaca. Difunde qué se anda buscando.');
    expect(warn).not.toHaveBeenCalled();
  });

  test('uses English messages for unknown locale', () => {
    expect(translateMessage('this_region', 'unknown')).toBe('this region');
    expect(translateMessage('this_region')).toBe('this region');
  });

  test('reports unresolved placeholders without changing output', () => {
    const output = translateMessage('top_rated_producers', 'en', { names: 'Ada' });

    expect(output).toBe('🏆 Top rated {producerTermPlural} this week: Ada');
    expect(warn).toHaveBeenCalledWith('Unresolved placeholder in translation:', output);
  });

  test('accepts complete text without warnings', () => {
    expect(qaCheck('Market update')).toBe('Market update');
    expect(warn).not.toHaveBeenCalled();
  });
});
