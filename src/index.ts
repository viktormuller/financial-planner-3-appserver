import { FPServer } from "./server";

require('dotenv').config();

const APP_PORT = process.env.APP_PORT || 8000;
const CORS_URL = process.env.CORS_URL;

// Using Express
const express = require('express');
const app = express();
app.use(express.json());
const cors = require('cors')
app.use(cors({
  origin: CORS_URL
}));

const server = new FPServer();

app.get('/api/link_token', async (request, response, next) => {

  // TODO: Get the client_user_id by searching for the current user    
  server.getLinkToken("").
    then((linkToken) => {
      response.send({ link_token: linkToken });
    }).catch((e) => {
      // Display error on client
      next(e);
    });
});

app.post('/api/set_access_token', function (request, response, next) {
  const PUBLIC_TOKEN = request.body.public_token;
  server.setPublicToken("",PUBLIC_TOKEN).
    then((itemId) => {
      response.send({
        item_id: itemId
      })
    }).catch(e => {
      next(e);
    });
});


app.get('/api/BankAccounts', function (request, response, next) {
  server.getBankAccounts("").then((accounts) => {
    response.send({ accounts: accounts });
  }).catch(e => {
    console.log(e);
    next(e);
  });
});

app.listen(APP_PORT, () => {
  console.log(`server started at ${APP_PORT}`);
});