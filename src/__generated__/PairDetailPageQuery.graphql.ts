/**
 * @generated SignedSource<<95b17a6199ba1ce40561705851638010>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PairDetailPageQuery$variables = {
  pairAddress: string;
};
export type PairDetailPageQuery$data = {
  readonly pair: {
    readonly address: string;
    readonly id: string;
    readonly reserve0: string;
    readonly reserve1: string;
    readonly token0: {
      readonly address: string;
      readonly id: string;
      readonly symbol: string | null;
    };
    readonly token1: {
      readonly address: string;
      readonly id: string;
      readonly symbol: string | null;
    };
    readonly " $fragmentSpreads": FragmentRefs<"PriceChartContainer_pair">;
  } | null;
};
export type PairDetailPageQuery = {
  response: PairDetailPageQuery$data;
  variables: PairDetailPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "pairAddress"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "pairAddress"
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
  "name": "reserve0",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "reserve1",
  "storageKey": null
},
v6 = [
  (v2/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "symbol",
    "storageKey": null
  },
  (v3/*: any*/)
],
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "Token",
  "kind": "LinkedField",
  "name": "token0",
  "plural": false,
  "selections": (v6/*: any*/),
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "Token",
  "kind": "LinkedField",
  "name": "token1",
  "plural": false,
  "selections": (v6/*: any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PairDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Pair",
        "kind": "LinkedField",
        "name": "pair",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "PriceChartContainer_pair"
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
    "name": "PairDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Pair",
        "kind": "LinkedField",
        "name": "pair",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8f7c4657012e2f9b54c31b66b54b84fa",
    "id": null,
    "metadata": {},
    "name": "PairDetailPageQuery",
    "operationKind": "query",
    "text": "query PairDetailPageQuery(\n  $pairAddress: ID!\n) {\n  pair(id: $pairAddress) {\n    id\n    address\n    reserve0\n    reserve1\n    token0 {\n      id\n      symbol\n      address\n    }\n    token1 {\n      id\n      symbol\n      address\n    }\n    ...PriceChartContainer_pair\n  }\n}\n\nfragment PriceChartContainer_pair on Pair {\n  id\n  address\n  token0 {\n    id\n    symbol\n  }\n  token1 {\n    id\n    symbol\n  }\n}\n"
  }
};
})();

(node as any).hash = "3a13d7b36ca9fdd85be5fc3031e93813";

export default node;
