/**
 * @generated SignedSource<<db045dba476c98b5cf7918a4f5c4217c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenPairQuery$variables = {
  addressA: string;
  addressB: string;
};
export type TokenPairQuery$data = {
  readonly tokenA: {
    readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
  } | null;
  readonly tokenB: {
    readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
  } | null;
};
export type TokenPairQuery = {
  response: TokenPairQuery$data;
  variables: TokenPairQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "addressA"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "addressB"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "address",
    "variableName": "addressA"
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
    "variableName": "addressB"
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
    "name": "imageURI",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TokenPairQuery",
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
    "name": "TokenPairQuery",
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
    "cacheID": "4810d856056d8852253edde8c6283a51",
    "id": null,
    "metadata": {},
    "name": "TokenPairQuery",
    "operationKind": "query",
    "text": "query TokenPairQuery(\n  $addressA: String!\n  $addressB: String!\n) {\n  tokenA: tokenByAddress(address: $addressA) {\n    ...TokenPairFragment\n    id\n  }\n  tokenB: tokenByAddress(address: $addressB) {\n    ...TokenPairFragment\n    id\n  }\n}\n\nfragment TokenPairFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageURI\n}\n"
  }
};
})();

(node as any).hash = "e89ab370fb827dafc8dc4523955806c4";

export default node;
