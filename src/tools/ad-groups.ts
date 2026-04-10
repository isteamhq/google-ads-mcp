import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enums, ResourceNames } from "google-ads-api";
import { getCustomer, getCustomerId } from "../client.js";
import { toMicros, formatCurrency, formatPercent, formatNumber, toNumber, jsonResult, successResult, errorResult } from "../utils.js";
import { asRows, field } from "../types.js";

export function registerAdGroupTools(server: McpServer) {
  /* ---------------------------------------------------------------- */
  /*  list_ad_groups                                                   */
  /* ---------------------------------------------------------------- */
  server.tool(
    "list_ad_groups",
    "List ad groups for a campaign with metrics.",
    {
      campaign_id: z.string().describe("Campaign ID"),
      status: z.enum(["ENABLED", "PAUSED", "REMOVED", "ALL"]).default("ALL")
        .describe("Filter by status"),
      date_range: z.enum(["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "ALL_TIME"]).default("LAST_30_DAYS")
        .describe("Date range for metrics"),
    },
    async ({ campaign_id, status, date_range }) => {
      try {
        const customer = getCustomer();
        const statusFilter = status !== "ALL"
          ? `AND ad_group.status = '${status}'`
          : `AND ad_group.status != 'REMOVED'`;
        const dateFilter = date_range !== "ALL_TIME"
          ? `AND segments.date DURING ${date_range}`
          : "";

        const query = `
          SELECT
            ad_group.id,
            ad_group.name,
            ad_group.status,
            ad_group.type,
            ad_group.cpc_bid_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions
          FROM ad_group
          WHERE campaign.id = ${campaign_id}
            ${statusFilter}
            ${dateFilter}
          ORDER BY metrics.cost_micros DESC
          LIMIT 50
        `;

        const results = asRows(await customer.query(query));

        const adGroups = results.map((row) => {
          const ag = field(row, "ad_group");
          const m = field(row, "metrics");
          return {
            id: String(ag.id ?? ""),
            name: String(ag.name ?? ""),
            status: String(ag.status ?? ""),
            type: String(ag.type ?? ""),
            max_cpc: formatCurrency(ag.cpc_bid_micros as number),
            impressions: formatNumber(m.impressions as number),
            clicks: formatNumber(m.clicks as number),
            ctr: formatPercent(m.ctr as number),
            avg_cpc: formatCurrency(m.average_cpc as number),
            cost: formatCurrency(m.cost_micros as number),
            conversions: toNumber(m.conversions as number),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(adGroups) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  create_ad_group                                                  */
  /* ---------------------------------------------------------------- */
  server.tool(
    "create_ad_group",
    "Create a new ad group within a campaign.",
    {
      campaign_id: z.string().describe("Campaign ID"),
      name: z.string().describe("Ad group name"),
      max_cpc: z.number().optional().describe("Max CPC bid in USD (e.g. 2.5 for $2.50)"),
      status: z.enum(["ENABLED", "PAUSED"]).default("ENABLED").describe("Ad group status"),
    },
    async ({ campaign_id, name, max_cpc, status }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        const resource: Record<string, unknown> = {
          name,
          campaign: ResourceNames.campaign(customerId, campaign_id),
          status: status === "ENABLED" ? enums.AdGroupStatus.ENABLED : enums.AdGroupStatus.PAUSED,
          type: enums.AdGroupType.SEARCH_STANDARD,
        };

        if (max_cpc !== undefined) {
          resource.cpc_bid_micros = toMicros(max_cpc);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          { entity: "ad_group", operation: "create", resource },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Ad group "${name}" created.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  update_ad_group                                                  */
  /* ---------------------------------------------------------------- */
  server.tool(
    "update_ad_group",
    "Update an ad group's name, bid, or status.",
    {
      ad_group_id: z.string().describe("Ad group ID"),
      name: z.string().optional().describe("New name"),
      max_cpc: z.number().optional().describe("New max CPC bid in USD"),
      status: z.enum(["ENABLED", "PAUSED"]).optional().describe("New status"),
    },
    async ({ ad_group_id, name, max_cpc, status }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        const resource: Record<string, unknown> = {
          resource_name: ResourceNames.adGroup(customerId, ad_group_id),
        };

        if (name) resource.name = name;
        if (max_cpc !== undefined) resource.cpc_bid_micros = toMicros(max_cpc);
        if (status) {
          resource.status = status === "ENABLED"
            ? enums.AdGroupStatus.ENABLED
            : enums.AdGroupStatus.PAUSED;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          { entity: "ad_group", operation: "update", resource },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Ad group ${ad_group_id} updated.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );
}
