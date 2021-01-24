import { FPServer } from "./server";

require('dotenv').config();

const APP_PORT = process.env.APP_PORT || 8000;
const CORS_URL = process.env.CORS_URL;

// Using Express
const express = require('express');
const app = express();
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const cors = require('cors')

// Authorization middleware. When used, the
// Access Token must exist and be verified against
// the Auth0 JSON Web Key Set
const checkJwt = jwt({
  // Dynamically provide a signing key
  // based on the kid in the header and 
  // the signing keys provided by the JWKS endpoint.
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://dev-finplanner.us.auth0.com/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer.
  audience: 'https://api.enoughcalc.com',
  issuer: `https://dev-finplanner.us.auth0.com/`,
  algorithms: ['RS256']
});


app.use(express.json());
app.use(cors({
  origin: CORS_URL
}));
app.use(checkJwt);




const server = new FPServer();

app.get('/api/link_token', async (request, response, next) => {

  // TODO: Get the client_user_id by searching for the current user    
  server.getLinkToken(request.user.sub).
    then((linkToken) => {
      response.send({ link_token: linkToken });
    }).catch((e) => {
      // Display error on client
      next(e);
    });
});

app.post('/api/set_access_token', function (request, response, next) {
  const PUBLIC_TOKEN = request.body.public_token;
  server.setPublicToken(PUBLIC_TOKEN, request.user.sub).
    then((itemId) => {
      response.send({
        item_id: itemId
      })
    }).catch(e => {
      next(e);
    });
});

app.get('/api/has_plaid_access_token', function (req, res, next) {
  server.hasPlaidAccessToken(req.user.sub).
    then((hasToken) => {
      res.send({
        has_plaid_access_token: hasToken
      });
    }).catch(e => {
      console.log(e);
      next(e);
    });
});


app.get('/api/BankAccounts', function (request, response, next) {
  server.getBankAccounts(request.user.sub).then((accounts) => {
    response.send({ accounts: accounts });
  }).catch(e => {
    console.log(e);
    next(e);
  });
});

app.get('/api/Holdings', function (request, response, next) {
  server.getHoldings(request.user.sub).then((holdings) => {
    response.send({ holdings: holdings });
  }).catch(e => {
    console.log(e);
    next(e);
  });
});

app.get('/api/CashFlowAccounts', function (request, response, next){
  server.getCashFlowAccounts(request.user.sub).then((cfAccs) => {
    response.send({ accounts: cfAccs });
  }).catch(e => {
    console.log(e);
    next(e);
  });
});

app.listen(APP_PORT, () => {
  console.log(`server started at ${APP_PORT}`);
});