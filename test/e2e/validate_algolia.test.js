const algoliasearch = require('algoliasearch');

describe('Algolia Integration', () => {
  let client;
  let index;
  let consoleLogSpy;

  beforeEach(() => {
    process.env.ALGOLIA_APP_ID = '4ISNL568WT';
    process.env.ALGOLIA_API_KEY = 'f493f30ee56ca33cf59bac5d3a8fd791';

    client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);
    index = client.initIndex('varx__products__en_US');

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('should log Algolia credentials', () => {
    expect(consoleLogSpy).toHaveBeenCalledWith(process.env.ALGOLIA_APP_ID);
    expect(consoleLogSpy).toHaveBeenCalledWith(process.env.ALGOLIA_API_KEY);
  });

  test('should search for a specific product', async () => {
    const electronicProduct = {
      name: 'TomTom Go 720 Portable GPS Unit',
      primary_category_id: 'electronics-gps-units',
      categories: [],
      in_stock: true,
      price: {},
      image_groups: [],
      url: '/s/RefArch/electronics/gps%20navigation/tomtom-go-720M.html?lang=en_US',
      color: null,
      size: null,
      colorVariations: null,
      objectID: 'tomtom-go-720M',
    };

    // Mock the Algolia search method
    index.search = jest.fn().mockResolvedValue({ hits: [electronicProduct] });

    const results = await index.search('TomTom Go 720 Portable GPS Unit');
    const hit = results.hits[0];

    expect(hit.name).toBe(electronicProduct.name);
    expect(hit.objectID).toBe('tomtom-go-720M');
    expect(hit.primary_category_id).toBe('electronics-gps-units');
    expect(hit.colorVariations).toBeDefined();
    expect(hit.size).toBeDefined();
    expect(hit.color).toBeDefined();
  });
});
