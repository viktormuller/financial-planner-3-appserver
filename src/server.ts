import { BankAccount, BankAccountType, BankAccountSubType, FP_API, BANK_ACCOUNT_TAX_TYPE_BY_SUBTYPE, BankAccountTaxType } from "financial-planner-api";
import { Client, Account } from "plaid";

require('dotenv').config();

const plaid = require('plaid');

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || plaid.environments.sandbox;

function getBalanceFromAccount(account:Account):number{
    const {balances:{current, available}, type} = account;
    const accType = BankAccountType[type];
    switch (accType){
        case BankAccountType.DEPOSITORY:
            return available;
        default:
            return current;
    }
}

function getCurrencyFromAccount(account:Account):string{
    const {balances: {iso_currency_code, unofficial_currency_code}} = account;
    return iso_currency_code?iso_currency_code:unofficial_currency_code;
}

export class FPServer implements FP_API {
    client: Client;
    accessToken: string;

    constructor() {
        this.client = new plaid.Client({
            clientID: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            env: PLAID_ENV,
        });
    }

    getUser() {
        return "12345678";
    }

    async getLinkToken(userId: string): Promise<string> {
        var clientUserId = this.getUser();

        // Create the link_token with all of your configurations
        const tokenResponse = await this.client.createLinkToken({
            user: {
                client_user_id: clientUserId,
            },
            client_name: 'My App',
            products: ['transactions'],
            country_codes: ['US'],
            language: 'en'
        });
        return tokenResponse.link_token;
    }
    async setPublicToken(userId: string, publicToken: string): Promise<string> {
        var tokenResponse = await this.client.exchangePublicToken(publicToken);
        this.accessToken = tokenResponse.access_token;
        console.log("Access token stored: " + this.accessToken);
        return tokenResponse.item_id;
    }
    async getBankAccounts(userId: string): Promise<BankAccount[]> {
      var balancesResponse = await this.client.getBalance(this.accessToken);
      return balancesResponse.accounts.map((account) => {
          let subType = BankAccountSubType[account.subtype];
          let type = BankAccountType[account.type];
          return {
              accountId: account.account_id,
              name: account.name?account.name:account.official_name,
              type: type,
              subType: subType,
              taxType: BANK_ACCOUNT_TAX_TYPE_BY_SUBTYPE.get(subType),
              balance: getBalanceFromAccount(account),
              currency: getCurrencyFromAccount(account)
          }
      })
    }

}