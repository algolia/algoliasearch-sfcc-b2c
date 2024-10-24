const axios = require('axios');

const instance = process.env.SANDBOX_HOST;
const accessToken = process.env.ACCESS_TOKEN;
const siteId = 'RefArch'; // test site ID

const preferences = {
    'c_Algolia_RecordModel': 'variant-level',
    'c_Algolia_IndexPrefix': 'varx',
    'c_Algolia_AdditionalAttributes': 'color,size,colorVariations,masterID,short_description,brand,name,pricebooks'
};

(async () => {
    try {
        await axios.patch(`https://${instance}/s/-/dw/data/v19_10/sites/${siteId}/preferences`, preferences, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Site preferences updated successfully.');
    } catch (error) {
        console.error('Error updating site preferences:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
})();
