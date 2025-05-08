/**
 * @generated SignedSource<<5b3b6be58bcf1891587977684a967d9a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, GraphQLSubscription } from 'relay-runtime';
export type GlobalProtocolMetricsSubscription$variables = {};
export type GlobalProtocolMetricsSubscription$data = {
  readonly protocolMetricsUpdated: {
    readonly dailyVolumeUSD: string;
    readonly totalValueLockedUSD: string;
    readonly volume1hChange: number | null;
    readonly volume24hChange: number | null;
  };
};
export type GlobalProtocolMetricsSubscription = {
  response: GlobalProtocolMetricsSubscription$data;
  variables: GlobalProtocolMetricsSubscription$variables;
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
    "name": "GlobalProtocolMetricsSubscription",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ProtocolMetric",
        "kind": "LinkedField",
        "name": "protocolMetricsUpdated",
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
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "GlobalProtocolMetricsSubscription",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ProtocolMetric",
        "kind": "LinkedField",
        "name": "protocolMetricsUpdated",
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
    "cacheID": "140ce672bf9013ed60c45e6db943ee13",
    "id": null,
    "metadata": {},
    "name": "GlobalProtocolMetricsSubscription",
    "operationKind": "subscription",
    "text": "subscription GlobalProtocolMetricsSubscription {\n  protocolMetricsUpdated {\n    dailyVolumeUSD\n    totalValueLockedUSD\n    volume1hChange\n    volume24hChange\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "7bb32c9469f08427b4e58463522519a7";

export default node;
