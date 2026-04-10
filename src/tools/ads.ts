import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enums, ResourceNames } from "google-ads-api";
import { getCustomer, getCustomerId } from "../client.js";
import { formatCurrency, formatPercent, formatNumber, toNumber, jsonResult, successResult, errorResult } from "../utils.js";
import { asRows, field } from "../types.js";

export function registerAdTools(server: McpServer) {
  /* ---------------------------------------------------------------- */
  /*  list_ads                                                         */
  /* ---------------------------------------------------------------- */
  server.tool(
    "list_ads",
    "List ads for an ad group with performance metrics.",
    {
      ad_group_id: z.string().describe("Ad group ID"),
      date_range: z.enum(["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "ALL_TIME"]).default("LAST_30_DAYS")
        .describe("Date range for metrics"),
    },
    async ({ ad_group_id, date_range }) => {
      try {
        const customer = getCustomer();
        const dateFilter = date_range !== "ALL_TIME"
          ? `AND segments.date DURING ${date_range}`
          : "";

        const query = `
          SELECT
            ad_group_ad.ad.id,
            ad_group_ad.ad.type,
            ad_group_ad.ad.responsive_search_ad.headlines,
            ad_group_ad.ad.responsive_search_ad.descriptions,
            ad_group_ad.ad.final_urls,
            ad_group_ad.status,
            ad_group_ad.ad.strength,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions
          FROM ad_group_ad
          WHERE ad_group.id = ${ad_group_id}
            AND ad_group_ad.status != 'REMOVED'
            ${dateFilter}
          ORDER BY metrics.impressions DESC
          LIMIT 20
        `;

        const results = asRows(await customer.query(query));

        const ads = results.map((row) => {
          const aga = field(row, "ad_group_ad");
          const ad = (aga.ad ?? {}) as Record<string, unknown>;
          const rsa = (ad.responsive_search_ad ?? {}) as Record<string, unknown>;
          const m = field(row, "metrics");

          const headlines = (rsa.headlines as Array<Record<string, unknown>> ?? [])
            .map((h) => String(h.text ?? ""));
          const descriptions = (rsa.descriptions as Array<Record<string, unknown>> ?? [])
            .map((d) => String(d.text ?? ""));

          return {
            id: String(ad.id ?? ""),
            type: String(ad.type ?? ""),
            status: String(aga.status ?? ""),
            strength: String(ad.strength ?? ""),
            headlines,
            descriptions,
            final_urls: ad.final_urls as string[] ?? [],
            impressions: formatNumber(m.impressions as number),
            clicks: formatNumber(m.clicks as number),
            ctr: formatPercent(m.ctr as number),
            avg_cpc: formatCurrency(m.average_cpc as number),
            cost: formatCurrency(m.cost_micros as number),
            conversions: toNumber(m.conversions as number),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(ads) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  create_search_ad                                                 */
  /* ---------------------------------------------------------------- */
  server.tool(
    "create_search_ad",
    "Create a Responsive Search Ad (RSA) in an ad group. Provide 3-15 headlines and 2-4 descriptions. Ad is created PAUSED for review.",
    {
      ad_group_id: z.string().describe("Ad group ID"),
      headlines: z.array(z.string().max(30)).min(3).max(15)
        .describe("Headlines (max 30 chars each, 3-15 required)"),
      descriptions: z.array(z.string().max(90)).min(2).max(4)
        .describe("Descriptions (max 90 chars each, 2-4 required)"),
      final_url: z.string().describe("Landing page URL"),
      path1: z.string().max(15).optional().describe("Display URL path 1 (max 15 chars)"),
      path2: z.string().max(15).optional().describe("Display URL path 2 (max 15 chars)"),
    },
    async ({ ad_group_id, headlines, descriptions, final_url, path1, path2 }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          {
            entity: "ad_group_ad",
            operation: "create",
            resource: {
              ad_group: ResourceNames.adGroup(customerId, ad_group_id),
              status: enums.AdGroupAdStatus.PAUSED,
              ad: {
                final_urls: [final_url],
                responsive_search_ad: {
                  headlines: headlines.map((text) => ({ text })),
                  descriptions: descriptions.map((text) => ({ text })),
                  ...(path1 ? { path1 } : {}),
                  ...(path2 ? { path2 } : {}),
                },
              },
            },
          },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`RSA created (PAUSED) with ${headlines.length} headlines and ${descriptions.length} descriptions.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  update_ad_status                                                 */
  /* ---------------------------------------------------------------- */
  server.tool(
    "update_ad_status",
    "Enable or pause an ad.",
    {
      ad_group_id: z.string().describe("Ad group ID"),
      ad_id: z.string().describe("Ad ID"),
      status: z.enum(["ENABLED", "PAUSED"]).describe("New status"),
    },
    async ({ ad_group_id, ad_id, status }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          {
            entity: "ad_group_ad",
            operation: "update",
            resource: {
              resource_name: `customers/${customerId}/adGroupAds/${ad_group_id}~${ad_id}`,
              status: status === "ENABLED"
                ? enums.AdGroupAdStatus.ENABLED
                : enums.AdGroupAdStatus.PAUSED,
            },
          },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Ad ${ad_id} status changed to ${status}.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );
}
