/**
 * @generated SignedSource<<d97b03823d4e45eb6cd5121dc2f8cc5b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type OrderDirection = "asc" | "desc" | "%future added value";
export type TokenOrderBy = "createdAt" | "name" | "priceChange24h" | "priceUSD" | "symbol" | "volumeUSD24h" | "%future added value";
export type TokensPageQuery$variables = {
  first: number;
  orderBy: TokenOrderBy;
  orderDirection: OrderDirection;
};
export type TokensPageQuery$data = {
  readonly tokens: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly address: string;
        readonly id: string;
        readonly name: string | null;
        readonly priceChange24h: number | null;
        readonly priceUSD: string;
        readonly symbol: string | null;
        readonly volumeUSD24h: string | null;
      };
    }>;
    readonly pageInfo: {
      readonly endCursor: string | null;
      readonly hasNextPage: boolean;
    };
    readonly totalCount: number;
  };
};
export type TokensPageQuery = {
  response: TokensPageQuery$data;
  variables: TokensPageQuery$variables;
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
    "concreteType": "TokenConnection",
    "kind": "LinkedField",
    "name": "tokens",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "TokenEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Token",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
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
                "name": "symbol",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "priceUSD",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "priceChange24h",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "volumeUSD24h",
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
    "name": "TokensPageQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TokensPageQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fbabd3d5e2fc33ab536c5e6a7a5a99fa",
    "id": null,
    "metadata": {},
    "name": "TokensPageQuery",
    "operationKind": "query",
    "text": "query TokensPageQuery(\n  $first: Int!\n  $orderBy: TokenOrderBy!\n  $orderDirection: OrderDirection!\n) {\n  tokens(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {\n    edges {\n      node {\n        id\n        address\n        name\n        symbol\n        priceUSD\n        priceChange24h\n        volumeUSD24h\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "b3d1278f03cab74dad0a83f65c6cb9a6";

export default node;
