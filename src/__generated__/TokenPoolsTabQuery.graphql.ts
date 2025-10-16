/**
 * @generated SignedSource<<3a5e354c2383f9bac190eb5191c75e54>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type TokenPoolsTabQuery$variables = {
  tokenAddress: string;
};
export type TokenPoolsTabQuery$data = {
  readonly tokenByAddress: {
    readonly address: string;
    readonly id: string;
    readonly imageUri: string | null;
    readonly pairsAsToken0: ReadonlyArray<{
      readonly address: string;
      readonly id: string;
      readonly poolApr: number | null;
      readonly reserveUsd: string;
      readonly rewardApr: number | null;
      readonly token0: {
        readonly address: string;
        readonly id: string;
        readonly imageUri: string | null;
        readonly symbol: string | null;
      };
      readonly token1: {
        readonly address: string;
        readonly id: string;
        readonly imageUri: string | null;
        readonly symbol: string | null;
      };
      readonly tvl: number;
    }>;
    readonly pairsAsToken1: ReadonlyArray<{
      readonly address: string;
      readonly id: string;
      readonly poolApr: number | null;
      readonly reserveUsd: string;
      readonly rewardApr: number | null;
      readonly token0: {
        readonly address: string;
        readonly id: string;
        readonly imageUri: string | null;
        readonly symbol: string | null;
      };
      readonly token1: {
        readonly address: string;
        readonly id: string;
        readonly imageUri: string | null;
        readonly symbol: string | null;
      };
      readonly tvl: number;
    }>;
    readonly symbol: string | null;
  } | null;
};
export type TokenPoolsTabQuery = {
  response: TokenPoolsTabQuery$data;
  variables: TokenPoolsTabQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tokenAddress"
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "symbol",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "imageUri",
  "storageKey": null
},
v5 = [
  (v1/*: any*/),
  (v2/*: any*/),
  (v3/*: any*/),
  (v4/*: any*/)
],
v6 = [
  (v1/*: any*/),
  (v2/*: any*/),
  {
    "alias": null,
    "args": null,
    "concreteType": "Token",
    "kind": "LinkedField",
    "name": "token0",
    "plural": false,
    "selections": (v5/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "Token",
    "kind": "LinkedField",
    "name": "token1",
    "plural": false,
    "selections": (v5/*: any*/),
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
    "name": "poolApr",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "rewardApr",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "reserveUsd",
    "storageKey": null
  }
],
v7 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "address",
        "variableName": "tokenAddress"
      }
    ],
    "concreteType": "Token",
    "kind": "LinkedField",
    "name": "tokenByAddress",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "Pair",
        "kind": "LinkedField",
        "name": "pairsAsToken0",
        "plural": true,
        "selections": (v6/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Pair",
        "kind": "LinkedField",
        "name": "pairsAsToken1",
        "plural": true,
        "selections": (v6/*: any*/),
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
    "name": "TokenPoolsTabQuery",
    "selections": (v7/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TokenPoolsTabQuery",
    "selections": (v7/*: any*/)
  },
  "params": {
    "cacheID": "1fcedd3a9a6d607b497c49859847e066",
    "id": null,
    "metadata": {},
    "name": "TokenPoolsTabQuery",
    "operationKind": "query",
    "text": "query TokenPoolsTabQuery(\n  $tokenAddress: String!\n) {\n  tokenByAddress(address: $tokenAddress) {\n    id\n    address\n    symbol\n    imageUri\n    pairsAsToken0 {\n      id\n      address\n      token0 {\n        id\n        address\n        symbol\n        imageUri\n      }\n      token1 {\n        id\n        address\n        symbol\n        imageUri\n      }\n      tvl\n      poolApr\n      rewardApr\n      reserveUsd\n    }\n    pairsAsToken1 {\n      id\n      address\n      token0 {\n        id\n        address\n        symbol\n        imageUri\n      }\n      token1 {\n        id\n        address\n        symbol\n        imageUri\n      }\n      tvl\n      poolApr\n      rewardApr\n      reserveUsd\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6a6ad4522eb74e089d66d0dd58968ac8";

export default node;
