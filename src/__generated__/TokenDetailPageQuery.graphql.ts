/**
 * @generated SignedSource<<646544d856c4c67383dc22e201a72b01>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenDetailPageQuery$variables = {
  tokenAddress: string;
};
export type TokenDetailPageQuery$data = {
  readonly tokenByAddress: {
    readonly address: string;
    readonly decimals: number | null;
    readonly id: string;
    readonly imageURI: string | null;
    readonly name: string | null;
    readonly priceChange24h: number | null;
    readonly priceUSD: string;
    readonly symbol: string | null;
    readonly volumeUSD24h: string | null;
    readonly " $fragmentSpreads": FragmentRefs<"TokenPriceChartContainer_token">;
  } | null;
};
export type TokenDetailPageQuery = {
  response: TokenDetailPageQuery$data;
  variables: TokenDetailPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tokenAddress"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "address",
    "variableName": "tokenAddress"
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
  "name": "name",
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
  "name": "address",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "decimals",
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
  "name": "priceChange24h",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "volumeUSD24h",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "imageURI",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TokenDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
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
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "TokenPriceChartContainer_token"
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
    "name": "TokenDetailPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
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
          (v10/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a377288c2b7e6bbca31dc7e79b70de33",
    "id": null,
    "metadata": {},
    "name": "TokenDetailPageQuery",
    "operationKind": "query",
    "text": "query TokenDetailPageQuery(\n  $tokenAddress: String!\n) {\n  tokenByAddress(address: $tokenAddress) {\n    id\n    name\n    symbol\n    address\n    decimals\n    priceUSD\n    priceChange24h\n    volumeUSD24h\n    imageURI\n    ...TokenPriceChartContainer_token\n  }\n}\n\nfragment TokenPriceChartContainer_token on Token {\n  id\n  address\n  symbol\n  name\n  decimals\n}\n"
  }
};
})();

(node as any).hash = "f85bf1e15ba63299c4129512fff90170";

export default node;
