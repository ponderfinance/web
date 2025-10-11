/**
 * @generated SignedSource<<b78219ea12869ae977db73e466c64fcb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenPairFromAddressesQuery$variables = {
  tokenAAddress: string;
  tokenBAddress: string;
};
export type TokenPairFromAddressesQuery$data = {
  readonly tokenA: {
    readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
  } | null;
  readonly tokenB: {
    readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
  } | null;
};
export type TokenPairFromAddressesQuery = {
  response: TokenPairFromAddressesQuery$data;
  variables: TokenPairFromAddressesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tokenAAddress"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tokenBAddress"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "address",
    "variableName": "tokenAAddress"
  }
],
v2 = [
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "TokenPairFragment"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "address",
    "variableName": "tokenBAddress"
  }
],
v4 = [
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
    "name": "imageUri",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TokenPairFromAddressesQuery",
    "selections": [
      {
        "alias": "tokenA",
        "args": (v1/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
        "plural": false,
        "selections": (v2/*: any*/),
        "storageKey": null
      },
      {
        "alias": "tokenB",
        "args": (v3/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
        "plural": false,
        "selections": (v2/*: any*/),
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
    "name": "TokenPairFromAddressesQuery",
    "selections": [
      {
        "alias": "tokenA",
        "args": (v1/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
        "plural": false,
        "selections": (v4/*: any*/),
        "storageKey": null
      },
      {
        "alias": "tokenB",
        "args": (v3/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "tokenByAddress",
        "plural": false,
        "selections": (v4/*: any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7eb32d36294903983cdb58aa58c46f7f",
    "id": null,
    "metadata": {},
    "name": "TokenPairFromAddressesQuery",
    "operationKind": "query",
    "text": "query TokenPairFromAddressesQuery(\n  $tokenAAddress: String!\n  $tokenBAddress: String!\n) {\n  tokenA: tokenByAddress(address: $tokenAAddress) {\n    ...TokenPairFragment\n    id\n  }\n  tokenB: tokenByAddress(address: $tokenBAddress) {\n    ...TokenPairFragment\n    id\n  }\n}\n\nfragment TokenPairFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageUri\n}\n"
  }
};
})();

(node as any).hash = "68a33bf91bff1fa70314245ecafb4c88";

export default node;
