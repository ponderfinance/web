/**
 * @generated SignedSource<<1d0047ae1790ac5644c5ff10614f1388>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PriceChartContainerVolumeQuery$variables = {
  limit: number;
  pairAddress: string;
  timeframe: string;
};
export type PriceChartContainerVolumeQuery$data = {
  readonly pairVolumeChart: ReadonlyArray<{
    readonly count: number | null;
    readonly time: number;
    readonly value: number;
    readonly volume0: number | null;
    readonly volume1: number | null;
  }>;
};
export type PriceChartContainerVolumeQuery = {
  response: PriceChartContainerVolumeQuery$data;
  variables: PriceChartContainerVolumeQuery$variables;
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
    "concreteType": "VolumeChartData",
    "kind": "LinkedField",
    "name": "pairVolumeChart",
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
      },
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
    "name": "PriceChartContainerVolumeQuery",
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
    "name": "PriceChartContainerVolumeQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "0bdab4e12f40f2f9c3a31ed0661a57d7",
    "id": null,
    "metadata": {},
    "name": "PriceChartContainerVolumeQuery",
    "operationKind": "query",
    "text": "query PriceChartContainerVolumeQuery(\n  $pairAddress: String!\n  $timeframe: String!\n  $limit: Int!\n) {\n  pairVolumeChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {\n    time\n    value\n    volume0\n    volume1\n    count\n  }\n}\n"
  }
};
})();

(node as any).hash = "753eaf230de813c10d6552e589c943fd";

export default node;
