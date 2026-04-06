import { Service } from "fragment-ts";

@Service()
export class MarketplaceConfigService {
  getManifest() {
    return {
      packageName: "tuul_marketplace",
      routes: {
        catalog: "/marketplace/agents",
        publicBootstrap: "/public/agents/:slug/bootstrap",
        publicRuntime: "/runtime/agents/:agentId",
      },
      capabilities: {
        tenantScopedLinks: true,
        slugBasedIsolation: true,
        publicCatalog: true,
        embeddableAgentProfiles: true,
      },
    };
  }
}
