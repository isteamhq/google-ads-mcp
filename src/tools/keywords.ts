import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { enums, ResourceNames, services } from "google-ads-api";
import { getCustomer, getCustomerId } from "../client.js";
import { formatCurrency, formatNumber, formatPercent, toNumber, jsonResult, successResult, errorResult } from "../utils.js";
import { asRows, field } from "../types.js";

export function registerKeywordTools(server: McpServer) {
  /* ---------------------------------------------------------------- */
  /*  list_keywords                                                    */
  /* ---------------------------------------------------------------- */
  server.tool(
    "list_keywords",
    "List keywords for an ad group with performance metrics.",
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
            ad_group_criterion.criterion_id,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.status,
            ad_group_criterion.quality_info.quality_score,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions
          FROM ad_group_criterion
          WHERE ad_group.id = ${ad_group_id}
            AND ad_group_criterion.type = 'KEYWORD'
            AND ad_group_criterion.status != 'REMOVED'
            ${dateFilter}
          ORDER BY metrics.cost_micros DESC
          LIMIT 100
        `;

        const results = asRows(await customer.query(query));

        const keywords = results.map((row) => {
          const agc = field(row, "ad_group_criterion");
          const kw = (agc.keyword ?? {}) as Record<string, unknown>;
          const qi = (agc.quality_info ?? {}) as Record<string, unknown>;
          const m = field(row, "metrics");
          return {
            id: String(agc.criterion_id ?? ""),
            text: String(kw.text ?? ""),
            match_type: String(kw.match_type ?? ""),
            status: String(agc.status ?? ""),
            quality_score: qi.quality_score ?? null,
            impressions: formatNumber(m.impressions as number),
            clicks: formatNumber(m.clicks as number),
            ctr: formatPercent(m.ctr as number),
            avg_cpc: formatCurrency(m.average_cpc as number),
            cost: formatCurrency(m.cost_micros as number),
            conversions: toNumber(m.conversions as number),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(keywords) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  add_keywords                                                     */
  /* ---------------------------------------------------------------- */
  server.tool(
    "add_keywords",
    "Add one or more keywords to an ad group.",
    {
      ad_group_id: z.string().describe("Ad group ID"),
      keywords: z.array(z.object({
        text: z.string().describe("Keyword text"),
        match_type: z.enum(["EXACT", "PHRASE", "BROAD"]).default("PHRASE").describe("Match type"),
      })).describe("Keywords to add"),
    },
    async ({ ad_group_id, keywords }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        const matchTypeMap: Record<string, number> = {
          EXACT: enums.KeywordMatchType.EXACT,
          PHRASE: enums.KeywordMatchType.PHRASE,
          BROAD: enums.KeywordMatchType.BROAD,
        };

        const operations = keywords.map((kw) => ({
          entity: "ad_group_criterion" as const,
          operation: "create" as const,
          resource: {
            ad_group: ResourceNames.adGroup(customerId, ad_group_id),
            keyword: {
              text: kw.text,
              match_type: matchTypeMap[kw.match_type],
            },
            status: enums.AdGroupCriterionStatus.ENABLED,
          },
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources(operations as any);

        return { content: [{ type: "text" as const, text: successResult(`${keywords.length} keyword(s) added to ad group ${ad_group_id}.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  remove_keyword                                                   */
  /* ---------------------------------------------------------------- */
  server.tool(
    "remove_keyword",
    "Remove a keyword from an ad group.",
    {
      ad_group_id: z.string().describe("Ad group ID"),
      criterion_id: z.string().describe("Keyword criterion ID"),
    },
    async ({ ad_group_id, criterion_id }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await customer.mutateResources([
          {
            entity: "ad_group_criterion",
            operation: "remove",
            resource: `customers/${customerId}/adGroupCriteria/${ad_group_id}~${criterion_id}`,
          },
        ] as any);

        return { content: [{ type: "text" as const, text: successResult(`Keyword ${criterion_id} removed from ad group ${ad_group_id}.`) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  keyword_ideas                                                    */
  /* ---------------------------------------------------------------- */
  server.tool(
    "keyword_ideas",
    "Get keyword suggestions with search volume and CPC estimates using Google Keyword Planner. Great for research before creating campaigns.",
    {
      keywords: z.array(z.string()).describe("Seed keywords (e.g. ['project management', 'ai tools'])"),
      language: z.string().default("1000").describe("Language constant ID (1000=English, 1012=Turkish)"),
      location: z.string().default("2840").describe("Geo target constant ID (2840=US, 2792=Turkey)"),
      page_size: z.number().default(20).describe("Number of results (max 50)"),
    },
    async ({ keywords, language, location, page_size }) => {
      try {
        const customer = getCustomer();
        const customerId = getCustomerId();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
          customer_id: customerId,
          page_size: Math.min(page_size, 50),
          keyword_seed: new services.KeywordSeed({ keywords }),
          geo_target_constants: [`geoTargetConstants/${location}`],
          language: `languageConstants/${language}`,
          keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
          include_adult_keywords: false,
          page_token: "",
          keyword_annotation: [],
        } as unknown as Parameters<typeof customer.keywordPlanIdeas.generateKeywordIdeas>[0]);

        const ideas = ((response.results ?? []) as unknown as Array<Record<string, unknown>>).map((idea) => {
          const metrics = (idea.keyword_idea_metrics ?? {}) as Record<string, unknown>;
          return {
            keyword: String(idea.text ?? ""),
            avg_monthly_searches: toNumber(metrics.avg_monthly_searches as number),
            competition: String(metrics.competition ?? ""),
            low_bid: formatCurrency(metrics.low_top_of_page_bid_micros as number),
            high_bid: formatCurrency(metrics.high_top_of_page_bid_micros as number),
          };
        });

        return { content: [{ type: "text" as const, text: jsonResult(ideas) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: errorResult(error) }], isError: true };
      }
    }
  );
}
