import {
  ProductSearchConnector,
  SearchInput,
  NormalizedInventoryResult,
} from "../types";

function createStub(name: string, note: string): ProductSearchConnector {
  return {
    name,
    enabled: () => false,
    search: async (_input: SearchInput): Promise<NormalizedInventoryResult[]> => {
      console.log(`[${name}] ${note}`);
      return [];
    },
  };
}

export const WalmartConnector = createStub(
  "WalmartConnector",
  "Requires Walmart Affiliate API access. See https://developer.walmart.com/"
);

export const TargetConnector = createStub(
  "TargetConnector",
  "Requires Target API partnership. No public product API available."
);

export const MeijerConnector = createStub(
  "MeijerConnector",
  "Requires Meijer API access. No public API currently available."
);

export const KrogerConnector = createStub(
  "KrogerConnector",
  "Requires Kroger API key. See https://developer.kroger.com/"
);

export const ShopifyMerchantConnector = createStub(
  "ShopifyMerchantConnector",
  "Requires Shopify store credentials and Storefront API token."
);

export const SquareMerchantConnector = createStub(
  "SquareMerchantConnector",
  "Requires Square API key and merchant authorization."
);

export const GoogleMerchantLocalInventoryConnector = createStub(
  "GoogleMerchantLocalInventoryConnector",
  "Requires Google Merchant Center API access and retailer feed partnership."
);

export const ALL_STUBS = [
  WalmartConnector,
  TargetConnector,
  MeijerConnector,
  KrogerConnector,
  ShopifyMerchantConnector,
  SquareMerchantConnector,
  GoogleMerchantLocalInventoryConnector,
];
