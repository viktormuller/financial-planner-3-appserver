import { BankAccount, BankAccountType, BankAccountSubType, FP_API, BANK_ACCOUNT_TAX_TYPE_BY_SUBTYPE, BankAccountTaxType } from "financial-planner-api";
import { Holding, SecurityType } from "financial-planner-api/build/Holding";
import { Client, Account, Security } from "plaid";

require('dotenv').config();

const plaid = require('plaid');

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || plaid.environments.sandbox;

function getBalanceFromAccount(account: Account): number {
    const { balances: { current, available }, type } = account;
    const accType = BankAccountType[type];
    switch (accType) {
        case BankAccountType.depository:
            return available ? available : current;
        default:
            return current;
    }
}

function getSecurityDetails(securityId:string, securities: Security[]){
    return securities.find((security) => security.security_id === securityId);
}

function getCurrencyFromAccount(account: Account): string {
    const { balances: { iso_currency_code, unofficial_currency_code } } = account;
    return iso_currency_code ? iso_currency_code : unofficial_currency_code;
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
    async getHoldings(): Promise<Holding[]> {
        let {holdings,securities} = await this.client.getHoldings(this.accessToken);
        
        return holdings.map((holding) => {
            const {security_id, account_id, institution_value, iso_currency_code, unofficial_currency_code, cost_basis} = holding;
            const {name, type} = getSecurityDetails(security_id, securities);            

            let ret = {
                accountId:account_id,
                securityName: name,
                securityType: SecurityType[type],
                value:institution_value,
                currency: iso_currency_code?iso_currency_code:unofficial_currency_code                
            }

            if (cost_basis){
                ret["costBasis"] = cost_basis;
            }

            return ret; 
        })
    }

    getUser() {
        return "12345678";
    }

    async getLinkToken(userId: string): Promise<string> {
        let clientUserId = this.getUser();

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
        const tokenResponse = await this.client.exchangePublicToken(publicToken);
        this.accessToken = tokenResponse.access_token;
        console.log("Access token stored: " + this.accessToken);
        return tokenResponse.item_id;
    }
    async getBankAccounts(userId: string): Promise<BankAccount[]> {
        let balancesResponse = await this.client.getBalance(this.accessToken);
        return balancesResponse.accounts.map((account) => {
            let subType;
            //Hack to support 529 because enum member cannot be number. 
            if (account.subtype === "529") subType = BankAccountSubType._529;
            else subType = BankAccountSubType[account.subtype];
            let type = BankAccountType[account.type];
            let taxType = BANK_ACCOUNT_TAX_TYPE_BY_SUBTYPE.get(subType);            

            return {
                accountId: account.account_id,
                name: account.name ? account.name : account.official_name,
                type: type,
                subType: subType,
                taxType: taxType,
                balance: getBalanceFromAccount(account),
                currency: getCurrencyFromAccount(account)
            }
        })
    }

}