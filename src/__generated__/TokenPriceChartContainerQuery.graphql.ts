/**
 * @generated SignedSource<<6d8452ab7bf1689c4122c8568613ebcd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type TokenPriceChartContainerQuery$variables = {
  limit: number;
  timeframe: string;
  tokenAddress: string;
};
export type TokenPriceChartContainerQuery$data = {
  readonly tokenPriceChart: ReadonlyArray<{
    readonly time: number;
    readonly value: number;
  }>;
};
export type TokenPriceChartContainerQuery = {
  response: TokenPriceChartContainerQuery$data;
  variables: TokenPriceChartContainerQuery$variables;
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
    "alias": null,
    "args": [
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
    ],
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
    "name": "TokenPriceChartContainerQuery",
    "selections": (v3/*: any*/),
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
    "name": "TokenPriceChartContainerQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "65147017636c1e7f0b4ca33dc94e665e",
    "id": null,
    "metadata": {},
    "name": "TokenPriceChartContainerQuery",
    "operationKind": "query",
    "text": "query TokenPriceChartContainerQuery(\n  $tokenAddress: String!\n  $timeframe: String!\n  $limit: Int!\n) {\n  tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {\n    time\n    value\n  }\n}\n"
  }
};
})();

(node as any).hash = "a07f5d2d4d6f754ab870e3993e204e1b";

export default node;
