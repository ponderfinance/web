/**
 * @generated SignedSource<<dd7ea09d25073cd537c730a85a2332d3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenSelectorQuery$variables = {};
export type TokenSelectorQuery$data = {
  readonly tokens: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"TokenSelectorTokenFragment">;
      };
    }>;
  };
};
export type TokenSelectorQuery = {
  response: TokenSelectorQuery$data;
  variables: TokenSelectorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 12
  },
  {
    "kind": "Literal",
    "name": "orderBy",
    "value": "priceUSD"
  },
  {
    "kind": "Literal",
    "name": "orderDirection",
    "value": "desc"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "TokenSelectorQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*: any*/),
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
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "TokenSelectorTokenFragment"
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "tokens(first:12,orderBy:\"priceUSD\",orderDirection:\"desc\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "TokenSelectorQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*: any*/),
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
                    "name": "decimals",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "imageURI",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "priceUSD",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "tokens(first:12,orderBy:\"priceUSD\",orderDirection:\"desc\")"
      }
    ]
  },
  "params": {
    "cacheID": "746f43f5eb26563e63ad6f90b4b64a00",
    "id": null,
    "metadata": {},
    "name": "TokenSelectorQuery",
    "operationKind": "query",
    "text": "query TokenSelectorQuery {\n  tokens(first: 12, orderBy: priceUSD, orderDirection: desc) {\n    edges {\n      node {\n        ...TokenSelectorTokenFragment\n        id\n      }\n    }\n  }\n}\n\nfragment TokenSelectorTokenFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageURI\n  priceUSD\n}\n"
  }
};
})();

(node as any).hash = "70851f65ea99a2d785cf7023611b7a87";

export default node;
