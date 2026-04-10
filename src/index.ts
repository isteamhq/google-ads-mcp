import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerCampaignTools } from "./tools/campaigns.js";
import { registerAdGroupTools } from "./tools/ad-groups.js";
import { registerKeywordTools } from "./tools/keywords.js";
import { registerAdTools } from "./tools/ads.js";
import { registerBudgetTools } from "./tools/budgets.js";
import { registerReportTools } from "./tools/reports.js";
import { registerConversionTools } from "./tools/conversions.js";
import { registerAudienceTools } from "./tools/audiences.js";

/* ------------------------------------------------------------------ */
/*  MCP Server                                                         */
/* ------------------------------------------------------------------ */

const server = new McpServer(
  {
    name: "google-ads-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/* ------------------------------------------------------------------ */
/*  Register all tools                                                 */
/* ------------------------------------------------------------------ */

registerCampaignTools(server);    // 5 tools: list, create, update, pause, remove
registerAdGroupTools(server);     // 3 tools: list, create, update
registerKeywordTools(server);     // 4 tools: list, add, remove, keyword_ideas
registerAdTools(server);          // 3 tools: list, create_search_ad, update_ad_status
registerBudgetTools(server);      // 2 tools: list, update
registerReportTools(server);      // 5 tools: campaign, ad_group, keyword, search_terms, custom_query
registerConversionTools(server);  // 2 tools: list, create
registerAudienceTools(server);    // 3 tools: list, create, target

// Total: 27 tools

/* ------------------------------------------------------------------ */
/*  Start server                                                       */
/* ------------------------------------------------------------------ */

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Ads MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

/* ------------------------------------------------------------------ */
/*  Graceful shutdown                                                  */
/* ------------------------------------------------------------------ */

process.on("SIGINT", () => {
  console.error("Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("Shutting down...");
  process.exit(0);
});
