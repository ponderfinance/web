/**
 * @generated SignedSource<<6d519bdc77d8372345532d806e0d0642>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ProtocolMetricsQuery$variables = {};
export type ProtocolMetricsQuery$data = {
  readonly protocolMetrics: {
    readonly dailyVolumeUSD: string;
    readonly totalValueLockedUSD: string;
    readonly volume24hChange: number | null;
  };
};
export type ProtocolMetricsQuery = {
  response: ProtocolMetricsQuery$data;
  variables: ProtocolMetricsQuery$variables;
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
  "name": "volume24hChange",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProtocolMetricsQuery",
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
          (v2/*: any*/)
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
    "name": "ProtocolMetricsQuery",
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
    "cacheID": "a5042b92301efa569fcfe71512728fd5",
    "id": null,
    "metadata": {},
    "name": "ProtocolMetricsQuery",
    "operationKind": "query",
    "text": "query ProtocolMetricsQuery {\n  protocolMetrics {\n    dailyVolumeUSD\n    totalValueLockedUSD\n    volume24hChange\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e3815741cd1c8c84770975ab22ba1662";

export default node;
