import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enums, ResourceNames } from "google-ads-api";
import { getCustomer, getCustomerId } from "../client.js";
import { toMicros, formatCurrency, formatPercent, formatNumber, toNumber, jsonResult, successResult, errorResult } from "../utils.js";
import { asRows, field } from "../types.js";

export function registerCampaignTools(server: McpServer) {
  /* ---------------------------------------------------------------- */
  /*  list_campaigns                                                   */
  /* ---------------------------------------------------------------- */
  server.tool(
    "list_campaigns",
    "List all campaigns with key metrics. Optionally filter by status.",
    {
      status: z.enum(["ENABLED", "PAUSED", "REMOVED", "ALL"]).default("ALL")
        .describe("Filter by campaign status"),
      date_range: z.enum(["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH", "ALL_TIME"]).default("LAST_30_DAYS")
        .describe("Date range for metrics"),
    },
    async ({ status, date_range }) => {
      try {
        const customer = getCustomer();
        const statusFilter = status !== "ALL"
          ? `AND campaign.status = '${status}'`
          : "";
        const dateFilter = date_range !== "ALL_TIME"
          ? `AND segments.date DURING ${date_range}`
          : "";

        const query = `
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign.bidding_strategy_type,
            campaign_budget.amount_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.cost_per_conversion
          FROM campaign
          WHERE campaign.status != 'REMOVED'
            ${statusFilter}
            ${dateFilter}
          ORDER BY metrics.cost_micros DESC
          LIMIT 50
        `;

        const results = asRows(await customer.query(query));

        const campaigns = results.map((row) => {
          const c = field(row, "campaign");
          const cb = field(row, "campaign_budget");
          const m = field(row, "metrics");
          return {
            id: String(c.id ?? ""),
            name: String(c.name ?? ""),
            status: String(c.status ?? ""),
            channel: String(c.advertising_channel_type ?? ""),
            bidding: String(c.bidding_strategy_type ?? ""),
            daily_budget: formatCurrency(cb.amount_micros as number),
            impressions: formatNumber(m.impressions as number),
            clicks: formatNumber(m.clicks as number),
            ctr: formatPercent(m.ctr as number),
            avg_cpc: formatCurrency(m.average_cpc as number),
            cost: formatCurrency(m.cost_micros as number),
            conversions: toNumber(m.conversions as number),
            cost_per_conversion: formatCurrency(m.cost_per_conversion as number),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(campaigns) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  create_campaign                                                  */
  /* ---------------------------------------------------------------- */
  server.tool(
    "create_campaign",
    "Create a new search campaign with a daily budget. Campaign is created in PAUSED state — enable it manually after review.",
    {
      name: z.string().describe("Campaign name"),
      daily_budget: z.number().describe("Daily budget in USD (e.g. 50 for $50/day)"),
      bidding_strategy: z.enum(["MANUAL_CPC", "MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSIONS", "TARGET_CPA"]).default("MAXIMIZE_CLICKS")
        .describe("Bidding strategy"),
      target_cpa: z.number().optional().describe("Target CPA in USD (only for TARGET_CPA strategy)"),
      target_google_search: z.boolean().default(true).describe("Show ads on Google Search"),
      target_search_network: z.boolean().default(false).describe("Show ads on search partner sites"),
    },
    async ({ name, daily_budget, bidding_strategy, target_cpa, target_google_search, target_search_network }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        const budgetResourceName = ResourceNames.campaignBudget(customerId, "-1");

        // Build campaign resource with bidding strategy
        const campaignResource: Record<string, unknown> = {
          name,
          advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
          status: enums.CampaignStatus.PAUSED,
          campaign_budget: budgetResourceName,
          contains_eu_political_advertising: enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING,
          network_settings: {
            target_google_search,
            target_search_network,
          },
        };

        switch (bidding_strategy) {
          case "MANUAL_CPC":
            campaignResource.manual_cpc = { enhanced_cpc_enabled: false };
            break;
          case "MAXIMIZE_CLICKS":
            // Google Ads API uses target_spend for maximize clicks
            campaignResource.target_spend = {};
            break;
          case "MAXIMIZE_CONVERSIONS":
            campaignResource.maximize_conversions = {};
            break;
          case "TARGET_CPA":
            campaignResource.target_cpa = { target_cpa_micros: toMicros(target_cpa ?? 10) };
            break;
        }

        const operations = [
          {
            entity: "campaign_budget" as const,
            operation: "create" as const,
            resource: {
              resource_name: budgetResourceName,
              name: `${name} Budget`,
              delivery_method: enums.BudgetDeliveryMethod.STANDARD,
              amount_micros: toMicros(daily_budget),
            },
          },
          {
            entity: "campaign" as const,
            operation: "create" as const,
            resource: campaignResource,
          },
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await customer.mutateResources(operations as any);

        return { content: [{ type: "text" as const, text: successResult(`Campaign "${name}" created (PAUSED). Budget: $${daily_budget}/day.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  update_campaign                                                  */
  /* ---------------------------------------------------------------- */
  server.tool(
    "update_campaign",
    "Update campaign properties (name, status, network settings).",
    {
      campaign_id: z.string().describe("Campaign ID"),
      name: z.string().optional().describe("New campaign name"),
      status: z.enum(["ENABLED", "PAUSED"]).optional().describe("New status"),
      target_google_search: z.boolean().optional().describe("Show ads on Google Search"),
      target_search_network: z.boolean().optional().describe("Show ads on search partner sites"),
    },
    async ({ campaign_id, name, status, target_google_search, target_search_network }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        const resource: Record<string, unknown> = {
          resource_name: ResourceNames.campaign(customerId, campaign_id),
        };

        if (name) resource.name = name;
        if (status) {
          resource.status = status === "ENABLED"
            ? enums.CampaignStatus.ENABLED
            : enums.CampaignStatus.PAUSED;
        }
        if (target_google_search !== undefined || target_search_network !== undefined) {
          resource.network_settings = {
            ...(target_google_search !== undefined ? { target_google_search } : {}),
            ...(target_search_network !== undefined ? { target_search_network } : {}),
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          { entity: "campaign", operation: "update", resource },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Campaign ${campaign_id} updated.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  pause_campaign                                                   */
  /* ---------------------------------------------------------------- */
  server.tool(
    "pause_campaign",
    "Pause an active campaign.",
    {
      campaign_id: z.string().describe("Campaign ID to pause"),
    },
    async ({ campaign_id }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          {
            entity: "campaign",
            operation: "update",
            resource: {
              resource_name: ResourceNames.campaign(customerId, campaign_id),
              status: enums.CampaignStatus.PAUSED,
            },
          },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Campaign ${campaign_id} paused.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  remove_campaign                                                  */
  /* ---------------------------------------------------------------- */
  server.tool(
    "remove_campaign",
    "Permanently remove a campaign. This cannot be undone.",
    {
      campaign_id: z.string().describe("Campaign ID to remove"),
    },
    async ({ campaign_id }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          {
            entity: "campaign",
            operation: "remove",
            resource: ResourceNames.campaign(customerId, campaign_id),
          },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Campaign ${campaign_id} removed.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );
}
