/**
 * @generated SignedSource<<b97b4250431cc53c4dfb076a7869e81a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type OrderDirection = "asc" | "desc" | "%future added value";
export type PairOrderBy = "createdAt" | "reserveUSD" | "volumeUSD" | "%future added value";
export type pageExploreQuery$variables = {
  first: number;
  orderBy: PairOrderBy;
  orderDirection: OrderDirection;
};
export type pageExploreQuery$data = {
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
export type pageExploreQuery = {
  response: pageExploreQuery$data;
  variables: pageExploreQuery$variables;
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
    "name": "pageExploreQuery",
    "selections": (v4/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "pageExploreQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "bd7c70e1ee8b2369a7445c4bbf23717d",
    "id": null,
    "metadata": {},
    "name": "pageExploreQuery",
    "operationKind": "query",
    "text": "query pageExploreQuery(\n  $first: Int!\n  $orderBy: PairOrderBy!\n  $orderDirection: OrderDirection!\n) {\n  pairs(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {\n    edges {\n      node {\n        id\n        address\n        token0 {\n          id\n          address\n          symbol\n          decimals\n        }\n        token1 {\n          id\n          address\n          symbol\n          decimals\n        }\n        tvl\n        reserveUSD\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "c7e0aef01dbf2f7ac636f166f0b12bc7";

export default node;
