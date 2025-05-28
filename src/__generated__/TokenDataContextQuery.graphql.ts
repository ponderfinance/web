/**
 * @generated SignedSource<<3dc97ed79d35c6da8cd9f3fc33e90a02>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type TokenDataContextQuery$variables = {
  address: string;
};
export type TokenDataContextQuery$data = {
  readonly token: {
    readonly address: string;
    readonly decimals: number | null;
    readonly id: string;
    readonly imageURI: string | null;
    readonly name: string | null;
    readonly symbol: string | null;
  } | null;
};
export type TokenDataContextQuery = {
  response: TokenDataContextQuery$data;
  variables: TokenDataContextQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "address"
  }
],
v1 = [
  {
    "alias": "token",
    "args": [
      {
        "kind": "Variable",
        "name": "address",
        "variableName": "address"
      }
    ],
    "concreteType": "Token",
    "kind": "LinkedField",
    "name": "tokenByAddress",
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
    "name": "TokenDataContextQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TokenDataContextQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "694b74ea1001a64a48b45ed2fe736731",
    "id": null,
    "metadata": {},
    "name": "TokenDataContextQuery",
    "operationKind": "query",
    "text": "query TokenDataContextQuery(\n  $address: String!\n) {\n  token: tokenByAddress(address: $address) {\n    id\n    address\n    name\n    symbol\n    decimals\n    imageURI\n  }\n}\n"
  }
};
})();

(node as any).hash = "0b1b95c34f3c48c39249f2ccb18f0589";

export default node;
