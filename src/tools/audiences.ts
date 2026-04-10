import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enums, ResourceNames } from "google-ads-api";
import { getCustomer, getCustomerId } from "../client.js";
import { jsonResult, successResult, errorResult } from "../utils.js";
import { asRows, field } from "../types.js";

export function registerAudienceTools(server: McpServer) {
  /* ---------------------------------------------------------------- */
  /*  list_audiences                                                   */
  /* ---------------------------------------------------------------- */
  server.tool(
    "list_audiences",
    "List all user lists (remarketing audiences) in the account.",
    {},
    async () => {
      try {
        const customer = getCustomer();

        const query = `
          SELECT
            user_list.id,
            user_list.name,
            user_list.type,
            user_list.size_for_display,
            user_list.size_for_search,
            user_list.membership_status,
            user_list.membership_life_span,
            user_list.match_rate_percentage
          FROM user_list
          WHERE user_list.membership_status = 'OPEN'
          ORDER BY user_list.name
          LIMIT 50
        `;

        const results = asRows(await customer.query(query));

        const audiences = results.map((row) => {
          const ul = field(row, "user_list");
          return {
            id: String(ul.id ?? ""),
            name: String(ul.name ?? ""),
            type: String(ul.type ?? ""),
            display_size: Number(ul.size_for_display ?? 0),
            search_size: Number(ul.size_for_search ?? 0),
            status: String(ul.membership_status ?? ""),
            life_span_days: Number(ul.membership_life_span ?? 0),
            match_rate: ul.match_rate_percentage ?? null,
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(audiences) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  create_audience                                                  */
  /* ---------------------------------------------------------------- */
  server.tool(
    "create_audience",
    "Create a website visitor remarketing audience (user list).",
    {
      name: z.string().describe("Audience name (e.g. 'Website Visitors - Last 30 Days')"),
      life_span_days: z.number().default(30).describe("How long a user stays in the list (days)"),
      url_contains: z.string().optional().describe("URL pattern to match (e.g. 'is.team' or 'is.team/pricing')"),
    },
    async ({ name, life_span_days, url_contains }) => {
      try {
        const customer = getCustomer();

        const resource: Record<string, unknown> = {
          name,
          membership_status: enums.UserListMembershipStatus.OPEN,
          membership_life_span: life_span_days,
        };

        if (url_contains) {
          resource.rule_based_user_list = {
            prepopulation_status: enums.UserListPrepopulationStatus.REQUESTED,
            flexible_rule_user_list: {
              inclusive_rule_operator: enums.UserListFlexibleRuleOperator.AND,
              inclusive_operands: [
                {
                  rule: {
                    rule_item_groups: [
                      {
                        rule_items: [
                          {
                            name: "url__",
                            string_rule_item: {
                              operator: enums.UserListStringRuleItemOperator.CONTAINS,
                              value: url_contains,
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          { entity: "user_list", operation: "create", resource },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Audience "${name}" created (${life_span_days} day retention).`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  target_audience                                                  */
  /* ---------------------------------------------------------------- */
  server.tool(
    "target_audience",
    "Target a remarketing audience in a specific campaign.",
    {
      campaign_id: z.string().describe("Campaign ID"),
      user_list_id: z.string().describe("User list (audience) ID"),
    },
    async ({ campaign_id, user_list_id }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          {
            entity: "campaign_criterion",
            operation: "create",
            resource: {
              campaign: ResourceNames.campaign(customerId, campaign_id),
              user_list: {
                user_list: ResourceNames.userList(customerId, user_list_id),
              },
            },
          },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Audience ${user_list_id} targeted in campaign ${campaign_id}.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );
}
