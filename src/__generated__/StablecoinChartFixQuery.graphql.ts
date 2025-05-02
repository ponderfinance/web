/**
 * @generated SignedSource<<e8993525598ee2ecb21e9492c072a1a4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type StablecoinChartFixQuery$variables = {
  limit: number;
  timeframe: string;
  tokenAddress: string;
};
export type StablecoinChartFixQuery$data = {
  readonly tokenPriceChart: ReadonlyArray<{
    readonly time: number;
    readonly value: number;
  }>;
};
export type StablecoinChartFixQuery = {
  response: StablecoinChartFixQuery$data;
  variables: StablecoinChartFixQuery$variables;
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
    "name": "StablecoinChartFixQuery",
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
    "name": "StablecoinChartFixQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "dadc37244914776eb4f6554c974914e3",
    "id": null,
    "metadata": {},
    "name": "StablecoinChartFixQuery",
    "operationKind": "query",
    "text": "query StablecoinChartFixQuery(\n  $tokenAddress: String!\n  $timeframe: String!\n  $limit: Int!\n) {\n  tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {\n    time\n    value\n  }\n}\n"
  }
};
})();

(node as any).hash = "450f6ecb78a81f3a368438df0c241259";

export default node;
