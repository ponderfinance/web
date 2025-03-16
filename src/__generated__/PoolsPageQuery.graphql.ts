/**
 * @generated SignedSource<<1147290c0403badbe4383362f5208b05>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type OrderDirection = "asc" | "desc" | "%future added value";
export type PairOrderBy = "createdAt" | "reserveUSD" | "volumeUSD" | "%future added value";
export type PoolsPageQuery$variables = {
  first: number;
  orderBy: PairOrderBy;
  orderDirection: OrderDirection;
};
export type PoolsPageQuery$data = {
  readonly pairs: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly address: string;
        readonly id: string;
        readonly reserveUSD: string;
        readonly token0: {
          readonly address: string;
          readonly decimals: number | null;
          readonly id: string;
          readonly symbol: string | null;
          readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
        };
        readonly token1: {
          readonly address: string;
          readonly decimals: number | null;
          readonly id: string;
          readonly symbol: string | null;
          readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
        };
        readonly tvl: number;
      };
    }>;
    readonly pageInfo: {
      readonly endCursor: string | null;
      readonly hasNextPage: boolean;
    };
    readonly totalCount: number;
  };
};
export type PoolsPageQuery = {
  response: PoolsPageQuery$data;
  variables: PoolsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "orderBy"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "orderDirection"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  {
    "kind": "Variable",
    "name": "orderBy",
    "variableName": "orderBy"
  },
  {
    "kind": "Variable",
    "name": "orderDirection",
    "variableName": "orderDirection"
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
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "symbol",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "decimals",
  "storageKey": null
},
v6 = [
  (v2/*: any*/),
  (v3/*: any*/),
  (v4/*: any*/),
  (v5/*: any*/),
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "TokenPairFragment"
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tvl",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "reserveUSD",
  "storageKey": null
},
v9 = {
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
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalCount",
  "storageKey": null
},
v11 = [
  (v2/*: any*/),
  (v3/*: any*/),
  (v4/*: any*/),
  (v5/*: any*/),
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
    "name": "imageURI",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PoolsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PairConnection",
        "kind": "LinkedField",
        "name": "pairs",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "PairEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Pair",
                "kind": "LinkedField",
                "name": "node",
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
                    "selections": (v6/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Token",
                    "kind": "LinkedField",
                    "name": "token1",
                    "plural": false,
                    "selections": (v6/*: any*/),
                    "storageKey": null
                  },
                  (v7/*: any*/),
                  (v8/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v9/*: any*/),
          (v10/*: any*/)
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
    "name": "PoolsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PairConnection",
        "kind": "LinkedField",
        "name": "pairs",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "PairEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Pair",
                "kind": "LinkedField",
                "name": "node",
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
                  (v7/*: any*/),
                  (v8/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v9/*: any*/),
          (v10/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "97f23a911f8715e4e939c003e82863f3",
    "id": null,
    "metadata": {},
    "name": "PoolsPageQuery",
    "operationKind": "query",
    "text": "query PoolsPageQuery(\n  $first: Int!\n  $orderBy: PairOrderBy!\n  $orderDirection: OrderDirection!\n) {\n  pairs(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {\n    edges {\n      node {\n        id\n        address\n        token0 {\n          id\n          address\n          symbol\n          decimals\n          ...TokenPairFragment\n        }\n        token1 {\n          id\n          address\n          symbol\n          decimals\n          ...TokenPairFragment\n        }\n        tvl\n        reserveUSD\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}\n\nfragment TokenPairFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageURI\n}\n"
  }
};
})();

(node as any).hash = "a55610057d8f8c78cd105f67fef1bf89";

export default node;
