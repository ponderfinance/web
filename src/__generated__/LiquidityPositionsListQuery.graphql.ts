/**
 * @generated SignedSource<<fed9b0c4da7ddd99ffdce7105def913b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LiquidityPositionsListQuery$variables = {
  userAddress: string;
};
export type LiquidityPositionsListQuery$data = {
  readonly userPositions: {
    readonly liquidityPositions: ReadonlyArray<{
      readonly " $fragmentSpreads": FragmentRefs<"LiquidityPositionItem_position">;
    }>;
  };
};
export type LiquidityPositionsListQuery = {
  response: LiquidityPositionsListQuery$data;
  variables: LiquidityPositionsListQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "userAddress"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "userAddress",
    "variableName": "userAddress"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "address",
  "storageKey": null
},
v4 = [
  (v2/*: any*/),
  (v3/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "symbol",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "LiquidityPositionsListQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UserPositions",
        "kind": "LinkedField",
        "name": "userPositions",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "LiquidityPosition",
            "kind": "LinkedField",
            "name": "liquidityPositions",
            "plural": true,
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "LiquidityPositionItem_position"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LiquidityPositionsListQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "UserPositions",
        "kind": "LinkedField",
        "name": "userPositions",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "LiquidityPosition",
            "kind": "LinkedField",
            "name": "liquidityPositions",
            "plural": true,
            "selections": [
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Pair",
                "kind": "LinkedField",
                "name": "pair",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Token",
                    "kind": "LinkedField",
                    "name": "token0",
                    "plural": false,
                    "selections": (v4/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Token",
                    "kind": "LinkedField",
                    "name": "token1",
                    "plural": false,
                    "selections": (v4/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "liquidityTokens",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "51350cd0fa0b49a67baeaaa2f98430a0",
    "id": null,
    "metadata": {},
    "name": "LiquidityPositionsListQuery",
    "operationKind": "query",
    "text": "query LiquidityPositionsListQuery(\n  $userAddress: String!\n) {\n  userPositions(userAddress: $userAddress) {\n    liquidityPositions {\n      ...LiquidityPositionItem_position\n      id\n    }\n  }\n}\n\nfragment LiquidityPositionItem_position on LiquidityPosition {\n  id\n  pair {\n    id\n    address\n    token0 {\n      id\n      address\n      symbol\n    }\n    token1 {\n      id\n      address\n      symbol\n    }\n  }\n  liquidityTokens\n}\n"
  }
};
})();

(node as any).hash = "d6714fdf0f9979323087951b1cbe28b8";

export default node;
