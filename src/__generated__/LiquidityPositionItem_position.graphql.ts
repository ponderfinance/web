/**
 * @generated SignedSource<<8768531e530c4262c8144d29a074fe3e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LiquidityPositionItem_position$data = {
  readonly id: string;
  readonly liquidityTokens: string;
  readonly pair: {
    readonly address: string;
    readonly id: string;
    readonly token0: {
      readonly address: string;
      readonly id: string;
      readonly symbol: string | null;
      readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
    };
    readonly token1: {
      readonly address: string;
      readonly id: string;
      readonly symbol: string | null;
      readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
    };
  };
  readonly " $fragmentType": "LiquidityPositionItem_position";
};
export type LiquidityPositionItem_position$key = {
  readonly " $data"?: LiquidityPositionItem_position$data;
  readonly " $fragmentSpreads": FragmentRefs<"LiquidityPositionItem_position">;
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
    "args": null,
    "kind": "FragmentSpread",
    "name": "TokenPairFragment"
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "LiquidityPositionItem_position",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "Pair",
      "kind": "LinkedField",
      "name": "pair",
      "plural": false,
      "selections": [
        (v0/*: any*/),
        (v1/*: any*/),
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
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "liquidityTokens",
      "storageKey": null
    }
  ],
  "type": "LiquidityPosition",
  "abstractKey": null
};
})();

(node as any).hash = "a54b1b912d75fa8ddd62e983ed54a87b";

export default node;
