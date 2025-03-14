/**
 * @generated SignedSource<<a1d26de2be89f1f77f9791ae11d92edc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PoolPageQuery$variables = {
  userAddress: string;
};
export type PoolPageQuery$data = {
  readonly userPositions: {
    readonly liquidityPositions: ReadonlyArray<{
      readonly " $fragmentSpreads": FragmentRefs<"LiquidityPositionItem_position">;
    }>;
  };
};
export type PoolPageQuery = {
  response: PoolPageQuery$data;
  variables: PoolPageQuery$variables;
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
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "decimals",
    "storageKey": null
  },
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PoolPageQuery",
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
    "name": "PoolPageQuery",
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
    "cacheID": "8871dd2bbad2435a5355ca6cfad73992",
    "id": null,
    "metadata": {},
    "name": "PoolPageQuery",
    "operationKind": "query",
    "text": "query PoolPageQuery(\n  $userAddress: String!\n) {\n  userPositions(userAddress: $userAddress) {\n    liquidityPositions {\n      ...LiquidityPositionItem_position\n      id\n    }\n  }\n}\n\nfragment LiquidityPositionItem_position on LiquidityPosition {\n  id\n  pair {\n    id\n    address\n    token0 {\n      id\n      address\n      symbol\n      ...TokenPairFragment\n    }\n    token1 {\n      id\n      address\n      symbol\n      ...TokenPairFragment\n    }\n  }\n  liquidityTokens\n}\n\nfragment TokenPairFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageURI\n}\n"
  }
};
})();

(node as any).hash = "0e148b4c5a6a24eb043b49db62bd9d9d";

export default node;
