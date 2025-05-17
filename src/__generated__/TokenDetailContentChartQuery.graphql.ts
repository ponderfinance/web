/**
 * @generated SignedSource<<735a14c57d1ca01f55a60e272f9f0345>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenDetailContentChartQuery$variables = {
  limit: number;
  timeframe: string;
  tokenAddress: string;
};
export type TokenDetailContentChartQuery$data = {
  readonly tokenPriceChart: ReadonlyArray<{
    readonly " $fragmentSpreads": FragmentRefs<"TokenPriceChartContainer_priceChart">;
  }>;
};
export type TokenDetailContentChartQuery = {
  response: TokenDetailContentChartQuery$data;
  variables: TokenDetailContentChartQuery$variables;
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
    "name": "TokenDetailContentChartQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
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
    "name": "TokenDetailContentChartQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
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
    "cacheID": "70cb29a542fc5ae41fb2e2a96694420d",
    "id": null,
    "metadata": {},
    "name": "TokenDetailContentChartQuery",
    "operationKind": "query",
    "text": "query TokenDetailContentChartQuery(\n  $tokenAddress: String!\n  $timeframe: String!\n  $limit: Int!\n) {\n  tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {\n    ...TokenPriceChartContainer_priceChart\n  }\n}\n\nfragment TokenPriceChartContainer_priceChart on ChartDataPoint {\n  time\n  value\n}\n"
  }
};
})();

(node as any).hash = "8d6317d2c01363e96c0c3d12c11f6988";

export default node;
