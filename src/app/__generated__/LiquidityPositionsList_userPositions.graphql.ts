/**
 * @generated SignedSource<<8125f90ad85014ef18074e72ac418e8d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LiquidityPositionsList_userPositions$data = {
  readonly liquidityPositions: ReadonlyArray<{
    readonly id: string;
    readonly liquidityTokens: string;
    readonly pair: {
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
    };
    readonly userAddress: string;
  }>;
  readonly " $fragmentType": "LiquidityPositionsList_userPositions";
};
export type LiquidityPositionsList_userPositions$key = {
  readonly " $data"?: LiquidityPositionsList_userPositions$data;
  readonly " $fragmentSpreads": FragmentRefs<"LiquidityPositionsList_userPositions">;
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
  "name": "LiquidityPositionsList_userPositions",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "LiquidityPosition",
      "kind": "LinkedField",
      "name": "liquidityPositions",
      "plural": true,
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
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "userAddress",
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
      "storageKey": null
    }
  ],
  "type": "UserPositions",
  "abstractKey": null
};
})();

(node as any).hash = "e55334c0bd9560a267fc5de3be0b7acb";

export default node;
