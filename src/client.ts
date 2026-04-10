import { GoogleAdsApi } from "google-ads-api";

/* ------------------------------------------------------------------ */
/*  Environment variables                                              */
/* ------------------------------------------------------------------ */

const REQUIRED_VARS = [
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
] as const;

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Error: ${key} environment variable is required.`);
    process.exit(1);
  }
  return value;
}

const CLIENT_ID = getEnv("GOOGLE_ADS_CLIENT_ID");
const CLIENT_SECRET = getEnv("GOOGLE_ADS_CLIENT_SECRET");
const DEVELOPER_TOKEN = getEnv("GOOGLE_ADS_DEVELOPER_TOKEN");
const REFRESH_TOKEN = getEnv("GOOGLE_ADS_REFRESH_TOKEN");
const CUSTOMER_ID = getEnv("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, "");
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "");

/* ------------------------------------------------------------------ */
/*  Google Ads API singleton                                           */
/* ------------------------------------------------------------------ */

let apiInstance: GoogleAdsApi | null = null;

function getApi(): GoogleAdsApi {
  if (!apiInstance) {
    apiInstance = new GoogleAdsApi({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      developer_token: DEVELOPER_TOKEN,
    });
  }
  return apiInstance;
}

export function getCustomer() {
  const api = getApi();
  return api.Customer({
    customer_id: CUSTOMER_ID,
    refresh_token: REFRESH_TOKEN,
    ...(LOGIN_CUSTOMER_ID ? { login_customer_id: LOGIN_CUSTOMER_ID } : {}),
  });
}

export function getCustomerId(): string {
  return CUSTOMER_ID;
}
