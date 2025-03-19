/**
 * @generated SignedSource<<76400f6fbb646abdf1bdc219440d63f3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type pageCreatePositionsQuery$variables = {
  kkubAddress: string;
  koiAddress: string;
};
export type pageCreatePositionsQuery$data = {
  readonly tokenA: {
    readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
  } | null;
  readonly tokenB: {
    readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
  } | null;
};
export type pageCreatePositionsQuery = {
  response: pageCreatePositionsQuery$data;
  variables: pageCreatePositionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "kkubAddress"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "koiAddress"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "kkubAddress"
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
    "name": "id",
    "variableName": "koiAddress"
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
    "name": "pageCreatePositionsQuery",
    "selections": [
      {
        "alias": "tokenA",
        "args": (v1/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "token",
        "plural": false,
        "selections": (v2/*: any*/),
        "storageKey": null
      },
      {
        "alias": "tokenB",
        "args": (v3/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "token",
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
    "name": "pageCreatePositionsQuery",
    "selections": [
      {
        "alias": "tokenA",
        "args": (v1/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "token",
        "plural": false,
        "selections": (v4/*: any*/),
        "storageKey": null
      },
      {
        "alias": "tokenB",
        "args": (v3/*: any*/),
        "concreteType": "Token",
        "kind": "LinkedField",
        "name": "token",
        "plural": false,
        "selections": (v4/*: any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "0c311976b8849bd1a16fb5e11496fe9f",
    "id": null,
    "metadata": {},
    "name": "pageCreatePositionsQuery",
    "operationKind": "query",
    "text": "query pageCreatePositionsQuery(\n  $kkubAddress: ID!\n  $koiAddress: ID!\n) {\n  tokenA: token(id: $kkubAddress) {\n    ...TokenPairFragment\n    id\n  }\n  tokenB: token(id: $koiAddress) {\n    ...TokenPairFragment\n    id\n  }\n}\n\nfragment TokenPairFragment on Token {\n  id\n  address\n  name\n  symbol\n  decimals\n  imageURI\n}\n"
  }
};
})();

(node as any).hash = "df239d319135de1320da9f62804be2f1";

export default node;
