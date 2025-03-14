/**
 * @generated SignedSource<<440453b2b5b4331d1f2ef5cf503b8987>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type OrderDirection = "asc" | "desc" | "%future added value";
export type PairOrderBy = "createdAt" | "reserveUSD" | "volumeUSD" | "%future added value";
export type PoolsListQuery$variables = {
  first: number;
  orderBy: PairOrderBy;
  orderDirection: OrderDirection;
};
export type PoolsListQuery$data = {
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
        };
        readonly token1: {
          readonly address: string;
          readonly decimals: number | null;
          readonly id: string;
          readonly symbol: string | null;
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
export type PoolsListQuery = {
  response: PoolsListQuery$data;
  variables: PoolsListQuery$variables;
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "address",
  "storageKey": null
},
v3 = [
  (v1/*: any*/),
  (v2/*: any*/),
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
],
v4 = [
  {
    "alias": null,
    "args": [
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
              (v1/*: any*/),
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Token",
                "kind": "LinkedField",
                "name": "token0",
                "plural": false,
                "selections": (v3/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "Token",
                "kind": "LinkedField",
                "name": "token1",
                "plural": false,
                "selections": (v3/*: any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "tvl",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "reserveUSD",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
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
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "totalCount",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PoolsListQuery",
    "selections": (v4/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PoolsListQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "77794d02be0c46ffffe5bfd49f14aa45",
    "id": null,
    "metadata": {},
    "name": "PoolsListQuery",
    "operationKind": "query",
    "text": "query PoolsListQuery(\n  $first: Int!\n  $orderBy: PairOrderBy!\n  $orderDirection: OrderDirection!\n) {\n  pairs(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {\n    edges {\n      node {\n        id\n        address\n        token0 {\n          id\n          address\n          symbol\n          decimals\n        }\n        token1 {\n          id\n          address\n          symbol\n          decimals\n        }\n        tvl\n        reserveUSD\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "57fcf02ac2895c908c6a8175af909b9a";

export default node;
