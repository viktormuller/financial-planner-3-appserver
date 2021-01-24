import { BankAccount, BankAccountType, BankAccountSubType, FP_API, BANK_ACCOUNT_TAX_TYPE_BY_SUBTYPE, BankAccountTaxType, FinancialAccount, NET_CASH_IN_FLOW_ACCOUNT_TYPE, NET_CASH_OUT_FLOW_ACCOUNT_TYPE } from "financial-planner-api";
import { Holding, SecurityType } from "financial-planner-api/build/Holding";
import { MonetaryAmount } from "financial-planner-api/build/MonetaryAmount";
import { Client, Account, Security, Transaction } from "plaid";

require('dotenv').config();

const plaid = require('plaid');

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || plaid.environments.sandbox;

const plaidTokenStore = new Map<string, string>();

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

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

function getSecurityDetails(securityId: string, securities: Security[]) {
    return securities.find((security) => security.security_id === securityId);
}

function getCurrencyFromAccount(account: Account): string {
    const { balances: { iso_currency_code, unofficial_currency_code } } = account;
    return iso_currency_code ? iso_currency_code : unofficial_currency_code;
}

export class FPServer implements FP_API {
    client: Client;

    constructor() {
        this.client = new plaid.Client({
            clientID: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            env: PLAID_ENV,
        });
    }
    //Use client timezone instead?
    async getCashFlowAccounts(userId?: string): Promise<FinancialAccount[]> {
        let allTransactions= [] as Transaction[];
        let endOfLastMonth = new Date();
        endOfLastMonth.setDate(1);
        endOfLastMonth.setHours(-1);
        const endDate: string = formatDate(endOfLastMonth);
        let startOfLastMonth = new Date(endOfLastMonth);
        startOfLastMonth.setDate(1);
        const startDate: string = formatDate(startOfLastMonth);
        let morePages = false;
        let offset = 0;
        let accessToken = plaidTokenStore.get(userId);
        console.log("user ID: " + userId);
        console.log("accessToken: " + accessToken);
        do {
            const txResponse = await this.client.
                getTransactions(accessToken, startDate, endDate, { 
                    count: 500, //Max
                    offset: offset });
            const {transactions, total_transactions} = txResponse;
            
            morePages = transactions.length < total_transactions;
            offset += transactions.length;
            allTransactions.push(...transactions);
        } while (morePages);

        const inFlow = new FinancialAccount(NET_CASH_IN_FLOW_ACCOUNT_TYPE, startOfLastMonth.getFullYear());
        const outFlow = new FinancialAccount(NET_CASH_OUT_FLOW_ACCOUNT_TYPE, startOfLastMonth.getFullYear());

        allTransactions.forEach((value) => {
            let date = Number.parseInt((value.date?value.date:value.authorized_date)?.split("-")[0]);
            if (!date) date = endOfLastMonth.getFullYear();
            if (value.amount < 0) {
                inFlow.add(new MonetaryAmount(-value.amount), date);
            } else {
                outFlow.add(new MonetaryAmount(value.amount), date);
            }
        });
        return [inFlow,outFlow];
    }


    async getLinkToken(userId: string): Promise<string> {
        // Create the link_token with all of your configurations
        const tokenResponse = await this.client.createLinkToken({
            user: {
                client_user_id: userId,
            },
            client_name: 'My App',
            products: ['transactions'],
            country_codes: ['US'],
            language: 'en'
        });
        return tokenResponse.link_token;
    }

    /**     
     * 
     * @param publicToken 
     * @param userId 
     */
    async setPublicToken(publicToken: string, userId: string,): Promise<string> {
        const tokenResponse = await this.client.exchangePublicToken(publicToken);
        plaidTokenStore.set(userId, tokenResponse.access_token);
        return tokenResponse.item_id;
    }

    hasPlaidAccessToken(userId?: string): Promise<boolean> {
        return new Promise((resolve) => {
            resolve(plaidTokenStore.has(userId));
        });
    }


    async getHoldings(userId: string): Promise<Holding[]> {
        let accessToken = plaidTokenStore.get(userId);
        let { holdings, securities } = await this.client.getHoldings(accessToken);

        return holdings.map((holding) => {
            const { security_id, account_id, institution_value, iso_currency_code, unofficial_currency_code, cost_basis } = holding;
            const { name, type } = getSecurityDetails(security_id, securities);

            let ret = {
                accountId: account_id,
                securityName: name,
                securityType: SecurityType[type],
                value: institution_value,
                currency: iso_currency_code ? iso_currency_code : unofficial_currency_code
            }

            if (cost_basis) {
                ret["costBasis"] = cost_basis;
            }

            return ret;
        })
    }


    async getBankAccounts(userId: string): Promise<BankAccount[]> {
        let accessToken = plaidTokenStore.get(userId);
        let balancesResponse = await this.client.getBalance(accessToken);
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