/**
 * @generated SignedSource<<58e381ffe9a233f54fb608f2d1a49a0c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PoolItem_pair$data = {
  readonly address: string;
  readonly id: string;
  readonly reserve0: string;
  readonly reserve1: string;
  readonly token0: {
    readonly address: string;
    readonly decimals: number | null;
    readonly id: string;
    readonly symbol: string | null;
  };
  readonly token1: {
    readonly address: string;
    readonly decimals: number | null;
    readonly id: string;
    readonly symbol: string | null;
  };
  readonly totalSupply: string;
  readonly " $fragmentType": "PoolItem_pair";
};
export type PoolItem_pair$key = {
  readonly " $data"?: PoolItem_pair$data;
  readonly " $fragmentSpreads": FragmentRefs<"PoolItem_pair">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "address",
  "storageKey": null
},
v2 = [
  (v0/*: any*/),
  (v1/*: any*/),
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
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PoolItem_pair",
  "selections": [
    (v0/*: any*/),
    (v1/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "totalSupply",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "reserve0",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "reserve1",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Token",
      "kind": "LinkedField",
      "name": "token0",
      "plural": false,
      "selections": (v2/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Token",
      "kind": "LinkedField",
      "name": "token1",
      "plural": false,
      "selections": (v2/*: any*/),
      "storageKey": null
    }
  ],
  "type": "Pair",
  "abstractKey": null
};
})();

(node as any).hash = "b21f980769e68dc376684eacecf93139";

export default node;
