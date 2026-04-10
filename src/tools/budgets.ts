import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceNames } from "google-ads-api";
import { getCustomer, getCustomerId } from "../client.js";
import { toMicros, formatCurrency, jsonResult, successResult, errorResult } from "../utils.js";
import { asRows, field } from "../types.js";

export function registerBudgetTools(server: McpServer) {
  /* ---------------------------------------------------------------- */
  /*  list_budgets                                                     */
  /* ---------------------------------------------------------------- */
  server.tool(
    "list_budgets",
    "List all campaign budgets with their associated campaigns.",
    {},
    async () => {
      try {
        const customer = getCustomer();

        const query = `
          SELECT
            campaign_budget.id,
            campaign_budget.name,
            campaign_budget.amount_micros,
            campaign_budget.total_amount_micros,
            campaign_budget.status,
            campaign_budget.delivery_method,
            campaign.id,
            campaign.name,
            campaign.status
          FROM campaign_budget
          WHERE campaign_budget.status != 'REMOVED'
          ORDER BY campaign_budget.amount_micros DESC
          LIMIT 50
        `;

        const results = asRows(await customer.query(query));

        const budgets = results.map((row) => {
          const b = field(row, "campaign_budget");
          const c = field(row, "campaign");
          return {
            id: String(b.id ?? ""),
            name: String(b.name ?? ""),
            daily_budget: formatCurrency(b.amount_micros as number),
            total_budget: b.total_amount_micros ? formatCurrency(b.total_amount_micros as number) : null,
            status: String(b.status ?? ""),
            delivery: String(b.delivery_method ?? ""),
            campaign_id: String(c.id ?? ""),
            campaign_name: String(c.name ?? ""),
            campaign_status: String(c.status ?? ""),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(budgets) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  update_budget                                                    */
  /* ---------------------------------------------------------------- */
  server.tool(
    "update_budget",
    "Update a campaign budget's daily amount.",
    {
      budget_id: z.string().describe("Budget ID"),
      daily_budget: z.number().describe("New daily budget in USD"),
    },
    async ({ budget_id, daily_budget }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          {
            entity: "campaign_budget",
            operation: "update",
            resource: {
              resource_name: ResourceNames.campaignBudget(customerId, budget_id),
              amount_micros: toMicros(daily_budget),
            },
          },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Budget ${budget_id} updated to $${daily_budget}/day.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );
}
