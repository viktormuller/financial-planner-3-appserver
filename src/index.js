require('dotenv').config();

const APP_PORT = process.env.APP_PORT || 8000;
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || plaid.environments.sandbox;
const CORS_URL = process.env.CORS_URL;

let ACCESS_TOKEN = null;
let PUBLIC_TOKEN = null;
let ITEM_ID = null;

// Using Express
const express = require('express');
const app = express();
app.use(express.json());
var cors = require('cors')
app.use(cors({
  origin: CORS_URL
}));

const plaid = require('plaid');

const client = new plaid.Client({
  clientID: PLAID_CLIENT_ID,
  secret: PLAID_SECRET,
  env: PLAID_ENV,
});

function getUser() {
  return "12345678";
}

app.get('/api/link_token', async (request, response) => {
  try {
    // Get the client_user_id by searching for the current user
    clientUserId = getUser();

    // Create the link_token with all of your configurations
    const tokenResponse = await client.createLinkToken({
      user: {
        client_user_id: clientUserId,
      },
      client_name: 'My App',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    });

    response.send({ link_token: tokenResponse.link_token });
  } catch (e) {
    // Display error on client
    return response.send({ error: e.message });
  }
});

app.post('/api/set_access_token', function (request, response, next) {
  PUBLIC_TOKEN = request.body.public_token;  
  client.exchangePublicToken(PUBLIC_TOKEN, function (error, tokenResponse) {
    if (error != null) {
      return response.json({
        error,
      });
    }
    ACCESS_TOKEN = tokenResponse.access_token;
    ITEM_ID = tokenResponse.item_id;    
    response.json({
      item_id: ITEM_ID,
      error: null,
    });
  });
});

app.get('/api/balances', function (request, response) {  
  client.getBalance(ACCESS_TOKEN, (error, value) => {
    if (error != null) {
      response.json(error);
    } else {
      response.json(value);}
  });
});

app.listen(APP_PORT, () => {
  console.log(`server started at ${APP_PORT}`);
});