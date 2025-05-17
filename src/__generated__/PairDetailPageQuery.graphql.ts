/**
 * @generated SignedSource<<f1e57a75427f381d2b75cfcb0d0aa76d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PairDetailPageQuery$variables = {
  limit: number;
  pairAddress: string;
  timeframe: string;
};
export type PairDetailPageQuery$data = {
  readonly pairByAddress: {
    readonly address: string;
    readonly id: string;
    readonly poolAPR: number | null;
    readonly reserve0: string;
    readonly reserve1: string;
    readonly reserveUSD: string;
    readonly rewardAPR: number | null;
    readonly token0: {
      readonly address: string;
      readonly id: string;
      readonly priceUSD: string | null;
      readonly symbol: string | null;
    };
    readonly token1: {
      readonly address: string;
      readonly id: string;
      readonly priceUSD: string | null;
      readonly symbol: string | null;
    };
    readonly tvl: number;
    readonly volume24h: string | null;
    readonly volumeChange24h: number | null;
    readonly " $fragmentSpreads": FragmentRefs<"PriceChartContainer_pair">;
  } | null;
  readonly pairPriceChart: ReadonlyArray<{
    readonly " $fragmentSpreads": FragmentRefs<"PriceChartContainer_priceData">;
  }>;
  readonly pairVolumeChart: ReadonlyArray<{
    readonly " $fragmentSpreads": FragmentRefs<"PriceChartContainer_volumeData">;
  }>;
};
export type PairDetailPageQuery = {
  response: PairDetailPageQuery$data;
  variables: PairDetailPageQuery$variables;
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
  "name": "pairAddress"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeframe"
},
v3 = [
  {
    "kind": "Variable",
    "name": "address",
    "variableName": "pairAddress"
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
  "name": "address",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "reserve0",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "reserve1",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "reserveUSD",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tvl",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "volume24h",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "volumeChange24h",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "poolAPR",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "rewardAPR",
  "storageKey": null
},
v14 = [
  (v4/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "symbol",
    "storageKey": null
  },
  (v5/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "priceUSD",
    "storageKey": null
  }
],
v15 = {
  "alias": null,
  "args": null,
  "concreteType": "Token",
  "kind": "LinkedField",
  "name": "token0",
  "plural": false,
  "selections": (v14/*: any*/),
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "Token",
  "kind": "LinkedField",
  "name": "token1",
  "plural": false,
  "selections": (v14/*: any*/),
  "storageKey": null
},
v17 = [
  {
    "kind": "Variable",
    "name": "limit",
    "variableName": "limit"
  },
  {
    "kind": "Variable",
    "name": "pairAddress",
    "variableName": "pairAddress"
  },
  {
    "kind": "Variable",
    "name": "timeframe",
    "variableName": "timeframe"
  }
],
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "time",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "PairDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "Pair",
        "kind": "LinkedField",
        "name": "pairByAddress",
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
          (v15/*: any*/),
          (v16/*: any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "PriceChartContainer_pair"
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v17/*: any*/),
        "concreteType": "ChartDataPoint",
        "kind": "LinkedField",
        "name": "pairPriceChart",
        "plural": true,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "PriceChartContainer_priceData"
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v17/*: any*/),
        "concreteType": "VolumeChartData",
        "kind": "LinkedField",
        "name": "pairVolumeChart",
        "plural": true,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "PriceChartContainer_volumeData"
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
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "PairDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "Pair",
        "kind": "LinkedField",
        "name": "pairByAddress",
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
          (v15/*: any*/),
          (v16/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v17/*: any*/),
        "concreteType": "ChartDataPoint",
        "kind": "LinkedField",
        "name": "pairPriceChart",
        "plural": true,
        "selections": [
          (v18/*: any*/),
          (v19/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v17/*: any*/),
        "concreteType": "VolumeChartData",
        "kind": "LinkedField",
        "name": "pairVolumeChart",
        "plural": true,
        "selections": [
          (v18/*: any*/),
          (v19/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "volume0",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "volume1",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "count",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "da0e41334afd8e0c1c235a0cb0526564",
    "id": null,
    "metadata": {},
    "name": "PairDetailPageQuery",
    "operationKind": "query",
    "text": "query PairDetailPageQuery(\n  $pairAddress: String!\n  $timeframe: String!\n  $limit: Int!\n) {\n  pairByAddress(address: $pairAddress) {\n    id\n    address\n    reserve0\n    reserve1\n    reserveUSD\n    tvl\n    volume24h\n    volumeChange24h\n    poolAPR\n    rewardAPR\n    token0 {\n      id\n      symbol\n      address\n      priceUSD\n    }\n    token1 {\n      id\n      symbol\n      address\n      priceUSD\n    }\n    ...PriceChartContainer_pair\n  }\n  pairPriceChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {\n    ...PriceChartContainer_priceData\n  }\n  pairVolumeChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {\n    ...PriceChartContainer_volumeData\n  }\n}\n\nfragment PriceChartContainer_pair on Pair {\n  id\n  address\n  token0 {\n    id\n    symbol\n  }\n  token1 {\n    id\n    symbol\n  }\n}\n\nfragment PriceChartContainer_priceData on ChartDataPoint {\n  time\n  value\n}\n\nfragment PriceChartContainer_volumeData on VolumeChartData {\n  time\n  value\n  volume0\n  volume1\n  count\n}\n"
  }
};
})();

(node as any).hash = "e445a9dfd3c5cc8c06b748d225bd644e";

export default node;
