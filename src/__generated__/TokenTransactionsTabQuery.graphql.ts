/**
 * @generated SignedSource<<0737e14cef6cc6f31aad195f0b99feec>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenTransactionsTabQuery$variables = {
  swapsPerPair: number;
  tokenAddress: string;
};
export type TokenTransactionsTabQuery$data = {
  readonly tokenByAddress: {
    readonly address: string;
    readonly decimals: number | null;
    readonly id: string;
    readonly imageUri: string | null;
    readonly pairsAsToken0: ReadonlyArray<{
      readonly address: string;
      readonly id: string;
      readonly swaps: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly amountIn0: string;
            readonly amountIn1: string;
            readonly amountOut0: string;
            readonly amountOut1: string;
            readonly id: string;
            readonly timestamp: string;
            readonly txHash: string;
            readonly userAddress: string;
            readonly valueUSD: string | null;
          };
        }>;
      };
      readonly token0: {
        readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
      };
      readonly token1: {
        readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
      };
    }>;
    readonly pairsAsToken1: ReadonlyArray<{
      readonly address: string;
      readonly id: string;
      readonly swaps: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly amountIn0: string;
            readonly amountIn1: string;
            readonly amountOut0: string;
            readonly amountOut1: string;
            readonly id: string;
            readonly timestamp: string;
            readonly txHash: string;
            readonly userAddress: string;
            readonly valueUSD: string | null;
          };
        }>;
      };
      readonly token0: {
        readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
      };
      readonly token1: {
        readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
      };
    }>;
    readonly symbol: string | null;
  } | null;
};
export type TokenTransactionsTabQuery = {
  response: TokenTransactionsTabQuery$data;
  variables: TokenTransactionsTabQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "swapsPerPair"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tokenAddress"
},
v2 = [
  {
    "kind": "Variable",
    "name": "address",
    "variableName": "tokenAddress"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "address",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "symbol",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "imageUri",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "decimals",
  "storageKey": null
},
v8 = [
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "TokenPairFragment"
  }
],
v9 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "first",
      "variableName": "swapsPerPair"
    }
  ],
  "concreteType": "SwapConnection",
  "kind": "LinkedField",
  "name": "swaps",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SwapEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "Swap",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v3/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "txHash",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "timestamp",
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
              "name": "amountIn0",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "amountIn1",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "amountOut0",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "amountOut1",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "valueUSD",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v10 = [
  (v3/*: any*/),
  (v4/*: any*/),
  {
    "alias": null,
    "args": null,
    "concreteType": "Token",
    "kind": "LinkedField",
    "name": "token0",
    "plural": false,
    "selections": (v8/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "Token",
    "kind": "LinkedField",
    "name": "token1",
    "plural": false,
    "selections": (v8/*: any*/),
    "storageKey": null
  },
  (v9/*: any*/)
],
v11 = [
  (v3/*: any*/),
  (v4/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  },
  (v5/*: any*/),
  (v7/*: any*/),
  (v6/*: any*/)
],
v12 = [
  (v3/*: any*/),
  (v4/*: any*/),
  {
    "alias": null,
    "args": null,
    "concreteType": "Token",
    "kind": "LinkedField",
    "name": "token0",
    "plural": false,
    "selections": (v11/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "Token",
    "kind": "LinkedField",
    "name": "token1",
    "plural": false,
    "selections": (v11/*: any*/),
    "storageKey": null
  },
  (v9/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TokenTransactionsTabQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Pair",
            "kind": "LinkedField",
            "name": "pairsAsToken0",
            "plural": true,
            "selections": (v10/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Pair",
            "kind": "LinkedField",
            "name": "pairsAsToken1",
            "plural": true,
            "selections": (v10/*: any*/),
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
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "TokenTransactionsTabQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Pair",
            "kind": "LinkedField",
            "name": "pairsAsToken0",
            "plural": true,
            "selections": (v12/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Pair",
            "kind": "LinkedField",
            "name": "pairsAsToken1",
            "plural": true,
            "selections": (v12/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b26d26c08033d37744755cb1259610af",
    "id": null,
    "metadata": {},
    "name": "TokenTransactionsTabQuery",
    "operationKind": "query",
    "text": "query TokenTransactionsTabQuery(\n  $tokenAddress: String!\n  $swapsPerPair: Int!\n) {\n  tokenByAddress(address: $tokenAddress) {\n    id\n    address\n    symbol\n    imageUri\n    decimals\n    pairsAsToken0 {\n      id\n      address\n      token0 {\n        ...TokenPairFragment\n        id\n      }\n      token1 {\n        ...TokenPairFragment\n        id\n      }\n      swaps(first: $swapsPerPair) {\n        edges {\n          node {\n            id\n            txHash\n            timestamp\n            userAddress\n            amountIn0\n            amountIn1\n            amountOut0\n            amountOut1\n            valueUSD\n          }\n        }\n      }\n    }\n    pairsAsToken1 {\n      id\n      address\n      token0 {\n        ...TokenPairFragment\n        id\n      }\n      token1 {\n        ...TokenPairFragment\n        id\n      }\n      swaps(first: $swapsPerPair) {\n        edges {\n          node {\n            id\n            txHash\n            timestamp\n            userAddress\n            amountIn0\n            amountIn1\n            amountOut0\n            amountOut1\n            valueUSD\n          }\n        }\n      }\n    }\n  }\n}\n\nfragment TokenPairFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageUri\n}\n"
  }
};
})();

(node as any).hash = "eb791fbec439f5a894cce4b6e91b203c";

export default node;
