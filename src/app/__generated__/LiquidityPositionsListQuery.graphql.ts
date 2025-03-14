/**
 * @generated SignedSource<<6ef8a5827e9a4eaad8822a8491893c57>>
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
    readonly " $fragmentSpreads": FragmentRefs<"LiquidityPositionsList_userPositions">;
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
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "decimals",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "LiquidityPositionsList_userPositions"
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
                    "kind": "ScalarField",
                    "name": "totalSupply",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "reserve0",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "reserve1",
                    "storageKey": null
                  },
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
                "name": "userAddress",
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
    "cacheID": "13185d84dabcae5d538ad105c7e45b05",
    "id": null,
    "metadata": {},
    "name": "LiquidityPositionsListQuery",
    "operationKind": "query",
    "text": "query LiquidityPositionsListQuery(\n  $userAddress: String!\n) {\n  userPositions(userAddress: $userAddress) {\n    ...LiquidityPositionsList_userPositions\n  }\n}\n\nfragment LiquidityPositionsList_userPositions on UserPositions {\n  liquidityPositions {\n    id\n    pair {\n      id\n      address\n      totalSupply\n      reserve0\n      reserve1\n      token0 {\n        id\n        address\n        symbol\n        decimals\n      }\n      token1 {\n        id\n        address\n        symbol\n        decimals\n      }\n    }\n    userAddress\n    liquidityTokens\n  }\n}\n"
  }
};
})();

(node as any).hash = "b2a7917af2e73b0178e3ac3eef8a4e57";

export default node;
