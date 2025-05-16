/**
 * @generated SignedSource<<87911f38bd60e5e7f8176e6e3a0f35e5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenDetailContentQuery$variables = {
  limit: number;
  timeframe: string;
  tokenAddress: string;
};
export type TokenDetailContentQuery$data = {
  readonly tokenByAddress: {
    readonly address: string;
    readonly decimals: number | null;
    readonly fdv: string;
    readonly id: string;
    readonly imageURI: string | null;
    readonly marketCap: string;
    readonly name: string | null;
    readonly priceChange24h: number | null;
    readonly priceUSD: string | null;
    readonly symbol: string | null;
    readonly tvl: string;
    readonly volumeUSD24h: string | null;
    readonly " $fragmentSpreads": FragmentRefs<"TokenPriceChartContainer_token">;
  } | null;
  readonly tokenPriceChart: ReadonlyArray<{
    readonly " $fragmentSpreads": FragmentRefs<"TokenPriceChartContainer_priceChart">;
  }>;
};
export type TokenDetailContentQuery = {
  response: TokenDetailContentQuery$data;
  variables: TokenDetailContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "limit"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeframe"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tokenAddress"
},
v3 = [
  {
    "kind": "Variable",
    "name": "address",
    "variableName": "tokenAddress"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "symbol",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "address",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "decimals",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "priceUSD",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "priceChange24h",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "volumeUSD24h",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tvl",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "marketCap",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "fdv",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "imageURI",
  "storageKey": null
},
v16 = [
  {
    "kind": "Variable",
    "name": "limit",
    "variableName": "limit"
  },
  {
    "kind": "Variable",
    "name": "timeframe",
    "variableName": "timeframe"
  },
  {
    "kind": "Variable",
    "name": "tokenAddress",
    "variableName": "tokenAddress"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TokenDetailContentQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/),
          (v9/*: any*/),
          (v10/*: any*/),
          (v11/*: any*/),
          (v12/*: any*/),
          (v13/*: any*/),
          (v14/*: any*/),
          (v15/*: any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "TokenPriceChartContainer_token"
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v16/*: any*/),
        "concreteType": "ChartDataPoint",
        "kind": "LinkedField",
        "name": "tokenPriceChart",
        "plural": true,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "TokenPriceChartContainer_priceChart"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "TokenDetailContentQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/),
          (v9/*: any*/),
          (v10/*: any*/),
          (v11/*: any*/),
          (v12/*: any*/),
          (v13/*: any*/),
          (v14/*: any*/),
          (v15/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v16/*: any*/),
        "concreteType": "ChartDataPoint",
        "kind": "LinkedField",
        "name": "tokenPriceChart",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "time",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "value",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "eeb356c37901e9eb82b07f861ed6539b",
    "id": null,
    "metadata": {},
    "name": "TokenDetailContentQuery",
    "operationKind": "query",
    "text": "query TokenDetailContentQuery(\n  $tokenAddress: String!\n  $timeframe: String!\n  $limit: Int!\n) {\n  tokenByAddress(address: $tokenAddress) {\n    id\n    name\n    symbol\n    address\n    decimals\n    priceUSD\n    priceChange24h\n    volumeUSD24h\n    tvl\n    marketCap\n    fdv\n    imageURI\n    ...TokenPriceChartContainer_token\n  }\n  tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {\n    ...TokenPriceChartContainer_priceChart\n  }\n}\n\nfragment TokenPriceChartContainer_priceChart on ChartDataPoint {\n  time\n  value\n}\n\nfragment TokenPriceChartContainer_token on Token {\n  id\n  address\n  symbol\n  name\n  decimals\n}\n"
  }
};
})();

(node as any).hash = "69bab9d418b9f3ad8ebdd8f603819f29";

export default node;
