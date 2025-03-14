/**
 * @generated SignedSource<<3e1d40c24f7bb523ae89e8187966ef16>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PriceChartContainer_pair$data = {
  readonly address: string;
  readonly id: string;
  readonly token0: {
    readonly id: string;
    readonly symbol: string | null;
  };
  readonly token1: {
    readonly id: string;
    readonly symbol: string | null;
  };
  readonly " $fragmentType": "PriceChartContainer_pair";
};
export type PriceChartContainer_pair$key = {
  readonly " $data"?: PriceChartContainer_pair$data;
  readonly " $fragmentSpreads": FragmentRefs<"PriceChartContainer_pair">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = [
  (v0/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "symbol",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PriceChartContainer_pair",
  "selections": [
    (v0/*: any*/),
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
      "concreteType": "Token",
      "kind": "LinkedField",
      "name": "token0",
      "plural": false,
      "selections": (v1/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Token",
      "kind": "LinkedField",
      "name": "token1",
      "plural": false,
      "selections": (v1/*: any*/),
      "storageKey": null
    }
  ],
  "type": "Pair",
  "abstractKey": null
};
})();

(node as any).hash = "7a1d506e49b5d7fcf69c07bc9833a0f0";

export default node;
