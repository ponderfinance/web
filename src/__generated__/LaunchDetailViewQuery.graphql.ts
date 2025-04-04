/**
 * @generated SignedSource<<93054f976fe33fc77a57f8ad3a0864ba>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LaunchDetailViewQuery$variables = {
  launchId: number;
};
export type LaunchDetailViewQuery$data = {
  readonly launch: {
    readonly " $fragmentSpreads": FragmentRefs<"LaunchDetailView_launch" | "LaunchToken_launch">;
  } | null;
};
export type LaunchDetailViewQuery = {
  response: LaunchDetailViewQuery$data;
  variables: LaunchDetailViewQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "launchId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "launchId",
    "variableName": "launchId"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "LaunchDetailViewQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Launch",
        "kind": "LinkedField",
        "name": "launch",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "LaunchDetailView_launch"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "LaunchToken_launch"
          }
        ],
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
    "name": "LaunchDetailViewQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Launch",
        "kind": "LinkedField",
        "name": "launch",
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
            "name": "launchId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "tokenAddress",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "creatorAddress",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "imageURI",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "kubRaised",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderRaised",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "status",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "kubPairAddress",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderPairAddress",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "hasDualPools",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderPoolSkipped",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "kubLiquidity",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderLiquidity",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "ponderBurned",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lpWithdrawn",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lpWithdrawnAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "completedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "cancelledAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "createdAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "updatedAt",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ac3d0a11a15a1198360a4e90a52e2c14",
    "id": null,
    "metadata": {},
    "name": "LaunchDetailViewQuery",
    "operationKind": "query",
    "text": "query LaunchDetailViewQuery(\n  $launchId: Int!\n) {\n  launch(launchId: $launchId) {\n    ...LaunchDetailView_launch\n    ...LaunchToken_launch\n    id\n  }\n}\n\nfragment LaunchDetailView_launch on Launch {\n  id\n  launchId\n  ...LaunchToken_launch\n}\n\nfragment LaunchToken_launch on Launch {\n  id\n  launchId\n  tokenAddress\n  creatorAddress\n  imageURI\n  kubRaised\n  ponderRaised\n  status\n  kubPairAddress\n  ponderPairAddress\n  hasDualPools\n  ponderPoolSkipped\n  kubLiquidity\n  ponderLiquidity\n  ponderBurned\n  lpWithdrawn\n  lpWithdrawnAt\n  completedAt\n  cancelledAt\n  createdAt\n  updatedAt\n}\n"
  }
};
})();

(node as any).hash = "c8aa8ea9e4cd67dc91ba7d0b034419f5";

export default node;
