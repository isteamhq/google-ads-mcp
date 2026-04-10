import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCustomer } from "../client.js";
import { formatCurrency, formatPercent, formatNumber, toNumber, jsonResult, errorResult } from "../utils.js";
import { asRows, field } from "../types.js";

export function registerReportTools(server: McpServer) {
  /* ---------------------------------------------------------------- */
  /*  campaign_report                                                  */
  /* ---------------------------------------------------------------- */
  server.tool(
    "campaign_report",
    "Get a performance report for all campaigns broken down by date.",
    {
      date_range: z.enum(["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"]).default("LAST_7_DAYS")
        .describe("Date range"),
      campaign_id: z.string().optional().describe("Filter by specific campaign ID"),
    },
    async ({ date_range, campaign_id }) => {
      try {
        const customer = getCustomer();
        const campaignFilter = campaign_id ? `AND campaign.id = ${campaign_id}` : "";

        const query = `
          SELECT
            campaign.id,
            campaign.name,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.cost_per_conversion,
            metrics.search_impression_share
          FROM campaign
          WHERE campaign.status != 'REMOVED'
            AND segments.date DURING ${date_range}
            ${campaignFilter}
          ORDER BY segments.date DESC, metrics.cost_micros DESC
          LIMIT 200
        `;

        const results = asRows(await customer.query(query));

        const rows = results.map((row) => {
          const c = field(row, "campaign");
          const s = field(row, "segments");
          const m = field(row, "metrics");
          return {
            date: String(s.date ?? ""),
            campaign: String(c.name ?? ""),
            campaign_id: String(c.id ?? ""),
            impressions: formatNumber(m.impressions as number),
            clicks: formatNumber(m.clicks as number),
            ctr: formatPercent(m.ctr as number),
            avg_cpc: formatCurrency(m.average_cpc as number),
            cost: formatCurrency(m.cost_micros as number),
            conversions: toNumber(m.conversions as number),
            cost_per_conv: formatCurrency(m.cost_per_conversion as number),
            impression_share: formatPercent(m.search_impression_share as number),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(rows) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  ad_group_report                                                  */
  /* ---------------------------------------------------------------- */
  server.tool(
    "ad_group_report",
    "Get a performance report for ad groups broken down by date.",
    {
      campaign_id: z.string().describe("Campaign ID"),
      date_range: z.enum(["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"]).default("LAST_7_DAYS")
        .describe("Date range"),
    },
    async ({ campaign_id, date_range }) => {
      try {
        const customer = getCustomer();

        const query = `
          SELECT
            ad_group.id,
            ad_group.name,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions
          FROM ad_group
          WHERE campaign.id = ${campaign_id}
            AND ad_group.status != 'REMOVED'
            AND segments.date DURING ${date_range}
          ORDER BY segments.date DESC, metrics.cost_micros DESC
          LIMIT 200
        `;

        const results = asRows(await customer.query(query));

        const rows = results.map((row) => {
          const ag = field(row, "ad_group");
          const s = field(row, "segments");
          const m = field(row, "metrics");
          return {
            date: String(s.date ?? ""),
            ad_group: String(ag.name ?? ""),
            ad_group_id: String(ag.id ?? ""),
            impressions: formatNumber(m.impressions as number),
            clicks: formatNumber(m.clicks as number),
            ctr: formatPercent(m.ctr as number),
            avg_cpc: formatCurrency(m.average_cpc as number),
            cost: formatCurrency(m.cost_micros as number),
            conversions: toNumber(m.conversions as number),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(rows) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  keyword_report                                                   */
  /* ---------------------------------------------------------------- */
  server.tool(
    "keyword_report",
    "Get keyword-level performance report for a campaign.",
    {
      campaign_id: z.string().describe("Campaign ID"),
      date_range: z.enum(["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"]).default("LAST_30_DAYS")
        .describe("Date range"),
    },
    async ({ campaign_id, date_range }) => {
      try {
        const customer = getCustomer();

        const query = `
          SELECT
            ad_group.name,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.quality_info.quality_score,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.cost_per_conversion
          FROM keyword_view
          WHERE campaign.id = ${campaign_id}
            AND segments.date DURING ${date_range}
          ORDER BY metrics.cost_micros DESC
          LIMIT 100
        `;

        const results = asRows(await customer.query(query));

        const rows = results.map((row) => {
          const ag = field(row, "ad_group");
          const agc = field(row, "ad_group_criterion");
          const kw = (agc.keyword ?? {}) as Record<string, unknown>;
          const qi = (agc.quality_info ?? {}) as Record<string, unknown>;
          const m = field(row, "metrics");
          return {
            ad_group: String(ag.name ?? ""),
            keyword: String(kw.text ?? ""),
            match_type: String(kw.match_type ?? ""),
            quality_score: qi.quality_score ?? null,
            impressions: formatNumber(m.impressions as number),
            clicks: formatNumber(m.clicks as number),
            ctr: formatPercent(m.ctr as number),
            avg_cpc: formatCurrency(m.average_cpc as number),
            cost: formatCurrency(m.cost_micros as number),
            conversions: toNumber(m.conversions as number),
            cost_per_conv: formatCurrency(m.cost_per_conversion as number),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(rows) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  search_terms_report                                              */
  /* ---------------------------------------------------------------- */
  server.tool(
    "search_terms_report",
    "See what actual search queries triggered your ads. Essential for finding negative keywords and new keyword opportunities.",
    {
      campaign_id: z.string().describe("Campaign ID"),
      date_range: z.enum(["YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"]).default("LAST_7_DAYS")
        .describe("Date range"),
    },
    async ({ campaign_id, date_range }) => {
      try {
        const customer = getCustomer();

        const query = `
          SELECT
            search_term_view.search_term,
            search_term_view.status,
            ad_group.name,
            ad_group_criterion.keyword.text,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.conversions
          FROM search_term_view
          WHERE campaign.id = ${campaign_id}
            AND segments.date DURING ${date_range}
          ORDER BY metrics.impressions DESC
          LIMIT 100
        `;

        const results = asRows(await customer.query(query));

        const rows = results.map((row) => {
          const stv = field(row, "search_term_view");
          const ag = field(row, "ad_group");
          const agc = field(row, "ad_group_criterion");
          const kw = (agc.keyword ?? {}) as Record<string, unknown>;
          const m = field(row, "metrics");
          return {
            search_term: String(stv.search_term ?? ""),
            status: String(stv.status ?? ""),
            ad_group: String(ag.name ?? ""),
            matched_keyword: String(kw.text ?? ""),
            impressions: formatNumber(m.impressions as number),
            clicks: formatNumber(m.clicks as number),
            ctr: formatPercent(m.ctr as number),
            cost: formatCurrency(m.cost_micros as number),
            conversions: toNumber(m.conversions as number),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(rows) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  custom_query                                                     */
  /* ---------------------------------------------------------------- */
  server.tool(
    "custom_query",
    "Execute a raw GAQL (Google Ads Query Language) query. For advanced users who know the Google Ads API schema.",
    {
      query: z.string().describe("GAQL query string (e.g. 'SELECT campaign.id, metrics.clicks FROM campaign WHERE ...')"),
    },
    async ({ query }) => {
      try {
        const customer = getCustomer();
        const results = await customer.query(query);
        return { content: [{ type: "text" as const, text: jsonResult(results) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );
}
