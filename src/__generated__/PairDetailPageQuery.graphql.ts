/**
 * @generated SignedSource<<5648755785ec38516b531935144be533>>
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
    readonly reserve0: string;
    readonly reserve1: string;
    readonly token0: {
      readonly address: string;
      readonly id: string;
      readonly symbol: string | null;
    };
    readonly token1: {
      readonly address: string;
      readonly id: string;
      readonly symbol: string | null;
    };
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
v8 = [
  (v4/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "symbol",
    "storageKey": null
  },
  (v5/*: any*/)
],
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "Token",
  "kind": "LinkedField",
  "name": "token0",
  "plural": false,
  "selections": (v8/*: any*/),
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "Token",
  "kind": "LinkedField",
  "name": "token1",
  "plural": false,
  "selections": (v8/*: any*/),
  "storageKey": null
},
v11 = [
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
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "time",
  "storageKey": null
},
v13 = {
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
          (v9/*: any*/),
          (v10/*: any*/),
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
        "args": (v11/*: any*/),
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
        "args": (v11/*: any*/),
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
          (v9/*: any*/),
          (v10/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v11/*: any*/),
        "concreteType": "ChartDataPoint",
        "kind": "LinkedField",
        "name": "pairPriceChart",
        "plural": true,
        "selections": [
          (v12/*: any*/),
          (v13/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v11/*: any*/),
        "concreteType": "VolumeChartData",
        "kind": "LinkedField",
        "name": "pairVolumeChart",
        "plural": true,
        "selections": [
          (v12/*: any*/),
          (v13/*: any*/),
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
    "cacheID": "9ba939e9ae7d90ee484e7c686330873e",
    "id": null,
    "metadata": {},
    "name": "PairDetailPageQuery",
    "operationKind": "query",
    "text": "query PairDetailPageQuery(\n  $pairAddress: String!\n  $timeframe: String!\n  $limit: Int!\n) {\n  pairByAddress(address: $pairAddress) {\n    id\n    address\n    reserve0\n    reserve1\n    token0 {\n      id\n      symbol\n      address\n    }\n    token1 {\n      id\n      symbol\n      address\n    }\n    ...PriceChartContainer_pair\n  }\n  pairPriceChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {\n    ...PriceChartContainer_priceData\n  }\n  pairVolumeChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {\n    ...PriceChartContainer_volumeData\n  }\n}\n\nfragment PriceChartContainer_pair on Pair {\n  id\n  address\n  token0 {\n    id\n    symbol\n  }\n  token1 {\n    id\n    symbol\n  }\n}\n\nfragment PriceChartContainer_priceData on ChartDataPoint {\n  time\n  value\n}\n\nfragment PriceChartContainer_volumeData on VolumeChartData {\n  time\n  value\n  volume0\n  volume1\n  count\n}\n"
  }
};
})();

(node as any).hash = "2b415dc2c74b056468f58994aeef2a2d";

export default node;
