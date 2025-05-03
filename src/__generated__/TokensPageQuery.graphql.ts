/**
 * @generated SignedSource<<91684212757e5025709dfb06c9dfd0c9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
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
        readonly fdv: string;
        readonly id: string;
        readonly imageURI: string | null;
        readonly name: string | null;
        readonly priceChange1h: number | null;
        readonly priceChange24h: number | null;
        readonly priceUSD: string | null;
        readonly symbol: string | null;
        readonly volume1h: string | null;
        readonly volumeUSD24h: string | null;
        readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
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
  "name": "imageURI",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
  "name": "priceUSD",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "priceChange1h",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "priceChange24h",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "volumeUSD24h",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "volume1h",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "fdv",
  "storageKey": null
},
v13 = {
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
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalCount",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TokensPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/),
                  (v12/*: any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "TokenPairFragment"
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v13/*: any*/),
          (v14/*: any*/)
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
    "name": "TokensPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/),
                  (v12/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "decimals",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v13/*: any*/),
          (v14/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e036cd11d82dd1880b8b12c735541713",
    "id": null,
    "metadata": {},
    "name": "TokensPageQuery",
    "operationKind": "query",
    "text": "query TokensPageQuery(\n  $first: Int!\n  $orderBy: TokenOrderBy!\n  $orderDirection: OrderDirection!\n) {\n  tokens(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {\n    edges {\n      node {\n        id\n        address\n        imageURI\n        name\n        symbol\n        priceUSD\n        priceChange1h\n        priceChange24h\n        volumeUSD24h\n        volume1h\n        fdv\n        ...TokenPairFragment\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    totalCount\n  }\n}\n\nfragment TokenPairFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageURI\n}\n"
  }
};
})();

(node as any).hash = "5bb6e5e5637d4ec210930b61ccbbec78";

export default node;
