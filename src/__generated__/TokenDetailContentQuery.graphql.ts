/**
 * @generated SignedSource<<ecb7c6c534ea3e6ecc27e941cbf84a5b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenDetailContentQuery$variables = {
  tokenAddress: string;
};
export type TokenDetailContentQuery$data = {
  readonly tokenByAddress: {
    readonly address: string;
    readonly decimals: number | null;
    readonly fdv: string;
    readonly id: string;
    readonly imageURI: string | null;
    readonly marketCap: string;
    readonly name: string | null;
    readonly priceChange24h: number | null;
    readonly priceUSD: string | null;
    readonly symbol: string | null;
    readonly tvl: string;
    readonly volumeUSD24h: string | null;
    readonly " $fragmentSpreads": FragmentRefs<"TokenPriceChartContainer_token">;
  } | null;
};
export type TokenDetailContentQuery = {
  response: TokenDetailContentQuery$data;
  variables: TokenDetailContentQuery$variables;
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
  "name": "tvl",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "marketCap",
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
  "kind": "ScalarField",
  "name": "imageURI",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TokenDetailContentQuery",
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
          (v11/*: any*/),
          (v12/*: any*/),
          (v13/*: any*/),
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
    "name": "TokenDetailContentQuery",
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
          (v11/*: any*/),
          (v12/*: any*/),
          (v13/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "40d875537c17014312d1258e21c535cb",
    "id": null,
    "metadata": {},
    "name": "TokenDetailContentQuery",
    "operationKind": "query",
    "text": "query TokenDetailContentQuery(\n  $tokenAddress: String!\n) {\n  tokenByAddress(address: $tokenAddress) {\n    id\n    name\n    symbol\n    address\n    decimals\n    priceUSD\n    priceChange24h\n    volumeUSD24h\n    tvl\n    marketCap\n    fdv\n    imageURI\n    ...TokenPriceChartContainer_token\n  }\n}\n\nfragment TokenPriceChartContainer_token on Token {\n  id\n  address\n  symbol\n  name\n  decimals\n}\n"
  }
};
})();

(node as any).hash = "fb7d133ea3247ac79815bf7a7a5193c3";

export default node;
