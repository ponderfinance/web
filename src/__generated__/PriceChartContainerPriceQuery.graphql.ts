/**
 * @generated SignedSource<<65ff18f7307f6404b83b82bd82f79c7a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PriceChartContainerPriceQuery$variables = {
  limit: number;
  pairAddress: string;
  timeframe: string;
};
export type PriceChartContainerPriceQuery$data = {
  readonly pairPriceChart: ReadonlyArray<{
    readonly time: number;
    readonly value: number;
  }>;
};
export type PriceChartContainerPriceQuery = {
  response: PriceChartContainerPriceQuery$data;
  variables: PriceChartContainerPriceQuery$variables;
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
    "alias": null,
    "args": [
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
    "concreteType": "ChartDataPoint",
    "kind": "LinkedField",
    "name": "pairPriceChart",
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
    "name": "PriceChartContainerPriceQuery",
    "selections": (v3/*: any*/),
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
    "name": "PriceChartContainerPriceQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "933284953e469b9923c571dd718c947e",
    "id": null,
    "metadata": {},
    "name": "PriceChartContainerPriceQuery",
    "operationKind": "query",
    "text": "query PriceChartContainerPriceQuery(\n  $pairAddress: String!\n  $timeframe: String!\n  $limit: Int!\n) {\n  pairPriceChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {\n    time\n    value\n  }\n}\n"
  }
};
})();

(node as any).hash = "b7c376e0ddcd0fbcc2e567a01c2c3c7d";

export default node;
