/**
 * @generated SignedSource<<6489e7e10202d30d0e236c6418d337be>>
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
    readonly dailyVolumeUsd: string;
    readonly totalValueLockedUsd: string;
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
    "cacheID": "a069feec6dd33e300fe5a3ff5e422c13",
    "id": null,
    "metadata": {},
    "name": "GlobalProtocolMetricsQuery",
    "operationKind": "query",
    "text": "query GlobalProtocolMetricsQuery {\n  protocolMetrics {\n    dailyVolumeUsd\n    totalValueLockedUsd\n    volume1hChange\n    volume24hChange\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2bc2046b011d2042c1408caa7c87feb9";

export default node;
