/**
 * @generated SignedSource<<c0eb0391be014bf14a3e4d3b011a1a66>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type TokenChartContainerQuery$variables = {
  limit: number;
  timeframe: string;
  tokenAddress: string;
};
export type TokenChartContainerQuery$data = {
  readonly tokenPriceChart: ReadonlyArray<{
    readonly time: number;
    readonly value: number;
  }>;
};
export type TokenChartContainerQuery = {
  response: TokenChartContainerQuery$data;
  variables: TokenChartContainerQuery$variables;
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
    "name": "TokenChartContainerQuery",
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
    "name": "TokenChartContainerQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "0b41731b136e23908316c60edc9594c5",
    "id": null,
    "metadata": {},
    "name": "TokenChartContainerQuery",
    "operationKind": "query",
    "text": "query TokenChartContainerQuery(\n  $tokenAddress: String!\n  $timeframe: String!\n  $limit: Int!\n) {\n  tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {\n    time\n    value\n  }\n}\n"
  }
};
})();

(node as any).hash = "5de12f71051149c98a403762b06a452a";

export default node;
