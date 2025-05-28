/**
 * @generated SignedSource<<f57890cf9f2b69bc3b7e2856ecd2635d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SwapTokenDataQuery$variables = {
  skipTokenIn: boolean;
  skipTokenOut: boolean;
  tokenInAddress: string;
  tokenOutAddress: string;
};
export type SwapTokenDataQuery$data = {
  readonly tokenIn?: {
    readonly decimals: number | null;
    readonly name: string | null;
    readonly symbol: string | null;
    readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
  } | null;
  readonly tokenOut?: {
    readonly decimals: number | null;
    readonly name: string | null;
    readonly symbol: string | null;
    readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
  } | null;
};
export type SwapTokenDataQuery = {
  response: SwapTokenDataQuery$data;
  variables: SwapTokenDataQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "skipTokenIn"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "skipTokenOut"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tokenInAddress"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tokenOutAddress"
},
v4 = [
  {
    "kind": "Variable",
    "name": "address",
    "variableName": "tokenInAddress"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "decimals",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "symbol",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v8 = [
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "TokenPairFragment"
  },
  (v5/*: any*/),
  (v6/*: any*/),
  (v7/*: any*/)
],
v9 = [
  {
    "kind": "Variable",
    "name": "address",
    "variableName": "tokenOutAddress"
  }
],
v10 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "id",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "address",
    "storageKey": null
  },
  (v7/*: any*/),
  (v6/*: any*/),
  (v5/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "imageURI",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SwapTokenDataQuery",
    "selections": [
      {
        "condition": "skipTokenIn",
        "kind": "Condition",
        "passingValue": false,
        "selections": [
          {
            "alias": "tokenIn",
            "args": (v4/*: any*/),
            "concreteType": "Token",
            "kind": "LinkedField",
            "name": "tokenByAddress",
            "plural": false,
            "selections": (v8/*: any*/),
            "storageKey": null
          }
        ]
      },
      {
        "condition": "skipTokenOut",
        "kind": "Condition",
        "passingValue": false,
        "selections": [
          {
            "alias": "tokenOut",
            "args": (v9/*: any*/),
            "concreteType": "Token",
            "kind": "LinkedField",
            "name": "tokenByAddress",
            "plural": false,
            "selections": (v8/*: any*/),
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v3/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "SwapTokenDataQuery",
    "selections": [
      {
        "condition": "skipTokenIn",
        "kind": "Condition",
        "passingValue": false,
        "selections": [
          {
            "alias": "tokenIn",
            "args": (v4/*: any*/),
            "concreteType": "Token",
            "kind": "LinkedField",
            "name": "tokenByAddress",
            "plural": false,
            "selections": (v10/*: any*/),
            "storageKey": null
          }
        ]
      },
      {
        "condition": "skipTokenOut",
        "kind": "Condition",
        "passingValue": false,
        "selections": [
          {
            "alias": "tokenOut",
            "args": (v9/*: any*/),
            "concreteType": "Token",
            "kind": "LinkedField",
            "name": "tokenByAddress",
            "plural": false,
            "selections": (v10/*: any*/),
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "e4b5e3527147f40ae0cffbad588749d4",
    "id": null,
    "metadata": {},
    "name": "SwapTokenDataQuery",
    "operationKind": "query",
    "text": "query SwapTokenDataQuery(\n  $tokenInAddress: String!\n  $tokenOutAddress: String!\n  $skipTokenIn: Boolean!\n  $skipTokenOut: Boolean!\n) {\n  tokenIn: tokenByAddress(address: $tokenInAddress) @skip(if: $skipTokenIn) {\n    ...TokenPairFragment\n    decimals\n    symbol\n    name\n    id\n  }\n  tokenOut: tokenByAddress(address: $tokenOutAddress) @skip(if: $skipTokenOut) {\n    ...TokenPairFragment\n    decimals\n    symbol\n    name\n    id\n  }\n}\n\nfragment TokenPairFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageURI\n}\n"
  }
};
})();

(node as any).hash = "d9e721a1ecbe2cd93e4d668e044ae042";

export default node;
