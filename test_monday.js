const axios = require('axios');
axios.post('https://api.monday.com/v2', { query: '{ boards { id } }' }, {
  headers: {
    'Authorization': 'invalid',
    'API-Version': '2024-04'
  }
}).catch(e => console.log(e.response.data));
