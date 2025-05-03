/**
 * @generated SignedSource<<69857cbe17b60d97456cd01988765fe2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type GlobalProtocolMetricsQuery$variables = {};
export type GlobalProtocolMetricsQuery$data = {
  readonly protocolMetrics: {
    readonly dailyVolumeUSD: string;
    readonly totalValueLockedUSD: string;
    readonly volume1hChange: number | null;
    readonly volume24hChange: number | null;
  };
};
export type GlobalProtocolMetricsQuery = {
  response: GlobalProtocolMetricsQuery$data;
  variables: GlobalProtocolMetricsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "dailyVolumeUSD",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalValueLockedUSD",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "volume1hChange",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "volume24hChange",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "GlobalProtocolMetricsQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ProtocolMetric",
        "kind": "LinkedField",
        "name": "protocolMetrics",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "GlobalProtocolMetricsQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ProtocolMetric",
        "kind": "LinkedField",
        "name": "protocolMetrics",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2595519bf8a19c11298b211e0098934a",
    "id": null,
    "metadata": {},
    "name": "GlobalProtocolMetricsQuery",
    "operationKind": "query",
    "text": "query GlobalProtocolMetricsQuery {\n  protocolMetrics {\n    dailyVolumeUSD\n    totalValueLockedUSD\n    volume1hChange\n    volume24hChange\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0a9012091dd224ae3218b5cc90839c9d";

export default node;
