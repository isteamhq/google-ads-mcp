import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enums } from "google-ads-api";
import { getCustomer } from "../client.js";
import { jsonResult, successResult, errorResult } from "../utils.js";
import { asRows, field } from "../types.js";

export function registerConversionTools(server: McpServer) {
  /* ---------------------------------------------------------------- */
  /*  list_conversions                                                 */
  /* ---------------------------------------------------------------- */
  server.tool(
    "list_conversions",
    "List all conversion actions configured in the account.",
    {},
    async () => {
      try {
        const customer = getCustomer();

        const query = `
          SELECT
            conversion_action.id,
            conversion_action.name,
            conversion_action.type,
            conversion_action.category,
            conversion_action.status,
            conversion_action.value_settings.default_value,
            conversion_action.counting_type
          FROM conversion_action
          WHERE conversion_action.status != 'REMOVED'
          ORDER BY conversion_action.name
          LIMIT 50
        `;

        const results = asRows(await customer.query(query));

        const conversions = results.map((row) => {
          const ca = field(row, "conversion_action");
          const vs = (ca.value_settings ?? {}) as Record<string, unknown>;
          return {
            id: String(ca.id ?? ""),
            name: String(ca.name ?? ""),
            type: String(ca.type ?? ""),
            category: String(ca.category ?? ""),
            status: String(ca.status ?? ""),
            counting: String(ca.counting_type ?? ""),
            default_value: vs.default_value ?? null,
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(conversions) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  create_conversion_action                                         */
  /* ---------------------------------------------------------------- */
  server.tool(
    "create_conversion_action",
    "Create a new conversion tracking action (e.g. sign-up, purchase).",
    {
      name: z.string().describe("Conversion action name (e.g. 'Website Signup')"),
      category: z.enum(["DEFAULT", "PURCHASE", "SIGNUP", "SUBMIT_LEAD_FORM", "PAGE_VIEW", "ADD_TO_CART", "BEGIN_CHECKOUT", "SUBSCRIBE_PAID", "CONTACT", "BOOK_APPOINTMENT"])
        .default("SIGNUP").describe("Conversion category"),
      type: z.enum(["WEBPAGE", "UPLOAD_CLICKS"]).default("WEBPAGE").describe("Conversion type"),
      default_value: z.number().optional().describe("Default conversion value in USD"),
      counting: z.enum(["ONE_PER_CLICK", "MANY_PER_CLICK"]).default("ONE_PER_CLICK")
        .describe("Count one conversion per click or every conversion"),
    },
    async ({ name, category, type, default_value, counting }) => {
      try {
        const customer = getCustomer();

        const categoryMap: Record<string, number> = {
          DEFAULT: enums.ConversionActionCategory.DEFAULT,
          PURCHASE: enums.ConversionActionCategory.PURCHASE,
          SIGNUP: enums.ConversionActionCategory.SIGNUP,
          SUBMIT_LEAD_FORM: enums.ConversionActionCategory.SUBMIT_LEAD_FORM,
          PAGE_VIEW: enums.ConversionActionCategory.PAGE_VIEW,
          ADD_TO_CART: enums.ConversionActionCategory.ADD_TO_CART,
          BEGIN_CHECKOUT: enums.ConversionActionCategory.BEGIN_CHECKOUT,
          SUBSCRIBE_PAID: enums.ConversionActionCategory.SUBSCRIBE_PAID,
          CONTACT: enums.ConversionActionCategory.CONTACT,
          BOOK_APPOINTMENT: enums.ConversionActionCategory.BOOK_APPOINTMENT,
        };

        const typeMap: Record<string, number> = {
          WEBPAGE: enums.ConversionActionType.WEBPAGE,
          UPLOAD_CLICKS: enums.ConversionActionType.UPLOAD_CLICKS,
        };

        const countingMap: Record<string, number> = {
          ONE_PER_CLICK: enums.ConversionActionCountingType.ONE_PER_CLICK,
          MANY_PER_CLICK: enums.ConversionActionCountingType.MANY_PER_CLICK,
        };

        const resource: Record<string, unknown> = {
          name,
          type: typeMap[type],
          category: categoryMap[category],
          status: enums.ConversionActionStatus.ENABLED,
          counting_type: countingMap[counting],
        };

        if (default_value !== undefined) {
          resource.value_settings = {
            default_value,
            always_use_default_value: false,
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          { entity: "conversion_action", operation: "create", resource },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Conversion action "${name}" created.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );
}
