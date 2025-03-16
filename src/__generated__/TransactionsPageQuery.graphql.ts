/**
 * @generated SignedSource<<33fa557d38fd76d087a1e4e428cb1c31>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TransactionsPageQuery$variables = {
  first: number;
};
export type TransactionsPageQuery$data = {
  readonly recentTransactions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly amountIn0: string;
        readonly amountIn1: string;
        readonly amountOut0: string;
        readonly amountOut1: string;
        readonly id: string;
        readonly timestamp: number;
        readonly token0: {
          readonly address: string;
          readonly id: string;
          readonly symbol: string | null;
          readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
        } | null;
        readonly token1: {
          readonly address: string;
          readonly id: string;
          readonly symbol: string | null;
          readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
        } | null;
        readonly txHash: string;
        readonly userAddress: string;
        readonly valueUSD: string | null;
      };
    }>;
    readonly pageInfo: {
      readonly endCursor: string | null;
      readonly hasNextPage: boolean;
    };
    readonly totalCount: number;
  };
};
export type TransactionsPageQuery = {
  response: TransactionsPageQuery$data;
  variables: TransactionsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
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
  "name": "txHash",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "timestamp",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "userAddress",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "address",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "symbol",
  "storageKey": null
},
v8 = [
  (v2/*: any*/),
  (v6/*: any*/),
  (v7/*: any*/),
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "TokenPairFragment"
  }
],
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "amountIn0",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "amountIn1",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "amountOut0",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "amountOut1",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "valueUSD",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": "PageInfo",
  "kind": "LinkedField",
  "name": "pageInfo",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasNextPage",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endCursor",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalCount",
  "storageKey": null
},
v16 = [
  (v2/*: any*/),
  (v6/*: any*/),
  (v7/*: any*/),
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
    "name": "TransactionsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SwapConnection",
        "kind": "LinkedField",
        "name": "recentTransactions",
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
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
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
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v14/*: any*/),
          (v15/*: any*/)
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
    "name": "TransactionsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SwapConnection",
        "kind": "LinkedField",
        "name": "recentTransactions",
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
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Token",
                    "kind": "LinkedField",
                    "name": "token0",
                    "plural": false,
                    "selections": (v16/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Token",
                    "kind": "LinkedField",
                    "name": "token1",
                    "plural": false,
                    "selections": (v16/*: any*/),
                    "storageKey": null
                  },
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v14/*: any*/),
          (v15/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b1c64d9f5338bfa7c582cd9d95dd9259",
    "id": null,
    "metadata": {},
    "name": "TransactionsPageQuery",
    "operationKind": "query",
    "text": "query TransactionsPageQuery(\n  $first: Int!\n) {\n  recentTransactions(first: $first) {\n    edges {\n      node {\n        id\n        txHash\n        timestamp\n        userAddress\n        token0 {\n          id\n          address\n          symbol\n          ...TokenPairFragment\n        }\n        token1 {\n          id\n          address\n          symbol\n          ...TokenPairFragment\n        }\n        amountIn0\n        amountIn1\n        amountOut0\n        amountOut1\n        valueUSD\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}\n\nfragment TokenPairFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageURI\n}\n"
  }
};
})();

(node as any).hash = "3cffdf8a182e6cef8d661cead2d36add";

export default node;
