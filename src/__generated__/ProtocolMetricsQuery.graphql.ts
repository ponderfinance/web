/**
 * @generated SignedSource<<d393dc368bef0d4f8501edbc7ec07266>>
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
    readonly dailyVolumeUsd: string;
    readonly totalValueLockedUsd: string;
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
  "name": "dailyVolumeUsd",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalValueLockedUsd",
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
    "cacheID": "54995847ca5a5e50053655d2e8115012",
    "id": null,
    "metadata": {},
    "name": "ProtocolMetricsQuery",
    "operationKind": "query",
    "text": "query ProtocolMetricsQuery {\n  protocolMetrics {\n    dailyVolumeUsd\n    totalValueLockedUsd\n    volume24hChange\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "c600c0627372acacf8f4f5adb655ddf4";

export default node;
