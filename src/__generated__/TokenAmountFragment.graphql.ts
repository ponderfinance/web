/**
 * @generated SignedSource<<e92a6b84c722514abf0572cd94e3f359>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenAmountFragment$data = {
  readonly address: string;
  readonly id: string;
  readonly imageUri: string | null;
  readonly symbol: string | null;
  readonly " $fragmentType": "TokenAmountFragment";
};
export type TokenAmountFragment$key = {
  readonly " $data"?: TokenAmountFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"TokenAmountFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TokenAmountFragment",
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
      "name": "symbol",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "imageUri",
      "storageKey": null
    }
  ],
  "type": "Token",
  "abstractKey": null
};

(node as any).hash = "65469a94da0c726031821cde36493511";

export default node;
